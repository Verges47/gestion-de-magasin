<?php
// API Rapports et statistiques (F25-F28).
//   GET /rapports.php?type=resume&periode=jour|semaine|mois
//   GET /rapports.php?type=ventes_par_produit
//   GET /rapports.php?type=stock_valeur
//   GET /rapports.php?type=export&format=csv|pdf
//
// Rôles autorisés : administrateur, gérant (lecture des rapports).

require __DIR__ . '/config.php';
require __DIR__ . '/lib.php';
require __DIR__ . '/auth.php';
require __DIR__ . '/roles.php';
require __DIR__ . '/pdf.php';

$method = $_SERVER['REQUEST_METHOD'];
$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);

$user = current_user();
if (!$user) {
    respond(['error' => 'Non authentifié.'], 401);
}
if (!in_array($user['role'], ['administrateur', 'gerant'], true)) {
    respond(['error' => 'Accès refusé.'], 403);
}

if ($method !== 'GET') {
    respond(['error' => 'Méthode non autorisée.'], 405);
}

$type = $_GET['type'] ?? 'resume';

try {
    // Export CSV des ventes.
    if ($type === 'export') {
        $format = $_GET['format'] ?? 'csv';
        $stmt = db()->query(
            'SELECT v.id, v.date, v.total_ht, v.total_tva, v.total_ttc,
                    v.mode_paiement, v.statut, u.name AS utilisateur_nom
               FROM ventes v
               LEFT JOIN users u ON u.id = v.id_utilisateur
              ORDER BY v.date DESC'
        );
        $ventes = $stmt->fetchAll();

        if ($format === 'pdf') {
            $colonnes = [
                'ID' => 8, 'Date' => 22, 'HT' => 14, 'TVA' => 14,
                'TTC' => 16, 'Paiement' => 14, 'Statut' => 14, 'Utilisateur' => 18,
            ];
            $lignes = [];
            foreach ($ventes as $v) {
                $lignes[] = [
                    $v['id'], $v['date'], $v['total_ht'], $v['total_tva'],
                    $v['total_ttc'], $v['mode_paiement'], $v['statut'], $v['utilisateur_nom'],
                ];
            }
            pdf_table('Rapport des ventes', $colonnes, $lignes, 'ventes.pdf');
        }

        if ($format === 'excel') {
            // SpreadsheetML (XML Excel) sans dépendance.
            header('Content-Type: application/vnd.ms-excel; charset=utf-8');
            header('Content-Disposition: attachment; filename="ventes.xls"');
            echo "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n";
            echo "<Workbook xmlns=\"urn:schemas-microsoft-com:office:spreadsheet\" xmlns:ss=\"urn:schemas-microsoft-com:office:spreadsheet\">\n";
            echo " <Worksheet ss:Name=\"Ventes\"><Table>\n";
            echo "  <Row>";
            foreach (['ID', 'Date', 'Total HT', 'TVA', 'Total TTC', 'Paiement', 'Statut', 'Utilisateur'] as $h) {
                echo "<Cell><Data ss:Type=\"String\">" . htmlspecialchars($h, ENT_XML1) . "</Data></Cell>";
            }
            echo "</Row>\n";
            foreach ($ventes as $v) {
                echo "  <Row>";
                foreach ([$v['id'], $v['date'], $v['total_ht'], $v['total_tva'], $v['total_ttc'], $v['mode_paiement'], $v['statut'], $v['utilisateur_nom']] as $cell) {
                    echo "<Cell><Data ss:Type=\"String\">" . htmlspecialchars((string)$cell, ENT_XML1) . "</Data></Cell>";
                }
                echo "</Row>\n";
            }
            echo " </Table></Worksheet>\n</Workbook>";
            exit;
        }

        // Défaut : CSV.
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="ventes.csv"');
        $out = fopen('php://output', 'w');
        fputcsv($out, ['ID', 'Date', 'Total HT', 'TVA', 'Total TTC', 'Paiement', 'Statut', 'Utilisateur'], ';');
        foreach ($ventes as $v) {
            fputcsv($out, [
                $v['id'], $v['date'], $v['total_ht'], $v['total_tva'],
                $v['total_ttc'], $v['mode_paiement'], $v['statut'], $v['utilisateur_nom'],
            ], ';');
        }
        fclose($out);
        exit;
    }

    // Valeur du stock + ruptures + péremptions (F27).
    if ($type === 'stock_valeur') {
        $stmt = db()->query(
            'SELECT COALESCE(SUM(COALESCE(s.quantite_actuelle,0) * p.prix_achat), 0) AS valeur_stock
               FROM produits p
               LEFT JOIN stock s ON s.id_produit = p.id
              WHERE p.actif = 1'
        );
        $valeur = $stmt->fetch();

        $stmt = db()->query(
            'SELECT COUNT(*) AS n FROM produits p
              LEFT JOIN stock s ON s.id_produit = p.id
              WHERE p.actif = 1
                AND (COALESCE(s.quantite_actuelle, 0) <= p.seuil_alerte AND p.seuil_alerte > 0)'
        );
        $ruptures = $stmt->fetch();

        $stmt = db()->query(
            'SELECT p.id, p.nom, p.date_peremption, COALESCE(s.quantite_actuelle,0) AS stock
               FROM produits p
               LEFT JOIN stock s ON s.id_produit = p.id
              WHERE p.actif = 1
                AND p.date_peremption IS NOT NULL
                AND p.date_peremption <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)
              ORDER BY p.date_peremption ASC
              LIMIT 50'
        );
        $peremptions = $stmt->fetchAll();

        respond([
            'valeur_stock' => $valeur['valeur_stock'],
            'nb_ruptures' => (int)$ruptures['n'],
            'peremptions' => $peremptions,
        ]);
    }

    // Produits les plus / moins vendus (F26).
    if ($type === 'ventes_par_produit') {
        $stmt = db()->query(
            'SELECT p.id, p.nom,
                    COALESCE(SUM(l.quantite), 0) AS qte_vendue,
                    COALESCE(SUM(l.quantite * l.prix_unitaire - l.remise), 0) AS ca
               FROM ligne_vente l
               JOIN produits p ON p.id = l.id_produit
               JOIN ventes v ON v.id = l.id_vente AND v.statut = \'validee\'
              GROUP BY p.id, p.nom
              ORDER BY qte_vendue DESC
              LIMIT 50'
        );
        respond(['produits' => $stmt->fetchAll()]);
    }

    // Résumé : ventes par période (F25) + série journalière pour graphique.
    $periode = $_GET['periode'] ?? 'jour';

    $groupExpr = 'DATE(v.date)';
    $sinceExpr = 'DATE_SUB(CURDATE(), INTERVAL 30 DAY)';
    if ($periode === 'semaine') {
        $groupExpr = 'YEARWEEK(v.date, 1)';
        $sinceExpr = 'DATE_SUB(CURDATE(), INTERVAL 12 WEEK)';
    } elseif ($periode === 'mois') {
        $groupExpr = 'DATE_FORMAT(v.date, \'%Y-%m\')';
        $sinceExpr = 'DATE_SUB(CURDATE(), INTERVAL 12 MONTH)';
    }

    // Série pour le graphique.
    $sql = "SELECT $groupExpr AS periode, COUNT(*) AS nb_ventes, SUM(total_ttc) AS ca
              FROM ventes v
             WHERE v.statut = 'validee' AND v.date >= $sinceExpr
             GROUP BY periode
             ORDER BY periode ASC";
    $stmt = db()->query($sql);
    $serie = $stmt->fetchAll();

    // Totaux de la période courante.
    $sqlTot = "SELECT COUNT(*) AS nb_ventes, COALESCE(SUM(total_ttc),0) AS ca,
                      COALESCE(SUM(total_ht),0) AS ca_ht, COALESCE(SUM(total_tva),0) AS ca_tva
                 FROM ventes
                WHERE statut = 'validee' AND date >= $sinceExpr";
    $tot = db()->query($sqlTot)->fetch();

    respond([
        'periode' => $periode,
        'serie' => $serie,
        'totaux' => $tot,
    ]);
} catch (Throwable $e) {
    respond(['error' => 'Erreur interne du serveur: ' . $e->getMessage()], 500);
}

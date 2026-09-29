<?php
// API Stock : niveau de stock, alertes et mouvements (entrées / sorties / ajustements).
//   GET  /stock.php               -> liste des produits avec stock + alertes
//   GET  /stock.php/mouvements    -> historique des mouvements (avec filtre ?produit=)
//   GET  /stock.php/{id_produit}  -> détail d'un produit + ses mouvements
//   POST /stock.php               -> enregistre un mouvement (atomique)
//
// Règles de gestion appliquées :
//   - Le stock ne peut pas devenir négatif, sauf autorisation explicite (allow_negative).
//   - Chaque mouvement est lié au produit et à l'utilisateur connecté.
//   - Toute sortie au-delà du stock disponible est refusée.

require __DIR__ . '/config.php';
require __DIR__ . '/lib.php';
require __DIR__ . '/auth.php';
require __DIR__ . '/roles.php';

// Magasinier, gérant et administrateur peuvent enregistrer des mouvements.
function stock_peut_ecrire(string $role): bool
{
    return in_array($role, ['administrateur', 'gerant', 'magasinier'], true);
}

$method = $_SERVER['REQUEST_METHOD'];
$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);

$user = current_user();
if (!$user) {
    respond(['error' => 'Non authentifié.'], 401);
}

try {
    // Historique des mouvements.
    if ($method === 'GET' && preg_match('#/stock\.php/mouvements$#', $path)) {
        $where = [];
        $params = [];
        if (!empty($_GET['produit'])) {
            $where[] = 'm.id_produit = ?';
            $params[] = (int)$_GET['produit'];
        }
        $sql = 'SELECT m.*, p.nom AS produit_nom, u.name AS utilisateur_nom
                  FROM mouvement_stock m
                  JOIN produits p ON p.id = m.id_produit
                  LEFT JOIN users u ON u.id = m.id_utilisateur';
        if ($where) {
            $sql .= ' WHERE ' . implode(' AND ', $where);
        }
        $sql .= ' ORDER BY m.date DESC LIMIT 500';
        $stmt = db()->prepare($sql);
        $stmt->execute($params);
        respond(['mouvements' => $stmt->fetchAll()]);
    }

    // Détail d'un produit.
    if ($method === 'GET' && preg_match('#/stock\.php/(\d+)$#', $path, $m)) {
        $idProduit = (int)$m[1];
        $stmt = db()->prepare(
            'SELECT p.id, p.nom, p.unite, p.seuil_alerte, s.quantite_actuelle
               FROM produits p
               LEFT JOIN stock s ON s.id_produit = p.id
              WHERE p.id = ?'
        );
        $stmt->execute([$idProduit]);
        $produit = $stmt->fetch();
        if (!$produit) {
            respond(['error' => 'Produit introuvable.'], 404);
        }

        $stmt = db()->prepare(
            'SELECT m.*, u.name AS utilisateur_nom
               FROM mouvement_stock m
               LEFT JOIN users u ON u.id = m.id_utilisateur
              WHERE m.id_produit = ?
              ORDER BY m.date DESC LIMIT 100'
        );
        $stmt->execute([$idProduit]);
        $produit['mouvements'] = $stmt->fetchAll();

        respond(['produit' => $produit]);
    }

    // Liste des produits avec stock et alertes.
    if ($method === 'GET') {
        $stmt = db()->query(
            'SELECT p.id, p.nom, p.unite, p.seuil_alerte, p.prix_vente, p.actif,
                    COALESCE(s.quantite_actuelle, 0) AS quantite_actuelle
               FROM produits p
               LEFT JOIN stock s ON s.id_produit = p.id
              WHERE p.actif = 1
              ORDER BY
                CASE WHEN COALESCE(s.quantite_actuelle, 0) <= p.seuil_alerte
                     AND p.seuil_alerte > 0 THEN 0 ELSE 1 END,
                p.nom ASC'
        );
        $rows = $stmt->fetchAll();
        foreach ($rows as &$r) {
            $r['alerte'] = (int)$r['seuil_alerte'] > 0
                && (int)$r['quantite_actuelle'] <= (int)$r['seuil_alerte'];
            $r['en_rupture'] = (int)$r['quantite_actuelle'] <= 0;
        }
        unset($r);
        respond(['produits' => $rows]);
    }

    // Création d'un mouvement (atomique).
    if ($method === 'POST') {
        if (!stock_peut_ecrire($user['role'])) {
            respond(['error' => 'Accès refusé.'], 403);
        }
        $data = read_json();
        $idProduit = (int)($data['id_produit'] ?? 0);
        $type = $data['type'] ?? '';
        $quantite = (int)($data['quantite'] ?? 0);
        $motif = trim($data['motif'] ?? '') ?: null;
        $allowNegative = !empty($data['allow_negative']);

        if ($idProduit <= 0) {
            respond(['error' => 'Produit requis.'], 400);
        }
        if (!in_array($type, ['entree', 'sortie', 'ajustement'], true)) {
            respond(['error' => 'Type de mouvement invalide.'], 400);
        }
        if ($quantite <= 0) {
            respond(['error' => 'La quantité doit être strictement positive.'], 400);
        }

        $pdo = db();
        $pdo->beginTransaction();

        // Verrouille la ligne de stock et lit la quantité actuelle.
        $stmt = $pdo->prepare('SELECT quantite_actuelle FROM stock WHERE id_produit = ? FOR UPDATE');
        $stmt->execute([$idProduit]);
        $row = $stmt->fetch();

        if (!$row) {
            // Pas encore de ligne de stock : on la crée (mouvement d'entrée ou ajustement).
            $current = 0;
            $pdo->prepare('INSERT INTO stock (id_produit, quantite_actuelle) VALUES (?, 0)')
                ->execute([$idProduit]);
        } else {
            $current = (int)$row['quantite_actuelle'];
        }

        // Calcul de la nouvelle quantité selon le type.
        $delta = 0;
        if ($type === 'entree') {
            $delta = $quantite;
        } elseif ($type === 'sortie') {
            $delta = -$quantite;
        } elseif ($type === 'ajustement') {
            // Ajustement : la quantité envoyée est la valeur cible absolue.
            $delta = $quantite - $current;
        }

        $newQty = $current + $delta;
        if ($newQty < 0 && !$allowNegative) {
            $pdo->rollBack();
            respond([
                'error' => 'Stock insuffisant (disponible : ' . $current . ').',
                'stock_disponible' => $current,
            ], 409);
        }

        // Met à jour le stock.
        $stmt = $pdo->prepare('UPDATE stock SET quantite_actuelle = ? WHERE id_produit = ?');
        $stmt->execute([$newQty, $idProduit]);

        // Enregistre le mouvement (on stocke le delta signé réel appliqué).
        $mouvementQty = $type === 'ajustement' ? $delta : $quantite;
        if ($mouvementQty === 0 && $type === 'ajustement') {
            $pdo->commit();
            respond(['ok' => true, 'quantite_actuelle' => $newQty]);
        }
        $stmt = $pdo->prepare(
            'INSERT INTO mouvement_stock (id_produit, type, quantite, motif, id_utilisateur)
             VALUES (?, ?, ?, ?, ?)'
        );
        $stmt->execute([$idProduit, $type, $delta, $motif, $user['id']]);

        $pdo->commit();
        journal($user['id'], 'mouvement_' . $type, "Produit #$idProduit : $type $delta");
        respond(['ok' => true, 'quantite_actuelle' => $newQty]);
    }

    respond(['error' => 'Méthode non autorisée.'], 405);
} catch (Throwable $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    respond(['error' => 'Erreur interne du serveur: ' . $e->getMessage()], 500);
}
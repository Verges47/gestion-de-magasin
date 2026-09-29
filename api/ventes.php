<?php
// API Ventes / caisse.
//   GET  /ventes.php              -> liste des ventes
//   GET  /ventes.php/{id}         -> détail d'une vente + lignes
//   POST /ventes.php              -> crée une vente (atomique) + décrémente le stock
//   POST /ventes.php/{id}/annuler -> annule ou rembourse une vente (restaure le stock)
//
// Règles de gestion :
//   - Toute vente validée crée automatiquement des mouvements de sortie (F17).
//   - Le calcul total / TVA / remise est fait côté serveur (F16).
//   - Une transaction ne peut jamais être enregistrée à moitié (transaction atomique).
//   - L'annulation / remboursement requiert un droit spécifique (administrateur ou gérant).

require __DIR__ . '/config.php';
require __DIR__ . '/lib.php';
require __DIR__ . '/auth.php';
require __DIR__ . '/roles.php';

function vente_peut_creer(string $role): bool
{
    return in_array($role, ['administrateur', 'gerant', 'caissier'], true);
}

function vente_peut_annuler(string $role): bool
{
    return in_array($role, ['administrateur', 'gerant'], true);
}

$method = $_SERVER['REQUEST_METHOD'];
$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);

$user = current_user();
if (!$user) {
    respond(['error' => 'Non authentifié.'], 401);
}

try {
    // Annulation / remboursement.
    if ($method === 'POST' && preg_match('#/ventes\.php/(\d+)/annuler$#', $path, $m)) {
        if (!vente_peut_annuler($user['role'])) {
            respond(['error' => 'Accès refusé : droit spécifique requis pour annuler.'], 403);
        }
        $idVente = (int)$m[1];
        $data = read_json();
        $statutCible = $data['statut'] ?? 'annulee'; // 'annulee' ou 'remboursee'

        $pdo = db();
        $pdo->beginTransaction();

        $stmt = $pdo->prepare('SELECT * FROM ventes WHERE id = ? FOR UPDATE');
        $stmt->execute([$idVente]);
        $vente = $stmt->fetch();
        if (!$vente) {
            $pdo->rollBack();
            respond(['error' => 'Vente introuvable.'], 404);
        }
        if ($vente['statut'] !== 'validee') {
            $pdo->rollBack();
            respond(['error' => 'Cette vente a déjà été annulée.'], 409);
        }

        // Restaure le stock pour chaque ligne.
        $stmt = $pdo->prepare('SELECT id_produit, quantite FROM ligne_vente WHERE id_vente = ?');
        $stmt->execute([$idVente]);
        $lignes = $stmt->fetchAll();

        foreach ($lignes as $ligne) {
            $stmt = $pdo->prepare('UPDATE stock SET quantite_actuelle = quantite_actuelle + ? WHERE id_produit = ?');
            $stmt->execute([$ligne['quantite'], $ligne['id_produit']]);

            $stmt = $pdo->prepare(
                'INSERT INTO mouvement_stock (id_produit, type, quantite, motif, id_utilisateur)
                 VALUES (?, ?, ?, ?, ?)'
            );
            $stmt->execute([$ligne['id_produit'], 'entree', $ligne['quantite'], 'Annulation vente #' . $idVente, $user['id']]);
        }

        $stmt = $pdo->prepare('UPDATE ventes SET statut = ? WHERE id = ?');
        $stmt->execute([$statutCible === 'remboursee' ? 'remboursee' : 'annulee', $idVente]);

        $pdo->commit();
        journal($user['id'], 'vente_annuler', "Vente #$idVente -> $statutCible");
        respond(['ok' => true]);
    }

    // Détail d'une vente.
    if ($method === 'GET' && preg_match('#/ventes\.php/(\d+)$#', $path, $m)) {
        $idVente = (int)$m[1];
        $stmt = db()->prepare(
            'SELECT v.*, u.name AS utilisateur_nom
               FROM ventes v
               LEFT JOIN users u ON u.id = v.id_utilisateur
              WHERE v.id = ?'
        );
        $stmt->execute([$idVente]);
        $vente = $stmt->fetch();
        if (!$vente) {
            respond(['error' => 'Vente introuvable.'], 404);
        }

        $stmt = db()->prepare(
            'SELECT l.*, p.nom AS produit_nom
               FROM ligne_vente l
               JOIN produits p ON p.id = l.id_produit
              WHERE l.id_vente = ?'
        );
        $stmt->execute([$idVente]);
        $vente['lignes'] = $stmt->fetchAll();

        respond(['vente' => $vente]);
    }

    // Liste des ventes.
    if ($method === 'GET') {
        $limit = min((int)($_GET['limit'] ?? 100), 500);
        $stmt = db()->prepare(
            'SELECT v.*, u.name AS utilisateur_nom
               FROM ventes v
               LEFT JOIN users u ON u.id = v.id_utilisateur
              ORDER BY v.date DESC
              LIMIT ' . $limit
        );
        $stmt->execute();
        respond(['ventes' => $stmt->fetchAll()]);
    }

    // Création d'une vente (atomique).
    if ($method === 'POST') {
        if (!vente_peut_creer($user['role'])) {
            respond(['error' => 'Accès refusé.'], 403);
        }
        $data = read_json();
        $lignes = $data['lignes'] ?? [];
        $modePaiement = trim($data['mode_paiement'] ?? '') ?: null;

        if (!is_array($lignes) || count($lignes) === 0) {
            respond(['error' => 'La vente doit contenir au moins une ligne.'], 400);
        }

        $pdo = db();
        $pdo->beginTransaction();

        $totalHt = 0.0;
        $totalTva = 0.0;
        $totalTtc = 0.0;

        // Valide chaque ligne et calcule les totaux.
        $lignesPreparees = [];
        foreach ($lignes as $ligne) {
            $idProduit = (int)($ligne['id_produit'] ?? 0);
            $quantite = (int)($ligne['quantite'] ?? 0);
            $remise = (float)($ligne['remise'] ?? 0);

            if ($idProduit <= 0 || $quantite <= 0) {
                $pdo->rollBack();
                respond(['error' => 'Ligne invalide (produit ou quantité).'], 400);
            }

            // Lit le produit avec verrou sur le stock.
            $stmt = $pdo->prepare(
                'SELECT p.id, p.prix_vente, p.taux_tva, s.quantite_actuelle
                   FROM produits p
                   LEFT JOIN stock s ON s.id_produit = p.id
                  WHERE p.id = ? AND p.actif = 1 FOR UPDATE'
            );
            $stmt->execute([$idProduit]);
            $produit = $stmt->fetch();
            if (!$produit) {
                $pdo->rollBack();
                respond(['error' => 'Produit introuvable ou désactivé.'], 400);
            }

            $stockDispo = (int)$produit['quantite_actuelle'];
            if ($stockDispo < $quantite) {
                $pdo->rollBack();
                respond([
                    'error' => 'Stock insuffisant pour ce produit.',
                    'produit' => $idProduit,
                    'stock_disponible' => $stockDispo,
                ], 409);
            }

            $prixUnitaire = (float)$produit['prix_vente'];
            $tauxTva = (float)$produit['taux_tva'];

            $htLigne = $prixUnitaire * $quantite;
            $htLigneApresRemise = max(0, $htLigne - $remise);
            $tvaLigne = $htLigneApresRemise * $tauxTva / 100.0;
            $ttcLigne = $htLigneApresRemise + $tvaLigne;

            $totalHt += $htLigneApresRemise;
            $totalTva += $tvaLigne;
            $totalTtc += $ttcLigne;

            $lignesPreparees[] = [
                'id_produit' => $idProduit,
                'quantite' => $quantite,
                'prix_unitaire' => $prixUnitaire,
                'remise' => $remise,
                'ht' => $htLigneApresRemise,
                'tva' => $tvaLigne,
                'ttc' => $ttcLigne,
            ];
        }

        // Crée la vente.
        $stmt = $pdo->prepare(
            'INSERT INTO ventes (id_utilisateur, total_ht, total_tva, total_ttc, mode_paiement, statut)
             VALUES (?, ?, ?, ?, ?, ?)'
        );
        $stmt->execute([
            $user['id'],
            round($totalHt, 2),
            round($totalTva, 2),
            round($totalTtc, 2),
            $modePaiement,
            'validee',
        ]);
        $idVente = (int)$pdo->lastInsertId();

        // Insère les lignes et décrémente le stock + mouvements.
        foreach ($lignesPreparees as $ligne) {
            $stmt = $pdo->prepare(
                'INSERT INTO ligne_vente (id_vente, id_produit, quantite, prix_unitaire, remise)
                 VALUES (?, ?, ?, ?, ?)'
            );
            $stmt->execute([
                $idVente,
                $ligne['id_produit'],
                $ligne['quantite'],
                $ligne['prix_unitaire'],
                $ligne['remise'],
            ]);

            $stmt = $pdo->prepare('UPDATE stock SET quantite_actuelle = quantite_actuelle - ? WHERE id_produit = ?');
            $stmt->execute([$ligne['quantite'], $ligne['id_produit']]);

            $stmt = $pdo->prepare(
                'INSERT INTO mouvement_stock (id_produit, type, quantite, motif, id_utilisateur)
                 VALUES (?, ?, ?, ?, ?)'
            );
            $stmt->execute([$ligne['id_produit'], 'sortie', -$ligne['quantite'], 'Vente #' . $idVente, $user['id']]);
        }

        $pdo->commit();
        journal($user['id'], 'vente_creer', "Vente #$idVente : $totalTtc");
        respond([
            'id' => $idVente,
            'total_ht' => round($totalHt, 2),
            'total_tva' => round($totalTva, 2),
            'total_ttc' => round($totalTtc, 2),
        ], 201);
    }

    respond(['error' => 'Méthode non autorisée.'], 405);
} catch (Throwable $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    respond(['error' => 'Erreur interne du serveur: ' . $e->getMessage()], 500);
}
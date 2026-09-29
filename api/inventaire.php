<?php
// API Inventaire par scan (F13).
//   GET  /inventaire.php                    -> liste des sessions
//   POST /inventaire.php                    -> démarre une session
//   GET  /inventaire.php/{id}               -> détail + lignes + écarts
//   POST /inventaire.php/{id}/scanner       -> scanne un produit (code ou id)
//   POST /inventaire.php/{id}/cloturer      -> clôture : applique les écarts au stock
//
// Règles :
//   - Au scan, la quantité comptée est incrémentée pour le produit.
//   - À la clôture, chaque écart (compté - attendu) génère un ajustement de stock.

require __DIR__ . '/config.php';
require __DIR__ . '/lib.php';
require __DIR__ . '/auth.php';
require __DIR__ . '/roles.php';

function inventaire_peut_ecrire(string $role): bool
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
    // Scan d'un produit (par code ou par id).
    if ($method === 'POST' && preg_match('#/inventaire\.php/(\d+)/scanner$#', $path, $m)) {
        if (!inventaire_peut_ecrire($user['role'])) {
            respond(['error' => 'Accès refusé.'], 403);
        }
        $idInventaire = (int)$m[1];
        $data = read_json();
        $code = trim($data['code'] ?? '');
        $idProduit = (int)($data['id_produit'] ?? 0);

        $pdo = db();
        $pdo->beginTransaction();

        // Vérifie la session.
        $stmt = $pdo->prepare('SELECT * FROM inventaire WHERE id = ? FOR UPDATE');
        $stmt->execute([$idInventaire]);
        $inventaire = $stmt->fetch();
        if (!$inventaire) {
            $pdo->rollBack();
            respond(['error' => 'Inventaire introuvable.'], 404);
        }
        if ($inventaire['statut'] !== 'en_cours') {
            $pdo->rollBack();
            respond(['error' => 'Cet inventaire est déjà clôturé.'], 409);
        }

        // Résout le produit : par code d'abord, sinon par id.
        if ($code !== '') {
            $stmt = $pdo->prepare(
                'SELECT p.id, p.nom FROM code_produit c JOIN produits p ON p.id = c.id_produit WHERE c.valeur_code = ?'
            );
            $stmt->execute([$code]);
            $produit = $stmt->fetch();
        } elseif ($idProduit > 0) {
            $stmt = $pdo->prepare('SELECT id, nom FROM produits WHERE id = ?');
            $stmt->execute([$idProduit]);
            $produit = $stmt->fetch();
        } else {
            $pdo->rollBack();
            respond(['error' => 'Code ou produit requis.'], 400);
        }

        if (!$produit) {
            $pdo->rollBack();
            respond(['error' => 'Produit introuvable pour ce code.'], 404);
        }

        // Stock attendu au moment du scan.
        $stmt = $pdo->prepare('SELECT COALESCE(quantite_actuelle,0) AS q FROM stock WHERE id_produit = ?');
        $stmt->execute([$produit['id']]);
        $attendu = (int)$stmt->fetch()['q'];

        // Upsert la ligne d'inventaire : incrémente la quantité comptée.
        $stmt = $pdo->prepare(
            'INSERT INTO ligne_inventaire (id_inventaire, id_produit, quantite_attendu, quantite_comptee)
             VALUES (?, ?, ?, 1)
             ON DUPLICATE KEY UPDATE quantite_comptee = quantite_comptee + 1, quantite_attendu = VALUES(quantite_attendu)'
        );
        $stmt->execute([$idInventaire, $produit['id'], $attendu]);

        $pdo->commit();

        $stmt = db()->prepare(
            'SELECT quantite_attendu, quantite_comptee FROM ligne_inventaire WHERE id_inventaire = ? AND id_produit = ?'
        );
        $stmt->execute([$idInventaire, $produit['id']]);
        $ligne = $stmt->fetch();

        respond([
            'produit' => $produit,
            'quantite_comptee' => (int)$ligne['quantite_comptee'],
            'quantite_attendu' => (int)$ligne['quantite_attendu'],
        ]);
    }

    // Clôture : applique les écarts au stock.
    if ($method === 'POST' && preg_match('#/inventaire\.php/(\d+)/cloturer$#', $path, $m)) {
        if (!inventaire_peut_ecrire($user['role'])) {
            respond(['error' => 'Accès refusé.'], 403);
        }
        $idInventaire = (int)$m[1];

        $pdo = db();
        $pdo->beginTransaction();

        $stmt = $pdo->prepare('SELECT * FROM inventaire WHERE id = ? FOR UPDATE');
        $stmt->execute([$idInventaire]);
        $inventaire = $stmt->fetch();
        if (!$inventaire) {
            $pdo->rollBack();
            respond(['error' => 'Inventaire introuvable.'], 404);
        }
        if ($inventaire['statut'] !== 'en_cours') {
            $pdo->rollBack();
            respond(['error' => 'Cet inventaire est déjà clôturé.'], 409);
        }

        $stmt = $pdo->prepare('SELECT * FROM ligne_inventaire WHERE id_inventaire = ?');
        $stmt->execute([$idInventaire]);
        $lignes = $stmt->fetchAll();

        $ecarts = [];
        foreach ($lignes as $ligne) {
            $ecart = (int)$ligne['quantite_comptee'] - (int)$ligne['quantite_attendu'];
            if ($ecart === 0) {
                continue;
            }
            // Applique l'écart : on fixe le stock à la quantité comptée.
            $stmt = $pdo->prepare('SELECT COALESCE(quantite_actuelle,0) AS q FROM stock WHERE id_produit = ? FOR UPDATE');
            $stmt->execute([$ligne['id_produit']]);
            $current = (int)$stmt->fetch()['q'];

            $newQty = $current + $ecart;
            $stmt = $pdo->prepare('UPDATE stock SET quantite_actuelle = ? WHERE id_produit = ?');
            $stmt->execute([$newQty, $ligne['id_produit']]);

            $stmt = $pdo->prepare(
                'INSERT INTO mouvement_stock (id_produit, type, quantite, motif, id_utilisateur)
                 VALUES (?, ?, ?, ?, ?)'
            );
            $stmt->execute([$ligne['id_produit'], 'ajustement', $ecart, 'Inventaire #' . $idInventaire, $user['id']]);

            $ecarts[] = [
                'id_produit' => $ligne['id_produit'],
                'ecart' => $ecart,
                'comptee' => (int)$ligne['quantite_comptee'],
                'attendu' => (int)$ligne['quantite_attendu'],
            ];
        }

        $stmt = $pdo->prepare('UPDATE inventaire SET statut = ? WHERE id = ?');
        $stmt->execute(['cloture', $idInventaire]);

        $pdo->commit();
        journal($user['id'], 'inventaire_cloturer', "Inventaire #$idInventaire : " . count($ecarts) . ' écart(s)');
        respond(['ok' => true, 'ecarts' => $ecarts]);
    }

    // Détail d'une session.
    if ($method === 'GET' && preg_match('#/inventaire\.php/(\d+)$#', $path, $m)) {
        $idInventaire = (int)$m[1];
        $stmt = db()->prepare(
            'SELECT i.*, u.name AS utilisateur_nom FROM inventaire i
              LEFT JOIN users u ON u.id = i.id_utilisateur
             WHERE i.id = ?'
        );
        $stmt->execute([$idInventaire]);
        $inventaire = $stmt->fetch();
        if (!$inventaire) {
            respond(['error' => 'Inventaire introuvable.'], 404);
        }

        $stmt = db()->prepare(
            'SELECT l.*, p.nom AS produit_nom
               FROM ligne_inventaire l
               JOIN produits p ON p.id = l.id_produit
              WHERE l.id_inventaire = ?
              ORDER BY (l.quantite_comptee - l.quantite_attendu) DESC'
        );
        $stmt->execute([$idInventaire]);
        $lignes = $stmt->fetchAll();
        foreach ($lignes as &$l) {
            $l['ecart'] = (int)$l['quantite_comptee'] - (int)$l['quantite_attendu'];
        }
        unset($l);

        $inventaire['lignes'] = $lignes;
        respond(['inventaire' => $inventaire]);
    }

    // Liste des sessions.
    if ($method === 'GET') {
        $stmt = db()->query(
            'SELECT i.*, u.name AS utilisateur_nom,
                    (SELECT COUNT(*) FROM ligne_inventaire l WHERE l.id_inventaire = i.id) AS nb_produits
               FROM inventaire i
               LEFT JOIN users u ON u.id = i.id_utilisateur
              ORDER BY i.date DESC'
        );
        respond(['inventaires' => $stmt->fetchAll()]);
    }

    // Démarrage d'une session.
    if ($method === 'POST') {
        if (!inventaire_peut_ecrire($user['role'])) {
            respond(['error' => 'Accès refusé.'], 403);
        }
        $stmt = db()->prepare('INSERT INTO inventaire (id_utilisateur) VALUES (?)');
        $stmt->execute([$user['id']]);
        $newId = (int)db()->lastInsertId();
        journal($user['id'], 'inventaire_demarrer', "Inventaire #$newId");
        respond(['id' => $newId], 201);
    }

    respond(['error' => 'Méthode non autorisée.'], 405);
} catch (Throwable $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    respond(['error' => 'Erreur interne du serveur: ' . $e->getMessage()], 500);
}
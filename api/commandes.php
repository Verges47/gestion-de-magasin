<?php
// API Commandes fournisseur (bons de commande).
//   GET  /commandes.php              -> liste des commandes
//   GET  /commandes.php/{id}         -> détail d'une commande + lignes
//   POST /commandes.php              -> crée une commande (brouillon)
//   PUT  /commandes.php/{id}         -> modifie statut ou lignes
//   POST /commandes.php/{id}/recevoir -> marque reçue + met à jour le stock
//
// Statuts : brouillon, envoyee, recue, annulee.
// Règle : réception d'une commande crée des mouvements d'entrée en stock.

require __DIR__ . '/config.php';
require __DIR__ . '/lib.php';
require __DIR__ . '/auth.php';
require __DIR__ . '/roles.php';

function commande_peut_ecrire(string $role): bool
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
    // Réception d'une commande : met à jour le stock.
    if ($method === 'POST' && preg_match('#/commandes\.php/(\d+)/recevoir$#', $path, $m)) {
        if (!commande_peut_ecrire($user['role'])) {
            respond(['error' => 'Accès refusé.'], 403);
        }
        $idCommande = (int)$m[1];

        $pdo = db();
        $pdo->beginTransaction();

        $stmt = $pdo->prepare('SELECT * FROM commande_fournisseur WHERE id = ? FOR UPDATE');
        $stmt->execute([$idCommande]);
        $commande = $stmt->fetch();
        if (!$commande) {
            $pdo->rollBack();
            respond(['error' => 'Commande introuvable.'], 404);
        }
        if ($commande['statut'] === 'recue') {
            $pdo->rollBack();
            respond(['error' => 'Cette commande a déjà été reçue.'], 409);
        }

        $stmt = $pdo->prepare('SELECT id_produit, quantite FROM ligne_commande WHERE id_commande = ?');
        $stmt->execute([$idCommande]);
        $lignes = $stmt->fetchAll();

        foreach ($lignes as $ligne) {
            // Crée la ligne de stock si absente puis incrémente.
            $stmt = $pdo->prepare('SELECT 1 FROM stock WHERE id_produit = ?');
            $stmt->execute([$ligne['id_produit']]);
            if (!$stmt->fetch()) {
                $pdo->prepare('INSERT INTO stock (id_produit, quantite_actuelle) VALUES (?, 0)')
                    ->execute([$ligne['id_produit']]);
            }
            $stmt = $pdo->prepare('UPDATE stock SET quantite_actuelle = quantite_actuelle + ? WHERE id_produit = ?');
            $stmt->execute([$ligne['quantite'], $ligne['id_produit']]);

            $stmt = $pdo->prepare(
                'INSERT INTO mouvement_stock (id_produit, type, quantite, motif, id_utilisateur)
                 VALUES (?, ?, ?, ?, ?)'
            );
            $stmt->execute([$ligne['id_produit'], 'entree', $ligne['quantite'], 'Réception commande #' . $idCommande, $user['id']]);
        }

        $stmt = $pdo->prepare('UPDATE commande_fournisseur SET statut = ? WHERE id = ?');
        $stmt->execute(['recue', $idCommande]);

        $pdo->commit();
        journal($user['id'], 'commande_recue', "Commande #$idCommande");
        respond(['ok' => true]);
    }

    // Détail d'une commande.
    if ($method === 'GET' && preg_match('#/commandes\.php/(\d+)$#', $path, $m)) {
        $idCommande = (int)$m[1];
        $stmt = db()->prepare(
            'SELECT c.*, f.name AS fournisseur_nom
               FROM commande_fournisseur c
               JOIN fournisseurs f ON f.id = c.id_fournisseur
              WHERE c.id = ?'
        );
        $stmt->execute([$idCommande]);
        $commande = $stmt->fetch();
        if (!$commande) {
            respond(['error' => 'Commande introuvable.'], 404);
        }

        $stmt = db()->prepare(
            'SELECT l.*, p.nom AS produit_nom
               FROM ligne_commande l
               JOIN produits p ON p.id = l.id_produit
              WHERE l.id_commande = ?'
        );
        $stmt->execute([$idCommande]);
        $commande['lignes'] = $stmt->fetchAll();

        respond(['commande' => $commande]);
    }

    // Liste.
    if ($method === 'GET') {
        $stmt = db()->query(
            'SELECT c.*, f.name AS fournisseur_nom,
                    (SELECT SUM(quantite) FROM ligne_commande l WHERE l.id_commande = c.id) AS nb_articles
               FROM commande_fournisseur c
               JOIN fournisseurs f ON f.id = c.id_fournisseur
              ORDER BY c.date DESC'
        );
        respond(['commandes' => $stmt->fetchAll()]);
    }

    // Création.
    if ($method === 'POST') {
        if (!commande_peut_ecrire($user['role'])) {
            respond(['error' => 'Accès refusé.'], 403);
        }
        $data = read_json();
        $idFournisseur = (int)($data['id_fournisseur'] ?? 0);
        $lignes = $data['lignes'] ?? [];

        if ($idFournisseur <= 0) {
            respond(['error' => 'Fournisseur requis.'], 400);
        }
        if (!is_array($lignes) || count($lignes) === 0) {
            respond(['error' => 'La commande doit contenir au moins une ligne.'], 400);
        }

        $stmt = db()->prepare('SELECT id FROM fournisseurs WHERE id = ?');
        $stmt->execute([$idFournisseur]);
        if (!$stmt->fetch()) {
            respond(['error' => 'Fournisseur introuvable.'], 404);
        }

        $pdo = db();
        $pdo->beginTransaction();

        $stmt = $pdo->prepare('INSERT INTO commande_fournisseur (id_fournisseur, statut) VALUES (?, ?)');
        $stmt->execute([$idFournisseur, 'brouillon']);
        $idCommande = (int)$pdo->lastInsertId();

        foreach ($lignes as $ligne) {
            $idProduit = (int)($ligne['id_produit'] ?? 0);
            $quantite = (int)($ligne['quantite'] ?? 0);
            $prixAchat = (float)($ligne['prix_achat'] ?? 0);
            if ($idProduit <= 0 || $quantite <= 0) {
                $pdo->rollBack();
                respond(['error' => 'Ligne invalide.'], 400);
            }
            $stmt = $pdo->prepare(
                'INSERT INTO ligne_commande (id_commande, id_produit, quantite, prix_achat)
                 VALUES (?, ?, ?, ?)'
            );
            $stmt->execute([$idCommande, $idProduit, $quantite, $prixAchat]);
        }

        $pdo->commit();
        journal($user['id'], 'commande_creer', "Commande #$idCommande fournisseur #$idFournisseur");
        respond(['id' => $idCommande], 201);
    }

    // Modification de statut.
    if ($method === 'PUT' || $method === 'PATCH') {
        if (!commande_peut_ecrire($user['role'])) {
            respond(['error' => 'Accès refusé.'], 403);
        }
        if (!preg_match('#/commandes\.php/(\d+)$#', $path, $m)) {
            respond(['error' => 'Identifiant requis.'], 400);
        }
        $idCommande = (int)$m[1];
        $data = read_json();
        $statut = $data['statut'] ?? '';
        if (!in_array($statut, ['brouillon', 'envoyee', 'annulee'], true)) {
            respond(['error' => 'Statut invalide.'], 400);
        }
        $stmt = db()->prepare('UPDATE commande_fournisseur SET statut = ? WHERE id = ?');
        $stmt->execute([$statut, $idCommande]);
        journal($user['id'], 'commande_modifier', "Commande #$idCommande -> $statut");
        respond(['ok' => true]);
    }

    respond(['error' => 'Méthode non autorisée.'], 405);
} catch (Throwable $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    respond(['error' => 'Erreur interne du serveur: ' . $e->getMessage()], 500);
}
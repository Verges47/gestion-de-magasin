<?php
// API Produits.
//   GET    /produits.php?search=&categorie=&fournisseur=&actif= -> liste
//   GET    /produits.php/{id}                                  -> détail
//   POST   /produits.php        { ... }                        -> création
//   PUT    /produits.php/{id}   { ... }                        -> modification
//   DELETE /produits.php/{id}                                  -> désactivation

require __DIR__ . '/config.php';
require __DIR__ . '/lib.php';
require __DIR__ . '/auth.php';
require __DIR__ . '/roles.php';

// Gérant, administrateur : droits complets. Magasinier/caissier : lecture seule.
function produit_peut_ecrire(string $role): bool
{
    return in_array($role, ['administrateur', 'gerant'], true);
}

$method = $_SERVER['REQUEST_METHOD'];
$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
// Identifiant éventuel en fin d'URL : /produits.php/123
$id = null;
if (preg_match('#/produits\.php/(\d+)$#', $path, $m)) {
    $id = (int)$m[1];
}

$user = current_user();
if (!$user) {
    respond(['error' => 'Non authentifié.'], 401);
}

try {
    if ($method === 'GET') {
        if ($id !== null) {
            $stmt = db()->prepare(
                'SELECT p.*, c.name AS categorie_nom, f.name AS fournisseur_nom,
                        s.quantite_actuelle AS stock
                   FROM produits p
                   LEFT JOIN categories c ON c.id = p.id_categorie
                   LEFT JOIN fournisseurs f ON f.id = p.id_fournisseur
                   LEFT JOIN stock s ON s.id_produit = p.id
                  WHERE p.id = ?'
            );
            $stmt->execute([$id]);
            $produit = $stmt->fetch();
            if (!$produit) {
                respond(['error' => 'Produit introuvable.'], 404);
            }

            // Codes associés.
            $stmt = db()->prepare(
                'SELECT id, valeur_code, type_code, est_principal FROM code_produit WHERE id_produit = ?'
            );
            $stmt->execute([$id]);
            $produit['codes'] = $stmt->fetchAll();

            respond(['produit' => $produit]);
        }

        // Liste avec recherche et filtres.
        $where = [];
        $params = [];
        $search = trim($_GET['search'] ?? '');
        if ($search !== '') {
            $where[] = '(p.nom LIKE ? OR p.description LIKE ?)';
            $like = '%' . $search . '%';
            $params[] = $like;
            $params[] = $like;
        }
        if (!empty($_GET['categorie'])) {
            $where[] = 'p.id_categorie = ?';
            $params[] = (int)$_GET['categorie'];
        }
        if (!empty($_GET['fournisseur'])) {
            $where[] = 'p.id_fournisseur = ?';
            $params[] = (int)$_GET['fournisseur'];
        }
        if (isset($_GET['actif']) && $_GET['actif'] !== '') {
            $where[] = 'p.actif = ?';
            $params[] = (int)$_GET['actif'];
        }

        $sql = 'SELECT p.*, c.name AS categorie_nom, f.name AS fournisseur_nom,
                       s.quantite_actuelle AS stock
                  FROM produits p
                  LEFT JOIN categories c ON c.id = p.id_categorie
                  LEFT JOIN fournisseurs f ON f.id = p.id_fournisseur
                  LEFT JOIN stock s ON s.id_produit = p.id';
        if ($where) {
            $sql .= ' WHERE ' . implode(' AND ', $where);
        }
        $sql .= ' ORDER BY p.nom ASC LIMIT 500';

        $stmt = db()->prepare($sql);
        $stmt->execute($params);
        respond(['produits' => $stmt->fetchAll()]);
    }

    if ($method === 'POST') {
        if (!produit_peut_ecrire($user['role'])) {
            respond(['error' => 'Accès refusé.'], 403);
        }
        $data = read_json();
        $nom = trim($data['nom'] ?? '');
        if ($nom === '') {
            respond(['error' => 'Le nom du produit est requis.'], 400);
        }

        $pdo = db();
        $pdo->beginTransaction();

        $stmt = $pdo->prepare(
            'INSERT INTO produits
                (nom, description, id_categorie, id_fournisseur, prix_achat, prix_vente,
                 taux_tva, unite, seuil_alerte, date_peremption)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        $stmt->execute([
            $nom,
            trim($data['description'] ?? '') ?: null,
            ($data['id_categorie'] ?? null) ?: null,
            ($data['id_fournisseur'] ?? null) ?: null,
            (float)($data['prix_achat'] ?? 0),
            (float)($data['prix_vente'] ?? 0),
            (float)($data['taux_tva'] ?? 0),
            trim($data['unite'] ?? '') ?: 'pce',
            (int)($data['seuil_alerte'] ?? 0),
            ($data['date_peremption'] ?? null) ?: null,
        ]);
        $newId = (int)$pdo->lastInsertId();

        // Stock initial.
        $stmt = $pdo->prepare(
            'INSERT INTO stock (id_produit, quantite_actuelle) VALUES (?, ?)'
        );
        $stmt->execute([$newId, (int)($data['quantite_initiale'] ?? 0)]);

        $pdo->commit();
        journal($user['id'], 'produit_creer', "Produit #$newId : $nom");
        respond(['id' => $newId], 201);
    }

    if ($method === 'PUT' || $method === 'PATCH') {
        if (!produit_peut_ecrire($user['role'])) {
            respond(['error' => 'Accès refusé.'], 403);
        }
        if ($id === null) {
            respond(['error' => 'Identifiant requis.'], 400);
        }
        $data = read_json();
        $nom = trim($data['nom'] ?? '');
        if ($nom === '') {
            respond(['error' => 'Le nom du produit est requis.'], 400);
        }

        $stmt = db()->prepare(
            'UPDATE produits SET
                nom = ?, description = ?, id_categorie = ?, id_fournisseur = ?,
                prix_achat = ?, prix_vente = ?, taux_tva = ?, unite = ?,
                seuil_alerte = ?, date_peremption = ?
              WHERE id = ?'
        );
        $stmt->execute([
            $nom,
            trim($data['description'] ?? '') ?: null,
            ($data['id_categorie'] ?? null) ?: null,
            ($data['id_fournisseur'] ?? null) ?: null,
            (float)($data['prix_achat'] ?? 0),
            (float)($data['prix_vente'] ?? 0),
            (float)($data['taux_tva'] ?? 0),
            trim($data['unite'] ?? '') ?: 'pce',
            (int)($data['seuil_alerte'] ?? 0),
            ($data['date_peremption'] ?? null) ?: null,
            $id,
        ]);

        journal($user['id'], 'produit_modifier', "Produit #$id : $nom");
        respond(['ok' => true]);
    }

    if ($method === 'DELETE') {
        if (!produit_peut_ecrire($user['role'])) {
            respond(['error' => 'Accès refusé.'], 403);
        }
        if ($id === null) {
            respond(['error' => 'Identifiant requis.'], 400);
        }
        // Un produit vendu ne peut pas être supprimé, seulement désactivé (règle de gestion).
        $stmt = db()->prepare('UPDATE produits SET actif = 0 WHERE id = ?');
        $stmt->execute([$id]);
        journal($user['id'], 'produit_desactiver', "Produit #$id");
        respond(['ok' => true]);
    }

    respond(['error' => 'Méthode non autorisée.'], 405);
} catch (Throwable $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    respond(['error' => 'Erreur interne du serveur: ' . $e->getMessage()], 500);
}

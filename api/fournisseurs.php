<?php
// API Fournisseurs.
//   GET    /fournisseurs.php          -> liste
//   POST   /fournisseurs.php  { name, phone, email, address }
//   PUT    /fournisseurs.php/{id}
//   DELETE /fournisseurs.php/{id}

require __DIR__ . '/config.php';
require __DIR__ . '/lib.php';
require __DIR__ . '/auth.php';
require __DIR__ . '/roles.php';

function fournisseur_peut_ecrire(string $role): bool
{
    return in_array($role, ['administrateur', 'gerant'], true);
}

$method = $_SERVER['REQUEST_METHOD'];
$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
$id = null;
if (preg_match('#/fournisseurs\.php/(\d+)$#', $path, $m)) {
    $id = (int)$m[1];
}

$user = current_user();
if (!$user) {
    respond(['error' => 'Non authentifié.'], 401);
}

try {
    if ($method === 'GET') {
        $stmt = db()->query(
            'SELECT f.*,
                    (SELECT COUNT(*) FROM produits p WHERE p.id_fournisseur = f.id) AS nb_produits
               FROM fournisseurs f
              ORDER BY f.name ASC'
        );
        respond(['fournisseurs' => $stmt->fetchAll()]);
    }

    if ($method === 'POST') {
        if (!fournisseur_peut_ecrire($user['role'])) {
            respond(['error' => 'Accès refusé.'], 403);
        }
        $data = read_json();
        $name = trim($data['name'] ?? '');
        if ($name === '') {
            respond(['error' => 'Le nom du fournisseur est requis.'], 400);
        }
        $stmt = db()->prepare(
            'INSERT INTO fournisseurs (name, phone, email, address) VALUES (?, ?, ?, ?)'
        );
        $stmt->execute([
            $name,
            trim($data['phone'] ?? '') ?: null,
            trim($data['email'] ?? '') ?: null,
            trim($data['address'] ?? '') ?: null,
        ]);
        $newId = (int)db()->lastInsertId();
        journal($user['id'], 'fournisseur_creer', "Fournisseur : $name");
        respond(['id' => $newId], 201);
    }

    if ($method === 'PUT' || $method === 'PATCH') {
        if (!fournisseur_peut_ecrire($user['role'])) {
            respond(['error' => 'Accès refusé.'], 403);
        }
        if ($id === null) {
            respond(['error' => 'Identifiant requis.'], 400);
        }
        $data = read_json();
        $name = trim($data['name'] ?? '');
        if ($name === '') {
            respond(['error' => 'Le nom du fournisseur est requis.'], 400);
        }
        $stmt = db()->prepare(
            'UPDATE fournisseurs SET name = ?, phone = ?, email = ?, address = ? WHERE id = ?'
        );
        $stmt->execute([
            $name,
            trim($data['phone'] ?? '') ?: null,
            trim($data['email'] ?? '') ?: null,
            trim($data['address'] ?? '') ?: null,
            $id,
        ]);
        journal($user['id'], 'fournisseur_modifier', "Fournisseur #$id : $name");
        respond(['ok' => true]);
    }

    if ($method === 'DELETE') {
        if (!fournisseur_peut_ecrire($user['role'])) {
            respond(['error' => 'Accès refusé.'], 403);
        }
        if ($id === null) {
            respond(['error' => 'Identifiant requis.'], 400);
        }
        $stmt = db()->prepare('DELETE FROM fournisseurs WHERE id = ?');
        $stmt->execute([$id]);
        journal($user['id'], 'fournisseur_supprimer', "Fournisseur #$id");
        respond(['ok' => true]);
    }

    respond(['error' => 'Méthode non autorisée.'], 405);
} catch (Throwable $e) {
    respond(['error' => 'Erreur interne du serveur.'], 500);
}

<?php
// API Catégories (avec sous-catégories via parent_id).
//   GET    /categories.php          -> liste plate avec parent
//   POST   /categories.php  { name, parent_id }
//   PUT    /categories.php/{id}
//   DELETE /categories.php/{id}

require __DIR__ . '/config.php';
require __DIR__ . '/lib.php';
require __DIR__ . '/auth.php';
require __DIR__ . '/roles.php';

function categorie_peut_ecrire(string $role): bool
{
    return in_array($role, ['administrateur', 'gerant'], true);
}

$method = $_SERVER['REQUEST_METHOD'];
$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
$id = null;
if (preg_match('#/categories\.php/(\d+)$#', $path, $m)) {
    $id = (int)$m[1];
}

$user = current_user();
if (!$user) {
    respond(['error' => 'Non authentifié.'], 401);
}

try {
    if ($method === 'GET') {
        $stmt = db()->query(
            'SELECT c.*, p.name AS parent_nom,
                    (SELECT COUNT(*) FROM produits pr WHERE pr.id_categorie = c.id) AS nb_produits
               FROM categories c
               LEFT JOIN categories p ON p.id = c.parent_id
              ORDER BY c.name ASC'
        );
        respond(['categories' => $stmt->fetchAll()]);
    }

    if ($method === 'POST') {
        if (!categorie_peut_ecrire($user['role'])) {
            respond(['error' => 'Accès refusé.'], 403);
        }
        $data = read_json();
        $name = trim($data['name'] ?? '');
        if ($name === '') {
            respond(['error' => 'Le nom de la catégorie est requis.'], 400);
        }
        $stmt = db()->prepare(
            'INSERT INTO categories (name, parent_id) VALUES (?, ?)'
        );
        $stmt->execute([$name, ($data['parent_id'] ?? null) ?: null]);
        $newId = (int)db()->lastInsertId();
        journal($user['id'], 'categorie_creer', "Catégorie : $name");
        respond(['id' => $newId], 201);
    }

    if ($method === 'PUT' || $method === 'PATCH') {
        if (!categorie_peut_ecrire($user['role'])) {
            respond(['error' => 'Accès refusé.'], 403);
        }
        if ($id === null) {
            respond(['error' => 'Identifiant requis.'], 400);
        }
        $data = read_json();
        $name = trim($data['name'] ?? '');
        if ($name === '') {
            respond(['error' => 'Le nom de la catégorie est requis.'], 400);
        }
        $parentId = ($data['parent_id'] ?? null) ?: null;
        if ($parentId !== null && (int)$parentId === $id) {
            respond(['error' => 'Une catégorie ne peut pas être sa propre parente.'], 400);
        }
        $stmt = db()->prepare('UPDATE categories SET name = ?, parent_id = ? WHERE id = ?');
        $stmt->execute([$name, $parentId, $id]);
        journal($user['id'], 'categorie_modifier', "Catégorie #$id : $name");
        respond(['ok' => true]);
    }

    if ($method === 'DELETE') {
        if (!categorie_peut_ecrire($user['role'])) {
            respond(['error' => 'Accès refusé.'], 403);
        }
        if ($id === null) {
            respond(['error' => 'Identifiant requis.'], 400);
        }
        $stmt = db()->prepare('DELETE FROM categories WHERE id = ?');
        $stmt->execute([$id]);
        journal($user['id'], 'categorie_supprimer', "Catégorie #$id");
        respond(['ok' => true]);
    }

    respond(['error' => 'Méthode non autorisée.'], 405);
} catch (Throwable $e) {
    respond(['error' => 'Erreur interne du serveur.'], 500);
}

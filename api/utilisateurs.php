<?php
// API Utilisateurs (gestion admin) et Journal des actions.
//   GET  /utilisateurs.php          -> liste des utilisateurs
//   GET  /utilisateurs.php/journal  -> journal des actions
//   POST /utilisateurs.php          -> création d'un compte (admin)
//   PUT  /utilisateurs.php/{id}     -> modification (rôle, actif, nom)
//   DELETE /utilisateurs.php/{id}   -> désactivation (ne supprime jamais)
//
// Règle : seul l'administrateur gère les utilisateurs.
// Un utilisateur ne peut pas se désactiver lui-même.

require __DIR__ . '/config.php';
require __DIR__ . '/lib.php';
require __DIR__ . '/auth.php';
require __DIR__ . '/roles.php';

const ROLES_VALIDES = ['administrateur', 'gerant', 'magasinier', 'caissier'];

$method = $_SERVER['REQUEST_METHOD'];
$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);

$user = current_user();
if (!$user) {
    respond(['error' => 'Non authentifié.'], 401);
}

try {
    // Journal des actions (visible par l'administrateur et le gérant).
    if ($method === 'GET' && preg_match('#/utilisateurs\.php/journal$#', $path)) {
        if (!in_array($user['role'], ['administrateur', 'gerant'], true)) {
            respond(['error' => 'Accès refusé.'], 403);
        }
        $limit = min((int)($_GET['limit'] ?? 100), 500);
        $stmt = db()->prepare(
            'SELECT j.*, u.name AS utilisateur_nom
               FROM journal j
               LEFT JOIN users u ON u.id = j.id_utilisateur
              ORDER BY j.date DESC
              LIMIT ' . $limit
        );
        $stmt->execute();
        respond(['journal' => $stmt->fetchAll()]);
    }

    // Désactivation.
    if ($method === 'DELETE' && preg_match('#/utilisateurs\.php/(\d+)$#', $path, $m)) {
        if ($user['role'] !== 'administrateur') {
            respond(['error' => 'Accès refusé.'], 403);
        }
        $id = (int)$m[1];
        if ($id === (int)$user['id']) {
            respond(['error' => 'Vous ne pouvez pas désactiver votre propre compte.'], 400);
        }
        $stmt = db()->prepare('UPDATE users SET active = 0 WHERE id = ?');
        $stmt->execute([$id]);
        journal($user['id'], 'utilisateur_desactiver', "Utilisateur #$id");
        respond(['ok' => true]);
    }

    // Modification.
    if (($method === 'PUT' || $method === 'PATCH') && preg_match('#/utilisateurs\.php/(\d+)$#', $path, $m)) {
        if ($user['role'] !== 'administrateur') {
            respond(['error' => 'Accès refusé.'], 403);
        }
        $id = (int)$m[1];
        $data = read_json();
        $name = trim($data['name'] ?? '');
        $role = $data['role'] ?? '';
        $active = isset($data['active']) ? (int)$data['active'] : 1;

        if ($name === '') {
            respond(['error' => 'Le nom est requis.'], 400);
        }
        if (!in_array($role, ROLES_VALIDES, true)) {
            respond(['error' => 'Rôle invalide.'], 400);
        }

        // Empêche un admin de se retirer son propre rôle (dernier admin).
        if ($id === (int)$user['id'] && $role !== 'administrateur') {
            respond(['error' => 'Vous ne pouvez pas retirer votre propre rôle administrateur.'], 400);
        }

        $stmt = db()->prepare('UPDATE users SET name = ?, role = ?, active = ? WHERE id = ?');
        $stmt->execute([$name, $role, $active, $id]);
        journal($user['id'], 'utilisateur_modifier', "Utilisateur #$id : $name ($role)");
        respond(['ok' => true]);
    }

    // Création.
    if ($method === 'POST') {
        if ($user['role'] !== 'administrateur') {
            respond(['error' => 'Accès refusé.'], 403);
        }
        $data = read_json();
        $login = trim($data['login'] ?? '');
        $name = trim($data['name'] ?? '');
        $role = $data['role'] ?? 'caissier';
        $password = (string)($data['password'] ?? '');

        if ($login === '' || $name === '') {
            respond(['error' => 'Identifiant et nom requis.'], 400);
        }
        if (strlen($password) < 8) {
            respond(['error' => 'Le mot de passe doit contenir au moins 8 caractères.'], 400);
        }
        if (!in_array($role, ROLES_VALIDES, true)) {
            respond(['error' => 'Rôle invalide.'], 400);
        }

        $stmt = db()->prepare('SELECT id FROM users WHERE login = ?');
        $stmt->execute([$login]);
        if ($stmt->fetch()) {
            respond(['error' => 'Cet identifiant est déjà utilisé.'], 409);
        }

        $hash = password_hash($password, PASSWORD_BCRYPT);
        $stmt = db()->prepare(
            'INSERT INTO users (login, password_hash, name, role) VALUES (?, ?, ?, ?)'
        );
        $stmt->execute([$login, $hash, $name, $role]);

        $newId = (int)db()->lastInsertId();
        journal($user['id'], 'utilisateur_creer', "Utilisateur $login ($role)");
        respond(['id' => $newId], 201);
    }

    // Liste.
    if ($method === 'GET') {
        if ($user['role'] !== 'administrateur') {
            respond(['error' => 'Accès refusé.'], 403);
        }
        $stmt = db()->query(
            'SELECT id, login, name, role, active, created_at, updated_at
               FROM users
              ORDER BY active DESC, name ASC'
        );
        respond(['utilisateurs' => $stmt->fetchAll()]);
    }

    respond(['error' => 'Méthode non autorisée.'], 405);
} catch (Throwable $e) {
    respond(['error' => 'Erreur interne du serveur: ' . $e->getMessage()], 500);
}

<?php
// POST /update-profile.php  { name, login, email, phone }
// Modifie le nom affiché, l'identifiant et les coordonnées de l'utilisateur connecté.

require __DIR__ . '/config.php';
require __DIR__ . '/lib.php';
require __DIR__ . '/auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(['error' => 'Méthode non autorisée'], 405);
}

$user = current_user();
if (!$user) {
    respond(['error' => 'Non authentifié.'], 401);
}

$data = read_json();
$name = trim($data['name'] ?? '');
$login = trim($data['login'] ?? '');
$email = trim($data['email'] ?? '');
$phone = trim($data['phone'] ?? '');

if ($name === '' || $login === '') {
    respond(['error' => 'Le nom et l’identifiant sont requis.'], 400);
}
if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    respond(['error' => 'Adresse email invalide.'], 400);
}

try {
    // Vérifie que l'identifiant n'est pas déjà pris par un autre compte.
    $stmt = db()->prepare('SELECT id FROM users WHERE login = ? AND id <> ?');
    $stmt->execute([$login, $user['id']]);
    if ($stmt->fetch()) {
        respond(['error' => 'Cet identifiant est déjà utilisé.'], 409);
    }

    $stmt = db()->prepare(
        'UPDATE users SET name = ?, login = ?, email = ?, phone = ? WHERE id = ?'
    );
    $stmt->execute([
        $name,
        $login,
        $email !== '' ? $email : null,
        $phone !== '' ? $phone : null,
        $user['id'],
    ]);

    respond([
        'ok' => true,
        'user' => [
            'id' => (int)$user['id'],
            'login' => $login,
            'name' => $name,
            'email' => $email !== '' ? $email : null,
            'phone' => $phone !== '' ? $phone : null,
            'role' => $user['role'],
        ],
    ]);
} catch (Throwable $e) {
    respond(['error' => 'Erreur interne du serveur.'], 500);
}
<?php
// POST /login.php  { login, password }
// Renvoie { token, user } ou une erreur 401.

require __DIR__ . '/config.php';
require __DIR__ . '/lib.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(['error' => 'Méthode non autorisée'], 405);
}

$data = read_json();
$login = trim($data['login'] ?? '');
$password = (string)($data['password'] ?? '');

if ($login === '' || $password === '') {
    respond(['error' => 'Identifiant et mot de passe requis.'], 400);
}

try {
    $stmt = db()->prepare(
        'SELECT id, login, password_hash, name, email, phone, role, active FROM users WHERE login = ?'
    );
    $stmt->execute([$login]);
    $user = $stmt->fetch();

    if (!$user || !password_verify($password, $user['password_hash'])) {
        respond(['error' => 'Identifiant ou mot de passe incorrect.'], 401);
    }

    if ((int)$user['active'] !== 1) {
        respond(['error' => 'Ce compte est désactivé.'], 403);
    }

    // Crée une session.
    $token = generate_token();
    $expires = (new DateTime('now', new DateTimeZone('UTC')))
        ->add(new DateInterval('PT' . TOKEN_TTL_HOURS . 'H'))
        ->format('Y-m-d H:i:s');

    $stmt = db()->prepare(
        'INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)'
    );
    $stmt->execute([$token, $user['id'], $expires]);

    respond([
        'token' => $token,
        'user' => [
            'id' => (int)$user['id'],
            'login' => $user['login'],
            'name' => $user['name'],
            'email' => $user['email'],
            'phone' => $user['phone'],
            'role' => $user['role'],
        ],
    ]);
} catch (Throwable $e) {
    respond(['error' => 'Erreur interne du serveur.'], 500);
}

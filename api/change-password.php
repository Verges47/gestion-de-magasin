<?php
// POST /change-password.php  { current_password, new_password }
// Modifie le mot de passe de l'utilisateur connecté.

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
$current = (string)($data['current_password'] ?? '');
$new = (string)($data['new_password'] ?? '');

if (strlen($new) < 8) {
    respond(['error' => 'Le nouveau mot de passe doit contenir au moins 8 caractères.'], 400);
}

try {
    // Re-vérifie le mot de passe courant à partir de la base.
    $stmt = db()->prepare('SELECT password_hash FROM users WHERE id = ?');
    $stmt->execute([$user['id']]);
    $row = $stmt->fetch();

    if (!$row || !password_verify($current, $row['password_hash'])) {
        respond(['error' => 'Mot de passe actuel incorrect.'], 400);
    }

    $hash = password_hash($new, PASSWORD_BCRYPT);
    $stmt = db()->prepare('UPDATE users SET password_hash = ? WHERE id = ?');
    $stmt->execute([$hash, $user['id']]);

    respond(['ok' => true]);
} catch (Throwable $e) {
    respond(['error' => 'Erreur interne du serveur.'], 500);
}
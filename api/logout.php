<?php
// POST /logout.php  -> invalide la session courante.

require __DIR__ . '/config.php';
require __DIR__ . '/lib.php';
require __DIR__ . '/auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(['error' => 'Méthode non autorisée'], 405);
}

$auth = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
if (preg_match('/^Bearer\s+(\S+)$/i', $auth, $m)) {
    try {
        $stmt = db()->prepare('DELETE FROM sessions WHERE token = ?');
        $stmt->execute([$m[1]]);
    } catch (Throwable $e) {
        // On ignore l'échec de suppression : la session reste expirante.
    }
}

respond(['ok' => true]);
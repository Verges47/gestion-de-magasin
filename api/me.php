<?php
// GET /me.php -> renvoie l'utilisateur courant (protégé).

require __DIR__ . '/config.php';
require __DIR__ . '/lib.php';
require __DIR__ . '/auth.php';

$user = current_user();
if (!$user) {
    respond(['error' => 'Non authentifié.'], 401);
}

respond(['user' => $user]);
<?php
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$file = __DIR__ . $path;

// Fichier existant (asset ou script PHP de l'API) : le serveur s'en charge.
if ($path !== '/' && is_file($file)) {
    return false;
}

// Route d'API inconnue.
if (strpos($path, '/api/') === 0) {
    http_response_code(404);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Route introuvable.']);
    return;
}

// Toute autre route : l'application React.
readfile(__DIR__ . '/index.html');

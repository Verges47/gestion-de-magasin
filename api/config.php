<?php
// Configuration centrale de l'API StockScan.
// Adaptez DB_HOST / DB_USER / DB_PASS à votre installation XAMPP (MariaDB).

const DB_HOST = getenv('DB_HOST') ?: '127.0.0.1';
const DB_PORT = (int)(getenv('DB_PORT') ?: 3306);
const DB_NAME = getenv('DB_NAME') ?: 'stockscan';
const DB_USER = getenv('DB_USER') ?: 'root';
const DB_PASS = getenv('DB_PASS') ?: '';

// Durée de validité d'un jeton d'authentification (en heures).
const TOKEN_TTL_HOURS = 24;

// En CLI (install.php), pas de contexte HTTP : on ignore les en-têtes CORS.
if (PHP_SAPI !== 'cli') {
    header('Content-Type: application/json; charset=utf-8');
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');

    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}

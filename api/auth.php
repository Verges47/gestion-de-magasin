<?php
// Résout l'utilisateur authentifié à partir de l'en-tête "Authorization: Bearer <token>".
// Retourne le tableau utilisateur ou null si le jeton est absent/invalide/expiré.
//
// Sous certains SAPI (FastCGI/PHP-FPM), Apache ne propage pas HTTP_AUTHORIZATION
// vers $_SERVER : on le récupère alors depuis les en-têtes de requête ou la
// variable REDIRECT_HTTP_AUTHORIZATION.

function bearer_token(): ?string
{
    $auth = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';

    if ($auth === '') {
        // Repli pour FastCGI où l'en-tête Authorization est ignoré.
        if (function_exists('getallheaders')) {
            $headers = getallheaders();
            foreach ($headers as $k => $v) {
                if (strcasecmp($k, 'Authorization') === 0) {
                    $auth = $v;
                    break;
                }
            }
        }
    }

    if (preg_match('/^Bearer\s+(\S+)$/i', (string)$auth, $m)) {
        return $m[1];
    }
    return null;
}

function current_user(): ?array
{
    $token = bearer_token();
    if ($token === null) {
        return null;
    }

    try {
        $stmt = db()->prepare(
            'SELECT u.id, u.login, u.name, u.email, u.phone, u.role, u.active
               FROM sessions s
               JOIN users u ON u.id = s.user_id
              WHERE s.token = ? AND s.expires_at > UTC_TIMESTAMP()'
        );
        $stmt->execute([$token]);
        $row = $stmt->fetch();
        return $row ?: null;
    } catch (Throwable $e) {
        return null;
    }
}

<?php
// Autorisation par rôle. Vérifie que l'utilisateur authentifié possède l'un
// des rôles demandés, sinon répond 403 et termine.
//    require_role('administrateur', 'gerant');

function require_role(string ...$allowed): array
{
    $user = current_user();
    if (!$user) {
        respond(['error' => 'Non authentifié.'], 401);
    }
    if (!in_array($user['role'], $allowed, true)) {
        respond(['error' => 'Accès refusé.'], 403);
    }
    return $user;
}

// Journalise une action (best effort, ne doit pas bloquer la requête).
function journal(int $userId, string $action, ?string $details = null): void
{
    try {
        $stmt = db()->prepare(
            'INSERT INTO journal (id_utilisateur, action, details) VALUES (?, ?, ?)'
        );
        $stmt->execute([$userId, $action, $details]);
    } catch (Throwable $e) {
        // On ignore : le journal ne doit jamais interrompre l'action principale.
    }
}
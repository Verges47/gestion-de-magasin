<?php
// API Codes produits (code-barres / QR).
//   GET  /codes.php?produit={id}       -> codes d'un produit
//   GET  /codes.php/scan?code={valeur} -> fiche produit par scan (F8)
//   POST /codes.php                     -> associer un code existant (F5) ou générer (F6)
//   DELETE /codes.php/{id}              -> supprimer un code
//
// Règles de gestion :
//   - Un code est unique dans toute la base (contrainte UNIQUE, F9).
//   - Les doublons sont refusés avec un code 409 explicite.

require __DIR__ . '/config.php';
require __DIR__ . '/lib.php';
require __DIR__ . '/auth.php';
require __DIR__ . '/roles.php';

// Gérant et administrateur gèrent les codes ; caissier/magasinier scannent (lecture).
function code_peut_ecrire(string $role): bool
{
    return in_array($role, ['administrateur', 'gerant'], true);
}

// Valide le format selon la symbologie. Retourne vrai si plausible.
function code_valide(string $valeur, string $type): bool
{
    $valeur = trim($valeur);
    if ($valeur === '') {
        return false;
    }
    return match ($type) {
        'EAN13' => (bool)preg_match('/^\d{13}$/', $valeur),
        'UPC' => (bool)preg_match('/^\d{12}$/', $valeur),
        'CODE128', 'QR' => true, // longueur libre (code interne, QR)
        default => false,
    };
}

// Génère un code interne unique (Code 128). Format : IN + 12 chiffres.
function generer_code_interne(PDO $pdo): string
{
    do {
        $code = 'IN' . str_pad((string)random_int(0, 999999999999), 12, '0', STR_PAD_LEFT);
        $stmt = $pdo->prepare('SELECT 1 FROM code_produit WHERE valeur_code = ?');
        $stmt->execute([$code]);
        $existe = (bool)$stmt->fetch();
    } while ($existe);
    return $code;
}

$method = $_SERVER['REQUEST_METHOD'];
$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);

$user = current_user();
if (!$user) {
    respond(['error' => 'Non authentifié.'], 401);
}

try {
    // Scan : retrouve le produit par code (F8).
    if ($method === 'GET' && preg_match('#/codes\.php/scan$#', $path)) {
        $valeur = trim($_GET['code'] ?? '');
        if ($valeur === '') {
            respond(['error' => 'Code requis.'], 400);
        }
        $stmt = db()->prepare(
            'SELECT p.*, c.id AS id_code, c.valeur_code, c.type_code,
                    s.quantite_actuelle AS stock
               FROM code_produit c
               JOIN produits p ON p.id = c.id_produit
               LEFT JOIN stock s ON s.id_produit = p.id
              WHERE c.valeur_code = ?'
        );
        $stmt->execute([$valeur]);
        $produit = $stmt->fetch();
        if (!$produit) {
            respond(['error' => 'Aucun produit pour ce code.'], 404);
        }
        respond(['produit' => $produit]);
    }

    // Suppression d'un code.
    if ($method === 'DELETE' && preg_match('#/codes\.php/(\d+)$#', $path, $m)) {
        if (!code_peut_ecrire($user['role'])) {
            respond(['error' => 'Accès refusé.'], 403);
        }
        $idCode = (int)$m[1];
        $stmt = db()->prepare('DELETE FROM code_produit WHERE id = ?');
        $stmt->execute([$idCode]);
        journal($user['id'], 'code_supprimer', "Code #$idCode");
        respond(['ok' => true]);
    }

    // Liste des codes d'un produit.
    if ($method === 'GET') {
        $idProduit = (int)($_GET['produit'] ?? 0);
        if ($idProduit <= 0) {
            respond(['error' => 'Paramètre produit requis.'], 400);
        }
        $stmt = db()->prepare(
            'SELECT id, valeur_code, type_code, est_principal
               FROM code_produit
              WHERE id_produit = ?
              ORDER BY est_principal DESC, id ASC'
        );
        $stmt->execute([$idProduit]);
        respond(['codes' => $stmt->fetchAll()]);
    }

    // Création : association d'un code existant ou génération d'un code interne.
    if ($method === 'POST') {
        if (!code_peut_ecrire($user['role'])) {
            respond(['error' => 'Accès refusé.'], 403);
        }
        $data = read_json();
        $idProduit = (int)($data['id_produit'] ?? 0);
        if ($idProduit <= 0) {
            respond(['error' => 'Produit requis.'], 400);
        }

        // Vérifie que le produit existe.
        $stmt = db()->prepare('SELECT id, nom FROM produits WHERE id = ?');
        $stmt->execute([$idProduit]);
        $produit = $stmt->fetch();
        if (!$produit) {
            respond(['error' => 'Produit introuvable.'], 404);
        }

        $type = $data['type_code'] ?? 'CODE128';
        $valeur = trim($data['valeur_code'] ?? '');

        // Génération automatique si aucune valeur fournie (F6).
        if ($valeur === '' && isset($data['generer'])) {
            $valeur = generer_code_interne(db());
            $type = 'CODE128';
        }

        if (!code_valide($valeur, $type)) {
            respond(['error' => 'Code invalide pour la symbologie choisie.'], 400);
        }

        // Détection de doublon (F9). La contrainte UNIQUE sert de garde-fou final.
        $stmt = db()->prepare('SELECT 1 FROM code_produit WHERE valeur_code = ?');
        $stmt->execute([$valeur]);
        if ($stmt->fetch()) {
            respond(['error' => 'Ce code est déjà attribué à un produit.'], 409);
        }

        $stmt = db()->prepare(
            'INSERT INTO code_produit (id_produit, valeur_code, type_code, est_principal)
             VALUES (?, ?, ?, ?)'
        );
        // Premier code du produit -> principal.
        $stmt = db()->prepare('SELECT COUNT(*) AS n FROM code_produit WHERE id_produit = ?');
        $stmt->execute([$idProduit]);
        $estPrincipal = (int)$stmt->fetch()['n'] === 0 ? 1 : 0;

        $stmt = db()->prepare(
            'INSERT INTO code_produit (id_produit, valeur_code, type_code, est_principal)
             VALUES (?, ?, ?, ?)'
        );
        $stmt->execute([$idProduit, $valeur, $type, $estPrincipal]);

        $newId = (int)db()->lastInsertId();
        journal($user['id'], 'code_ajouter', "Produit #$idProduit : $type $valeur");
        respond(['id' => $newId, 'valeur_code' => $valeur], 201);
    }

    respond(['error' => 'Méthode non autorisée.'], 405);
} catch (PDOException $e) {
    // Violation de contrainte UNIQUE -> doublon.
    if ($e->getCode() === '23000') {
        respond(['error' => 'Ce code est déjà attribué à un produit.'], 409);
    }
    respond(['error' => 'Erreur interne du serveur: ' . $e->getMessage()], 500);
} catch (Throwable $e) {
    respond(['error' => 'Erreur interne du serveur: ' . $e->getMessage()], 500);
}

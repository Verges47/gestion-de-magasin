<?php
if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit('Interdit.');
}
// Script d'installation : crée la base, les tables et un premier compte
// administrateur. À exécuter une seule fois (supprime la base existante).
//
//   php install.php        -> admin / Admin@123
//   php install.php <mdp>  -> admin / <mdp>

require __DIR__ . '/config.php';
require __DIR__ . '/lib.php';

try {
    // Connexion sans base sélectionnée pour créer la base.
    $pdo = new PDO(
        sprintf('mysql:host=%s;port=%d;charset=utf8mb4', DB_HOST, DB_PORT),
        DB_USER,
        DB_PASS,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );

    $pdo->exec('DROP DATABASE IF EXISTS `' . DB_NAME . '`');
    $pdo->exec('CREATE DATABASE `' . DB_NAME . '` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
    $pdo->exec('USE `' . DB_NAME . '`');

    // --- Utilisateurs et sécurité -------------------------------------------------
    $pdo->exec('CREATE TABLE users (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        login VARCHAR(64) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(128) NOT NULL,
        email VARCHAR(128) NULL,
        phone VARCHAR(32) NULL,
        role VARCHAR(32) NOT NULL DEFAULT \'caissier\',
        active TINYINT(1) NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');

    $pdo->exec('CREATE TABLE sessions (
        token VARCHAR(64) PRIMARY KEY,
        user_id INT UNSIGNED NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');

    // --- Catalogue ----------------------------------------------------------------
    $pdo->exec('CREATE TABLE categories (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(128) NOT NULL,
        parent_id INT UNSIGNED NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_categories_parent FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');

    $pdo->exec('CREATE TABLE fournisseurs (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(128) NOT NULL,
        phone VARCHAR(32) NULL,
        email VARCHAR(128) NULL,
        address VARCHAR(255) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');

    $pdo->exec('CREATE TABLE produits (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        nom VARCHAR(160) NOT NULL,
        description TEXT NULL,
        id_categorie INT UNSIGNED NULL,
        id_fournisseur INT UNSIGNED NULL,
        prix_achat DECIMAL(12,2) NOT NULL DEFAULT 0,
        prix_vente DECIMAL(12,2) NOT NULL DEFAULT 0,
        taux_tva DECIMAL(5,2) NOT NULL DEFAULT 0,
        unite VARCHAR(32) NOT NULL DEFAULT \'pce\',
        seuil_alerte INT NOT NULL DEFAULT 0,
        date_peremption DATE NULL,
        actif TINYINT(1) NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_produits_categorie FOREIGN KEY (id_categorie) REFERENCES categories(id) ON DELETE SET NULL,
        CONSTRAINT fk_produits_fournisseur FOREIGN KEY (id_fournisseur) REFERENCES fournisseurs(id) ON DELETE SET NULL,
        INDEX idx_produits_nom (nom),
        INDEX idx_produits_actif (actif)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');

    $pdo->exec('CREATE TABLE code_produit (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        id_produit INT UNSIGNED NOT NULL,
        valeur_code VARCHAR(64) NOT NULL,
        type_code VARCHAR(16) NOT NULL DEFAULT \'CODE128\',
        est_principal TINYINT(1) NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_codeproduit_produit FOREIGN KEY (id_produit) REFERENCES produits(id) ON DELETE CASCADE,
        UNIQUE KEY uq_code_valeur (valeur_code),
        INDEX idx_code_produit (id_produit)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');

    // --- Stock --------------------------------------------------------------------
    $pdo->exec('CREATE TABLE stock (
        id_produit INT UNSIGNED PRIMARY KEY,
        quantite_actuelle INT NOT NULL DEFAULT 0,
        date_maj DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_stock_produit FOREIGN KEY (id_produit) REFERENCES produits(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');

    $pdo->exec('CREATE TABLE mouvement_stock (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        id_produit INT UNSIGNED NOT NULL,
        type ENUM(\'entree\',\'sortie\',\'ajustement\') NOT NULL,
        quantite INT NOT NULL,
        motif VARCHAR(255) NULL,
        id_utilisateur INT UNSIGNED NULL,
        date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_mouvement_produit FOREIGN KEY (id_produit) REFERENCES produits(id) ON DELETE CASCADE,
        CONSTRAINT fk_mouvement_user FOREIGN KEY (id_utilisateur) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_mouvement_date (date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');

    // --- Ventes -------------------------------------------------------------------
    $pdo->exec('CREATE TABLE ventes (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        id_utilisateur INT UNSIGNED NULL,
        total_ht DECIMAL(12,2) NOT NULL DEFAULT 0,
        total_tva DECIMAL(12,2) NOT NULL DEFAULT 0,
        total_ttc DECIMAL(12,2) NOT NULL DEFAULT 0,
        mode_paiement VARCHAR(32) NULL,
        statut ENUM(\'validee\',\'annulee\',\'remboursee\') NOT NULL DEFAULT \'validee\',
        CONSTRAINT fk_ventes_user FOREIGN KEY (id_utilisateur) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_ventes_date (date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');

    $pdo->exec('CREATE TABLE ligne_vente (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        id_vente INT UNSIGNED NOT NULL,
        id_produit INT UNSIGNED NOT NULL,
        quantite INT NOT NULL,
        prix_unitaire DECIMAL(12,2) NOT NULL,
        remise DECIMAL(12,2) NOT NULL DEFAULT 0,
        CONSTRAINT fk_lignevente_vente FOREIGN KEY (id_vente) REFERENCES ventes(id) ON DELETE CASCADE,
        CONSTRAINT fk_lignevente_produit FOREIGN KEY (id_produit) REFERENCES produits(id) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');

    // --- Achats / commandes fournisseur -------------------------------------------
    $pdo->exec('CREATE TABLE commande_fournisseur (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        id_fournisseur INT UNSIGNED NOT NULL,
        date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        statut ENUM(\'brouillon\',\'envoyee\',\'recue\',\'annulee\') NOT NULL DEFAULT \'brouillon\',
        CONSTRAINT fk_commande_fournisseur FOREIGN KEY (id_fournisseur) REFERENCES fournisseurs(id) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');

    $pdo->exec('CREATE TABLE ligne_commande (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        id_commande INT UNSIGNED NOT NULL,
        id_produit INT UNSIGNED NOT NULL,
        quantite INT NOT NULL,
        prix_achat DECIMAL(12,2) NOT NULL DEFAULT 0,
        CONSTRAINT fk_lignecommande_commande FOREIGN KEY (id_commande) REFERENCES commande_fournisseur(id) ON DELETE CASCADE,
        CONSTRAINT fk_lignecommande_produit FOREIGN KEY (id_produit) REFERENCES produits(id) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');

    // --- Journal des actions ------------------------------------------------------
    $pdo->exec('CREATE TABLE journal (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        id_utilisateur INT UNSIGNED NULL,
        action VARCHAR(255) NOT NULL,
        details TEXT NULL,
        date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_journal_user FOREIGN KEY (id_utilisateur) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_journal_date (date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');

    // --- Inventaire (F13) ---------------------------------------------------------
    // Session d'inventaire : scan de chaque produit et calcul des écarts.
    $pdo->exec('CREATE TABLE inventaire (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        id_utilisateur INT UNSIGNED NULL,
        statut ENUM(\'en_cours\',\'cloture\') NOT NULL DEFAULT \'en_cours\',
        CONSTRAINT fk_inventaire_user FOREIGN KEY (id_utilisateur) REFERENCES users(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');

    $pdo->exec('CREATE TABLE ligne_inventaire (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        id_inventaire INT UNSIGNED NOT NULL,
        id_produit INT UNSIGNED NOT NULL,
        quantite_attendu INT NOT NULL DEFAULT 0,
        quantite_comptee INT NOT NULL DEFAULT 0,
        CONSTRAINT fk_ligneinventaire_inventaire FOREIGN KEY (id_inventaire) REFERENCES inventaire(id) ON DELETE CASCADE,
        CONSTRAINT fk_ligneinventaire_produit FOREIGN KEY (id_produit) REFERENCES produits(id) ON DELETE CASCADE,
        UNIQUE KEY uq_inventaire_produit (id_inventaire, id_produit)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');

    // Premier compte administrateur.
    $password = isset($argv[1]) && $argv[1] !== '' ? $argv[1] : 'Admin@123';
    $hash = password_hash($password, PASSWORD_BCRYPT);
    $stmt = $pdo->prepare(
        'INSERT INTO users (login, password_hash, name, role) VALUES (?, ?, ?, ?)'
    );
    $stmt->execute(['admin', $hash, 'Administrateur', 'administrateur']);

    echo "Installation terminée.\n";
    echo "Base: " . DB_NAME . "\n";
    echo "Compte: admin / $password\n";
} catch (Throwable $e) {
    fwrite(STDERR, 'Erreur : ' . $e->getMessage() . "\n");
    exit(1);
}

<?php
// Étiquettes produits (F7) : génère un PDF d'étiquettes (code + nom + prix).
//   GET /etiquettes.php?produits=1,2,3   -> étiquettes pour plusieurs produits
//   GET /etiquettes.php?produits=1       -> étiquette d'un produit
//
// Chaque étiquette est un encadré A6-like disposé en grille sur une page A4.
// Le code-barres est rendu en texte clair (la valeur du code), exploitable par
// un scanner en re-saisie, et lisible par une imprimante d'étiquettes standard.

require __DIR__ . '/config.php';
require __DIR__ . '/lib.php';
require __DIR__ . '/auth.php';
require __DIR__ . '/pdf.php';

function _etq_escape(string $s): string
{
    $s = @iconv('UTF-8', 'ISO-8859-1//TRANSLIT', $s);
    if ($s === false) {
        $s = preg_replace('/[^\x20-\x7E]/', '?', $s);
    }
    return str_replace(['\\', '(', ')'], ['\\\\', '\\(', '\\)'], (string)$s);
}

$method = $_SERVER['REQUEST_METHOD'];
if ($method !== 'GET') {
    respond(['error' => 'Méthode non autorisée.'], 405);
}

$user = current_user();
if (!$user) {
    respond(['error' => 'Non authentifié.'], 401);
}

$ids = array_filter(array_map('intval', explode(',', $_GET['produits'] ?? '')));
if (!$ids) {
    respond(['error' => 'Paramètre produits requis.'], 400);
}

try {
    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    $stmt = db()->prepare(
        "SELECT p.id, p.nom, p.prix_vente,
                (SELECT c.valeur_code FROM code_produit c
                  WHERE c.id_produit = p.id ORDER BY c.est_principal DESC, c.id ASC LIMIT 1) AS code
           FROM produits p
          WHERE p.id IN ($placeholders)"
    );
    $stmt->execute($ids);
    $produits = $stmt->fetchAll();

    if (!$produits) {
        respond(['error' => 'Aucun produit trouvé.'], 404);
    }

    // Dimensions A4.
    $pageW = 595.0;
    $pageH = 842.0;
    $margin = 24.0;
    $cols = 3;
    $rows = 6;
    $cellW = ($pageW - 2 * $margin) / $cols;
    $cellH = ($pageH - 2 * $margin) / $rows;

    $labels = [];
    foreach ($produits as $p) {
        $code = $p['code'] ?: '(sans code)';
        $nom = $p['nom'];
        $prix = number_format((float)$p['prix_vente'], 2, ',', ' ') . ' FCFA';
        $labels[] = [$nom, $code, $prix];
    }

    // Construit les flux de contenu, une page par grille complète (18 étiquettes).
    $perPage = $cols * $rows;
    $pages = array_chunk($labels, $perPage);
    if (!$pages) {
        $pages = [[]];
    }

    $streams = [];
    foreach ($pages as $chunk) {
        $s = '';
        $idx = 0;
        foreach ($chunk as $label) {
            $col = $idx % $cols;
            $row = floor($idx / $cols);
            $x0 = $margin + $col * $cellW;
            $yTop = $pageH - $margin - $row * $cellH;

            // Cadre.
            $s .= "0.5 w 0 G\n{$x0} {$yTop} " . $cellW . " " . (-$cellH) . " re S\n";

            // Nom (centre).
            $s .= "BT /F2 11 Tf " . ($x0 + 6) . " " . ($yTop - 24) . " Td (" . _etq_escape($label[0]) . ") Tj ET\n";

            // Code (grand, au centre).
            $s .= "BT /F1 14 Tf " . ($x0 + 6) . " " . ($yTop - 50) . " Td (" . _etq_escape($label[1]) . ") Tj ET\n";

            // Prix (bas).
            $s .= "BT /F2 10 Tf " . ($x0 + 6) . " " . ($yTop - $cellH + 16) . " Td (" . _etq_escape($label[2]) . ") Tj ET\n";

            $idx++;
        }
        $streams[] = $s;
    }

    $nbPages = count($streams);
    $fontObj = 3;
    $fontBoldObj = 4;
    $pageObjStart = 5;
    $contentObjStart = $pageObjStart + $nbPages;

    $objects = [];
    $objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
    $kids = [];
    for ($p = 0; $p < $nbPages; $p++) {
        $kids[] = ($pageObjStart + $p) . ' 0 R';
    }
    $objects[2] = "<< /Type /Pages /Kids [" . implode(' ', $kids) . "] /Count $nbPages >>";
    $objects[$fontObj] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
    $objects[$fontBoldObj] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>";

    for ($p = 0; $p < $nbPages; $p++) {
        $pageId = $pageObjStart + $p;
        $contentId = $contentObjStart + $p;
        $objects[$pageId] = "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 $pageW $pageH] /Contents $contentId 0 R /Resources << /Font << /F1 $fontObj 0 R /F2 $fontBoldObj 0 R >> >> >>";
    }
    for ($p = 0; $p < $nbPages; $p++) {
        $content = $streams[$p];
        $objects[$contentObjStart + $p] = "<< /Length " . strlen($content) . " >>\nstream\n" . $content . "\nendstream";
    }

    $pdf = "%PDF-1.4\n";
    $offsets = [];
    foreach ($objects as $id => $obj) {
        $offsets[$id] = strlen($pdf);
        $pdf .= "$id 0 obj\n$obj\nendobj\n";
    }
    $xrefPos = strlen($pdf);
    $count = count($objects) + 1;
    $pdf .= "xref\n0 $count\n";
    $pdf .= "0000000000 65535 f \n";
    for ($id = 1; $id <= count($objects); $id++) {
        $pdf .= sprintf("%010d 00000 n \n", $offsets[$id]);
    }
    $pdf .= "trailer\n<< /Size $count /Root 1 0 R >>\n";
    $pdf .= "startxref\n$xrefPos\n%%EOF\n";

    header('Content-Type: application/pdf');
    header('Content-Disposition: attachment; filename="etiquettes.pdf"');
    echo $pdf;
    exit;
} catch (Throwable $e) {
    respond(['error' => 'Erreur interne du serveur: ' . $e->getMessage()], 500);
}
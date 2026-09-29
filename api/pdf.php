<?php
// Générateur PDF minimal sans dépendance externe (format PDF brut, vectoriel).
// Produit un PDF multi-pages à partir d'un tableau de colonnes/lignes.
// Ne nécessite ni GD, ni bibliothèque tierce. Encodage Latin-1 (accents translittérés).

function _pdf_escape(string $s): string
{
    return str_replace(['\\', '(', ')'], ['\\\\', '\\(', '\\)'], $s);
}

function _pdf_text(string $s): string
{
    $s = @iconv('UTF-8', 'ISO-8859-1//TRANSLIT', $s);
    if ($s === false) {
        $s = preg_replace('/[^\x20-\x7E]/', '?', $s);
    }
    return _pdf_escape((string)$s);
}

// Colonnes : tableau associatif label => largeur relative (somme = 100).
function pdf_table(string $titre, array $colonnes, array $lignes, string $filename = 'document.pdf'): void
{
    $pageW = 595.0;
    $pageH = 842.0;
    $margin = 40.0;
    $contentW = $pageW - 2 * $margin;
    $rowH = 18.0;

    // Largeurs absolues en points.
    $totalWeight = array_sum($colonnes);
    $colW = [];
    foreach ($colonnes as $weight) {
        $colW[] = $contentW * ($weight / $totalWeight);
    }

    // Découpe des lignes en pages.
    $maxRowsPerPage = (int)floor(($pageH - 2 * $margin - 60) / $rowH);
    $pages = [];
    $chunks = array_chunk($lignes, max(1, $maxRowsPerPage));
    if (count($chunks) === 0) {
        $chunks = [[]];
    }
    foreach ($chunks as $chunk) {
        $pages[] = $chunk;
    }

    // Construction du flux de contenu de chaque page.
    $streams = [];
    $labels = array_keys($colonnes);

    foreach ($pages as $idx => $rows) {
        $s = "BT /F2 16 Tf {$margin} 780 Td (" . _pdf_text($titre) . ") Tj ET\n";

        // En-têtes.
        $s .= "BT /F2 9 Tf {$margin} 750 Td (";
        $parts = [];
        foreach ($labels as $i => $label) {
            $parts[] = _pdf_text($label);
        }
        $s .= implode("        ", $parts) . ") Tj ET\n";
        $s .= "0.4 w 0.8 G\n{$margin} 744 m " . ($pageW - $margin) . " 744 l S\n";

        // Lignes.
        $y = 724.0;
        foreach ($rows as $row) {
            $s .= "BT /F1 8 Tf {$margin} {$y} Td (";
            $cells = [];
            foreach ($labels as $i => $label) {
                $cells[] = _pdf_text((string)($row[$i] ?? ''));
            }
            $s .= implode("        ", $cells) . ") Tj ET\n";
            $y -= $rowH;
        }

        // Pied de page.
        $s .= "BT /F1 8 Tf {$margin} 30 Td (Page " . ($idx + 1) . "/" . count($pages) . ") Tj ET\n";
        $streams[] = $s;
    }

    $nbPages = count($streams);

    // Objets : 1 catalogue, 2 pages, 3 Helvetica, 4 Helvetica-Bold, puis pages, puis contenus.
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
        $contentId = $contentObjStart + $p;
        $content = $streams[$p];
        $objects[$contentId] = "<< /Length " . strlen($content) . " >>\nstream\n" . $content . "\nendstream";
    }

    // Assemblage.
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
    header('Content-Disposition: attachment; filename="' . $filename . '"');
    echo $pdf;
    exit;
}
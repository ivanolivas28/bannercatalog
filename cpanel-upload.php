<?php
/**
 * Script para subir archivos de catálogo desde tienda.eqkor.mx
 * Subir a: eqkor.mx/catalog-data/upload.php
 * Protegido por secret definido en CPANEL_UPLOAD_SECRET (variable de entorno Vercel)
 */

$secret = $_POST['secret'] ?? $_GET['secret'] ?? '';
$expectedSecret = 'eqkor-catalog-2026'; // <-- cambiar por el mismo valor que pongas en Vercel

if ($secret !== $expectedSecret) {
    http_response_code(403);
    echo json_encode(['error' => 'Forbidden']);
    exit;
}

$allowed = [
    'mx'          => ['TFG - Inventario General (1).csv'],
    'usa'         => ['MFG - Inventario General.csv'],
    'chn'         => ['NFG - Inventario General.csv'],
    'banner'      => ['banner_pricelist_download_20260505.txt'],
    'sourcing'    => ['Sourcing Item Jun 26.csv'],
    'wago-stock'  => ['wago-stock.json'],
    'remate'      => ['REMATE STOCK BANNER VENTAS.xlsx'],
];

$type = $_POST['type'] ?? '';

if (!isset($allowed[$type])) {
    http_response_code(400);
    echo json_encode(['error' => 'Tipo inválido']);
    exit;
}

// For wago-stock, accept raw JSON body instead of file upload
if ($type === 'wago-stock') {
    $json = file_get_contents('php://input');
    if (!$json) {
        // Try POST body
        $json = $_POST['data'] ?? '';
    }
    if (!$json) {
        http_response_code(400);
        echo json_encode(['error' => 'Sin datos']);
        exit;
    }
    $filename = __DIR__ . '/wago-stock.json';
    file_put_contents($filename, $json);
    echo json_encode(['ok' => true, 'file' => 'wago-stock.json']);
    exit;
}

// File upload
if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
    http_response_code(400);
    echo json_encode(['error' => 'Sin archivo o error en upload']);
    exit;
}

$targetName = $allowed[$type][0];
$targetPath = __DIR__ . '/' . $targetName;

if (move_uploaded_file($_FILES['file']['tmp_name'], $targetPath)) {
    echo json_encode(['ok' => true, 'file' => $targetName]);
} else {
    http_response_code(500);
    echo json_encode(['error' => 'No se pudo guardar el archivo']);
}

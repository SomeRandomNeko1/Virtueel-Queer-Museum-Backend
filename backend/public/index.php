<?php
function cors(): void {
    if (isset($_SERVER['HTTP_ORIGIN'])) {
        header("Access-Control-Allow-Origin: {$_SERVER['HTTP_ORIGIN']}");
    } else {
        header("Access-Control-Allow-Origin: *");
    }
    header('Access-Control-Allow-Credentials: true');
    header('Access-Control-Max-Age: 86400');

    if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
        if (isset($_SERVER['HTTP_ACCESS_CONTROL_REQUEST_METHOD']))
            header("Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS");
        if (isset($_SERVER['HTTP_ACCESS_CONTROL_REQUEST_HEADERS']))
            header("Access-Control-Allow-Headers: {$_SERVER['HTTP_ACCESS_CONTROL_REQUEST_HEADERS']}");
        http_response_code(204);
        exit;
    }
}

cors();

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');

require_once dirname(__DIR__) . "/src/config.php";
$UPLOAD_BASE_URL = $_ENV['UPLOAD_BASE_URL'] ?? 'http://10.120.5.132:8000';

function readJsonBody(): array
{
    $raw = file_get_contents('php://input');
    if (!$raw) return [];
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
}

function base64UrlEncode(string $data): string
{
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function base64UrlDecode(string $data): string|false
{
    $remainder = strlen($data) % 4;
    if ($remainder !== 0) {
        $data .= str_repeat('=', 4 - $remainder);
    }
    return base64_decode(strtr($data, '-_', '+/'), true);
}

function getBearerToken(): string
{
    $authHeader = '';
    if (function_exists('getallheaders')) {
        $headers = getallheaders();
        $authHeader = $headers['Authorization'] ?? $headers['authorization'] ?? '';
    }
    if ($authHeader === '') {
        $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    }
    if (preg_match('/^Bearer\s+(.*)$/i', $authHeader, $matches)) {
        return trim($matches[1]);
    }
    return '';
}

function uploadDebug(string $message, array $context = []): void
{
    global $APP_DEBUG_UPLOADS;
    $line = '[upload-debug] ' . $message;
    if (!empty($context)) {
        if (($APP_DEBUG_UPLOADS ?? '0') === '1') {
            $line .= ' ' . json_encode($context, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        } else {
            $redacted = $context;
            unset($redacted['tmp_name'], $redacted['dbError'], $redacted['stmtError'], $redacted['AUTH_PASSWORD'], $redacted['JWT_SECRET']);
            $line .= ' ' . json_encode($redacted, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        }
    }
    error_log($line);
}

function getUploadStorageDir(): string {
    return __DIR__ . '/uploads';
}

function serveUploadedFile(string $fileName): void
{
    header_remove("Access-Control-Allow-Origin"); 
    header("Access-Control-Allow-Origin: *");
    header("Access-Control-Allow-Methods: GET, OPTIONS");
    header("Access-Control-Allow-Headers: Content-Type, Authorization");

    // Afbeeldingen én audiobestanden toestaan
    if (!preg_match('/^[a-f0-9]{32}\.(jpg|jpeg|png|webp|mp3|ogg|wav|m4a)$/i', $fileName)) {
        http_response_code(404);
        echo json_encode(['error' => 'not found']);
        exit;
    }
    $filePath = getUploadStorageDir() . '/' . $fileName;
    if (!is_file($filePath)) {
        http_response_code(404);
        echo json_encode(['error' => 'not found']);
        exit;
    }
    $mimeMap = [
        'jpg'  => 'image/jpeg',
        'jpeg' => 'image/jpeg',
        'png'  => 'image/png',
        'webp' => 'image/webp',
        'mp3'  => 'audio/mpeg',
        'ogg'  => 'audio/ogg',
        'wav'  => 'audio/wav',
        'm4a'  => 'audio/mp4',
    ];
    $extension = strtolower(pathinfo($fileName, PATHINFO_EXTENSION));
    header('Content-Type: ' . ($mimeMap[$extension] ?? 'application/octet-stream'));
    header('Content-Length: ' . filesize($filePath));
    readfile($filePath);
    exit;
}

// ---- ROUTING ----
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$url = explode('/', trim($path, '/'));
$route = $url[0] ?? '';

// Normaliseer: verwijder 'index.php' prefix
if ($route === 'index.php') {
    array_shift($url);
    $route = $url[0] ?? '';
}

if ($route === 'uploads' && ($UPLOADS_PUBLIC ?? '1') === '1') {
    serveUploadedFile($url[1] ?? '');
}

// ---- AUTH ----
if ($route === "auth") {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['error' => 'method not allowed']);
        exit;
    }
    $data = readJsonBody();
    $username = $data['username'] ?? '';
    $password = $data['password'] ?? '';
    $authenticated = false;
    if (!empty($AUTH_PASSWORD_HASH)) {
        if (hash_equals($AUTH_USERNAME, $username) && password_verify($password, $AUTH_PASSWORD_HASH)) {
            $authenticated = true;
        }
    } else {
        if (hash_equals($AUTH_USERNAME, $username) && hash_equals($AUTH_PASSWORD, $password)) {
            $authenticated = true;
        }
    }
    if ($authenticated) {
        $header  = ['alg' => 'HS256', 'typ' => 'JWT'];
        $payload = ['sub' => $AUTH_USERNAME, 'iat' => time(), 'exp' => time() + 3600];
        $headerEncoded  = base64UrlEncode(json_encode($header,  JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
        $payloadEncoded = base64UrlEncode(json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
        $signature      = hash_hmac('sha256', "$headerEncoded.$payloadEncoded", $JWT_SECRET, true);
        $jwt = "$headerEncoded.$payloadEncoded." . base64UrlEncode($signature);
        echo json_encode(['token' => $jwt]);
        exit;
    }
    http_response_code(401);
    echo json_encode(['error' => 'Invalid credentials']);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'];

// Methode-check: sta GET, POST (upload), PATCH, DELETE toe
if ($method !== 'GET'
    && !($method === 'POST' && ($route === 'upload' || $route === 'items')) 
    && $method !== 'PATCH'
    && $method !== 'DELETE'
) {
    http_response_code(405);
    echo json_encode(['error' => 'method not allowed']);
    exit;
}

// Token verplicht voor alles behalve GET
if ($method !== 'GET') {
    $token = getBearerToken();
    $tokenParts = explode(".", $token);
    if (count($tokenParts) !== 3) {
        http_response_code(401);
        echo json_encode(['error' => 'no token']);
        exit;
    }
    $decodedHeader  = json_decode(base64UrlDecode($tokenParts[0]) ?: '', true);
    $decodedPayload = json_decode(base64UrlDecode($tokenParts[1]) ?: '', true);
    $tokenKey = $tokenParts[2];

    if (!is_array($decodedHeader)  || ($decodedHeader['alg']  ?? '') !== 'HS256'
     || !is_array($decodedPayload) || ($decodedPayload['sub'] ?? '') !== $AUTH_USERNAME
     || !isset($decodedPayload['exp']) || !is_numeric($decodedPayload['exp'])
     || time() >= (int) $decodedPayload['exp']
    ) {
        http_response_code(401);
        echo json_encode(['error' => 'token expired']);
        exit;
    }
    $signature = hash_hmac('sha256', "$tokenParts[0].$tokenParts[1]", $JWT_SECRET, true);
    if (!hash_equals(base64UrlEncode($signature), $tokenKey)) {
        http_response_code(401);
        echo json_encode(['error' => 'no token']);
        exit;
    }
}

require_once dirname(__DIR__) . "/src/connection.php";

// Private uploads na token-check
if ($route === 'uploads' && ($UPLOADS_PUBLIC ?? '1') === '0') {
    serveUploadedFile($url[1] ?? '');
}

// ---- KAMERS ----
if ($route === 'kamers') {
    $stmt = $conn->prepare("SELECT `KamerId`, `Naam` FROM `Kamers` ORDER BY `KamerId`");
    $stmt->execute();
    echo json_encode($stmt->get_result()->fetch_all(MYSQLI_ASSOC));
    $stmt->close();
    exit;
}

// ---- FRAMES ----
if ($route === 'frames') {
    $stmt = $conn->prepare("SELECT `FramePlaatsId`, `KamerId`, `PlaatsNr` FROM `FramePlaatsen` ORDER BY `KamerId`, `PlaatsNr`");
    $stmt->execute();
    echo json_encode($stmt->get_result()->fetch_all(MYSQLI_ASSOC));
    $stmt->close();
    exit;
}

// ---- UPLOAD (POST) ----
if ($route === 'upload' && $method === 'POST') {
    uploadDebug('request received', [
        'method'            => $method,
        'contentLength'     => $_SERVER['CONTENT_LENGTH'] ?? null,
        'postMaxSize'       => ini_get('post_max_size'),
        'uploadMaxFilesize' => ini_get('upload_max_filesize'),
        'memoryLimit'       => ini_get('memory_limit'),
    ]);

    $naam             = trim((string) ($_POST['naam']         ?? $_POST['Naam']         ?? ''));
    $type             = trim((string) ($_POST['Type']         ?? $_POST['type']         ?? ''));
    $beschrijving     = trim((string) ($_POST['beschrijving'] ?? $_POST['Beschrijving'] ?? ''));
    $auteur           = trim((string) ($_POST['auteur']       ?? $_POST['Auteur']       ?? ''));
    $framePlaatsIdRaw = trim((string) ($_POST['framePlaatsId'] ?? $_POST['FramePlaatsId'] ?? ''));
    $framelessRaw     = trim((string) ($_POST['frameless']    ?? '0'));
    $imageUrl         = trim((string) ($_POST['imageUrl']     ?? $_POST['ImageUrl']     ?? ''));
    $audioPath        = trim((string) ($_POST['audioFilePath'] ?? $_POST['AudioFilePath'] ?? ''));

    if ($naam === '') { http_response_code(400); echo json_encode(['error' => 'naam is verplicht']); exit; }
    if ($type === '') $type = 'Overig';
    if (mb_strlen($naam) > 255) { http_response_code(400); echo json_encode(['error' => 'naam is te lang']); exit; }
    if (mb_strlen($type) > 80 || !preg_match('/^[\p{L}\p{N} .,\'&-]{1,80}$/u', $type)) { http_response_code(400); echo json_encode(['error' => 'ongeldig type']); exit; }
    if (mb_strlen($beschrijving) > 5000) { http_response_code(400); echo json_encode(['error' => 'beschrijving is te lang']); exit; }
    if (mb_strlen($auteur) > 255) { http_response_code(400); echo json_encode(['error' => 'auteur is te lang']); exit; }
    if (mb_strlen($audioPath) > 500) { http_response_code(400); echo json_encode(['error' => 'audiobestand pad is te lang']); exit; }

    $frameless     = $framelessRaw === '1' ? 1 : 0;
    $framePlaatsId = null;
    if (!$frameless) {
        if (!ctype_digit($framePlaatsIdRaw) || (int)$framePlaatsIdRaw <= 0) {
            http_response_code(400); echo json_encode(['error' => 'ongeldige FramePlaatsId']); exit;
        }
        $framePlaatsId = (int)$framePlaatsIdRaw;
    }

    // Afbeelding
    $finalImageUrl = '';
    $hasImageFile  = isset($_FILES['afbeelding']) && $_FILES['afbeelding']['error'] === UPLOAD_ERR_OK;
    if ($hasImageFile) {
        $file     = $_FILES['afbeelding'];
        $maxBytes = 50 * 1024 * 1024;
        if ($file['size'] <= 0 || $file['size'] > $maxBytes) { http_response_code(400); echo json_encode(['error' => 'bestand moet tussen 1 byte en 50 MB zijn']); exit; }
        $finfo        = new finfo(FILEINFO_MIME_TYPE);
        $mimeType     = $finfo->file($file['tmp_name']);
        $allowedMimes = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
        if (!isset($allowedMimes[$mimeType])) { http_response_code(400); echo json_encode(['error' => 'alleen JPG, PNG en WEBP zijn toegestaan']); exit; }
        $sizeInfo = @getimagesize($file['tmp_name']);
        if ($sizeInfo === false || !in_array($sizeInfo['mime'] ?? '', array_keys($allowedMimes), true)) { http_response_code(400); echo json_encode(['error' => 'ongeldig afbeeldingsbestand']); exit; }
        $uploadDir = getUploadStorageDir();
        if (!is_dir($uploadDir) && !mkdir($uploadDir, 0775, true)) { http_response_code(500); echo json_encode(['error' => 'kon uploadmap niet maken']); exit; }
        $safeFileName = bin2hex(random_bytes(16)) . '.' . $allowedMimes[$mimeType];
        $targetPath   = $uploadDir . '/' . $safeFileName;
        if (!move_uploaded_file($file['tmp_name'], $targetPath)) { http_response_code(500); echo json_encode(['error' => 'kon bestand niet opslaan']); exit; }
        $finalImageUrl = $UPLOAD_BASE_URL . '/uploads/' . $safeFileName;
    } elseif ($imageUrl !== '') {
        if (!filter_var($imageUrl, FILTER_VALIDATE_URL)) { http_response_code(400); echo json_encode(['error' => 'ongeldige ImageUrl']); exit; }
        if (mb_strlen($imageUrl) > 500) { http_response_code(400); echo json_encode(['error' => 'ImageUrl is te lang']); exit; }
        $finalImageUrl = $imageUrl;
    } else {
        http_response_code(400); echo json_encode(['error' => 'afbeelding of ImageUrl is verplicht']); exit;
    }

    // Audio
    $finalAudioPath = '';
    $hasAudioFile   = isset($_FILES['audio']) && $_FILES['audio']['error'] === UPLOAD_ERR_OK;
    if ($hasAudioFile) {
        $audioFile        = $_FILES['audio'];
        $maxBytes         = 50 * 1024 * 1024;
        if ($audioFile['size'] <= 0 || $audioFile['size'] > $maxBytes) { http_response_code(400); echo json_encode(['error' => 'audiobestand moet tussen 1 byte en 50 MB zijn']); exit; }
        $finfo            = new finfo(FILEINFO_MIME_TYPE);
        $mimeType         = $finfo->file($audioFile['tmp_name']);
        $allowedAudioMimes = ['audio/mpeg' => 'mp3', 'audio/ogg' => 'ogg', 'audio/wav' => 'wav', 'audio/mp4' => 'm4a', 'audio/x-m4a' => 'm4a'];
        if (!isset($allowedAudioMimes[$mimeType])) { http_response_code(400); echo json_encode(['error' => 'ongeldig audiobestand (mp3, ogg, wav, m4a)']); exit; }
        $uploadDir     = getUploadStorageDir();
        if (!is_dir($uploadDir) && !mkdir($uploadDir, 0775, true)) { http_response_code(500); echo json_encode(['error' => 'kon uploadmap niet maken']); exit; }
        $safeAudioName = bin2hex(random_bytes(16)) . '.' . $allowedAudioMimes[$mimeType];
        $targetAudioPath = $uploadDir . '/' . $safeAudioName;
        if (!move_uploaded_file($audioFile['tmp_name'], $targetAudioPath)) { http_response_code(500); echo json_encode(['error' => 'kon audiobestand niet opslaan']); exit; }
        $finalAudioPath = $UPLOAD_BASE_URL . '/uploads/' . $safeAudioName;
    } elseif ($audioPath !== '') {
        if (!filter_var($audioPath, FILTER_VALIDATE_URL) && !preg_match('#^/[a-zA-Z0-9_/.-]+$#', $audioPath)) { http_response_code(400); echo json_encode(['error' => 'ongeldig audiobestand pad']); exit; }
        $finalAudioPath = $audioPath;
    }

    $stmt = $conn->prepare("INSERT INTO `Kunstwerken` (`Type`, `Naam`, `Beschrijving`, `FramePlaatsId`, `ImageUrl`, `Audiopath`, `Auteur`, `Frameless`) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
    if (!$stmt) {
        uploadDebug('database prepare failed', ['dbError' => $conn->error]);
        if ($hasImageFile)  @unlink($targetPath);
        if ($hasAudioFile)  @unlink($targetAudioPath);
        http_response_code(500); echo json_encode(['error' => 'database prepare failed']); exit;
    }
    $stmt->bind_param("sssisssi", $type, $naam, $beschrijving, $framePlaatsId, $finalImageUrl, $finalAudioPath, $auteur, $frameless);
    $ok    = $stmt->execute();
    $newId = $stmt->insert_id;
    $stmtError = $stmt->error;
    $stmt->close();

    if (!$ok) {
        uploadDebug('database insert failed', ['stmtError' => $stmtError]);
        if ($hasImageFile) @unlink($targetPath);
        if ($hasAudioFile) @unlink($targetAudioPath);
        http_response_code(500); echo json_encode(['error' => 'database insert failed']); exit;
    }

    http_response_code(201);
    echo json_encode([
        'id'            => $newId,
        'Type'          => $type,
        'Naam'          => $naam,
        'Beschrijving'  => $beschrijving,
        'FramePlaatsId' => $framePlaatsId,
        'ImageUrl'      => $finalImageUrl,
        'Audiopath'     => $finalAudioPath,
        'Auteur'        => $auteur,
        'Frameless'     => $frameless,
    ]);
    exit;
}

// ---- PATCH (bijwerken kunstwerk) ----
if (($method === 'POST' || $method === 'PATCH') && $route === 'items' && isset($url[1]) && ctype_digit(trim($url[1]))){
    $id = (int)$url[1];

    $naam             = trim((string) ($_POST['naam']         ?? $_POST['Naam']         ?? ''));
    $type             = trim((string) ($_POST['Type']         ?? $_POST['type']         ?? ''));
    $beschrijving     = trim((string) ($_POST['beschrijving'] ?? $_POST['Beschrijving'] ?? ''));
    $auteur           = trim((string) ($_POST['auteur']       ?? $_POST['Auteur']       ?? ''));
    $framePlaatsIdRaw = trim((string) ($_POST['framePlaatsId'] ?? $_POST['FramePlaatsId'] ?? ''));
    $framelessRaw     = trim((string) ($_POST['frameless']    ?? '0'));

    $frameless     = $framelessRaw === '1' ? 1 : 0;
    $framePlaatsId = null;
    if (!$frameless) {
        if (!ctype_digit($framePlaatsIdRaw) || (int)$framePlaatsIdRaw <= 0) {
            http_response_code(400); echo json_encode(['error' => 'ongeldige FramePlaatsId']); exit;
        }
        $framePlaatsId = (int)$framePlaatsIdRaw;
    }

    // Optioneel nieuwe afbeelding
    $newImageUrl  = null;
    $hasImageFile = isset($_FILES['afbeelding']) && $_FILES['afbeelding']['error'] === UPLOAD_ERR_OK;
    if ($hasImageFile) {
        $file         = $_FILES['afbeelding'];
        $finfo        = new finfo(FILEINFO_MIME_TYPE);
        $mimeType     = $finfo->file($file['tmp_name']);
        $allowedMimes = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
        if (!isset($allowedMimes[$mimeType])) { http_response_code(400); echo json_encode(['error' => 'alleen JPG, PNG en WEBP zijn toegestaan']); exit; }
        $uploadDir    = getUploadStorageDir();
        if (!is_dir($uploadDir)) mkdir($uploadDir, 0775, true);
        $safeFileName = bin2hex(random_bytes(16)) . '.' . $allowedMimes[$mimeType];
        if (!move_uploaded_file($file['tmp_name'], $uploadDir . '/' . $safeFileName)) { http_response_code(500); echo json_encode(['error' => 'kon bestand niet opslaan']); exit; }
        $newImageUrl  = $UPLOAD_BASE_URL . '/uploads/' . $safeFileName;
    }

    // Optioneel nieuw audiobestand
    $newAudioPath = null;
    $hasAudioFile = isset($_FILES['audio']) && $_FILES['audio']['error'] === UPLOAD_ERR_OK;
    if ($hasAudioFile) {
        $audioFile         = $_FILES['audio'];
        $finfo             = new finfo(FILEINFO_MIME_TYPE);
        $mimeType          = $finfo->file($audioFile['tmp_name']);
        $allowedAudioMimes = ['audio/mpeg' => 'mp3', 'audio/ogg' => 'ogg', 'audio/wav' => 'wav', 'audio/mp4' => 'm4a', 'audio/x-m4a' => 'm4a'];
        if (!isset($allowedAudioMimes[$mimeType])) { http_response_code(400); echo json_encode(['error' => 'ongeldig audiobestand']); exit; }
        $uploadDir     = getUploadStorageDir();
        if (!is_dir($uploadDir)) mkdir($uploadDir, 0775, true);
        $safeAudioName = bin2hex(random_bytes(16)) . '.' . $allowedAudioMimes[$mimeType];
        if (!move_uploaded_file($audioFile['tmp_name'], $uploadDir . '/' . $safeAudioName)) { http_response_code(500); echo json_encode(['error' => 'kon audiobestand niet opslaan']); exit; }
        $newAudioPath  = $UPLOAD_BASE_URL . '/uploads/' . $safeAudioName;
    }

    // Bouw UPDATE query dynamisch op
    $sets   = ["`Naam`=?", "`Type`=?", "`Beschrijving`=?", "`Auteur`=?", "`FramePlaatsId`=?", "`Frameless`=?"];
    $params = [$naam, $type, $beschrijving, $auteur, $framePlaatsId, $frameless];
    $types  = "ssssii";

    if ($newImageUrl  !== null) { $sets[] = "`ImageUrl`=?";  $params[] = $newImageUrl;  $types .= "s"; }
    if ($newAudioPath !== null) { $sets[] = "`Audiopath`=?"; $params[] = $newAudioPath; $types .= "s"; }

    $params[] = $id;
    $types   .= "i";

    $sql  = "UPDATE `Kunstwerken` SET " . implode(", ", $sets) . " WHERE `Id`=?";
    $stmt = $conn->prepare($sql);
    if (!$stmt) { http_response_code(500); echo json_encode(['error' => 'database prepare failed']); exit; }
    $stmt->bind_param($types, ...$params);
    $ok = $stmt->execute();
    $stmt->close();

    if (!$ok) { http_response_code(500); echo json_encode(['error' => 'update failed']); exit; }

    echo json_encode(['updated' => $id]);
    exit;
}

// ---- DELETE ----
if ($method === 'DELETE' && $route !== '' && ctype_digit($route) && (int)$route > 0) {
    $id   = (int)$route;
    $stmt = $conn->prepare("DELETE FROM `Kunstwerken` WHERE `Id` = ?");
    if (!$stmt) { http_response_code(500); echo json_encode(['error' => 'database prepare failed']); exit; }
    $stmt->bind_param("i", $id);
    $ok       = $stmt->execute();
    $affected = $stmt->affected_rows;
    $stmt->close();

    if (!$ok)         { http_response_code(500); echo json_encode(['error' => 'delete failed']); exit; }
    if ($affected === 0) { http_response_code(404); echo json_encode(['error' => 'niet gevonden']); exit; }
    echo json_encode(['deleted' => $id]);
    exit;
}

// ---- GET enkel kunstwerk ----
if ($route !== '' && ctype_digit($route) && (int)$route > 0) {
    if (isset($url[1])) {
        $allowedColumns = ['Id', 'Type', 'Naam', 'Beschrijving', 'ImageUrl', 'Audiopath', 'Auteur', 'FramePlaatsId', 'Frameless'];
        $column = $url[1];
        if (!in_array($column, $allowedColumns, true)) { http_response_code(400); echo json_encode(['error' => 'Invalid column']); exit; }
        $stmt = $conn->prepare("SELECT `$column` FROM `Kunstwerken` WHERE Id = ?");
        $id   = intval($route);
        $stmt->bind_param("i", $id);
        $stmt->execute();
        echo json_encode($stmt->get_result()->fetch_all(MYSQLI_ASSOC));
        $stmt->close();
        exit;
    }
    $stmt = $conn->prepare("SELECT * FROM `Kunstwerken` WHERE Id = ?");
    $id   = intval($route);
    $stmt->bind_param("i", $id);
    $stmt->execute();
    echo json_encode($stmt->get_result()->fetch_all(MYSQLI_ASSOC));
    $stmt->close();
    exit;
}

// ---- GET alle kunstwerken ----
$stmt = $conn->prepare("SELECT * FROM `Kunstwerken`");
$stmt->execute();
echo json_encode($stmt->get_result()->fetch_all(MYSQLI_ASSOC));
$stmt->close();
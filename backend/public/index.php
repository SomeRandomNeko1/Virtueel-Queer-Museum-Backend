<?php
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

require_once dirname(__DIR__) . "/src/config.php";

function readJsonBody(): array
{
    $raw = file_get_contents('php://input');
    if (!$raw) {
        return [];
    }

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

function getUploadStorageDir(): string
{
    return sys_get_temp_dir() . '/virtueel-queer-museum-uploads';
}

function serveUploadedImage(string $fileName): void
{
    if (!preg_match('/^[a-f0-9]{32}\.(jpg|jpeg|png|webp)$/i', $fileName)) {
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
        'jpg' => 'image/jpeg',
        'jpeg' => 'image/jpeg',
        'png' => 'image/png',
        'webp' => 'image/webp',
    ];

    $extension = strtolower(pathinfo($fileName, PATHINFO_EXTENSION));
    header('Content-Type: ' . ($mimeMap[$extension] ?? 'application/octet-stream'));
    header('Content-Length: ' . filesize($filePath));
    readfile($filePath);
    exit;
}

$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$url = explode('/', trim($path, '/'));
$route = $url[0] ?? '';

if ($route === 'uploads' && ($UPLOADS_PUBLIC ?? '1') === '1') {
    serveUploadedImage($url[1] ?? '');
}

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
        $header = [
            'alg' => 'HS256',
            'typ' => 'JWT'
        ];
        $payload = [
            'sub' => $AUTH_USERNAME,
            'iat' => time(),
            'exp' => time() + (60 * 60)
        ];
        $headerEncoded = base64UrlEncode(json_encode($header, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
        $payloadEncoded = base64UrlEncode(json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
        $signature = hash_hmac('sha256', "$headerEncoded.$payloadEncoded", $JWT_SECRET, true);
        $signatureEncoded = base64UrlEncode($signature);
        $jwt = "$headerEncoded.$payloadEncoded.$signatureEncoded";
        echo json_encode(['token' => $jwt]);
        exit;
    }

    http_response_code(401);
    echo json_encode(['error' => 'Invalid credentials']);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'];

if ($method !== 'GET' && !($method === 'POST' && $route === 'upload')) {
    http_response_code(405);
    echo json_encode(['error' => 'method not allowed']);
    exit;
}

$token = getBearerToken();

$tokenParts = explode(".", $token);
if (count($tokenParts) !== 3) {
    http_response_code(401);
    echo json_encode(['error' => 'no token']);
    exit;
}

$decodedHeader = json_decode(base64UrlDecode($tokenParts[0]) ?: '', true);
$decodedPayload = json_decode(base64UrlDecode($tokenParts[1]) ?: '', true);
$tokenKey = $tokenParts[2];

if (!is_array($decodedHeader) || ($decodedHeader['alg'] ?? '') !== 'HS256' || !is_array($decodedPayload) || ($decodedPayload['sub'] ?? '') !== $AUTH_USERNAME || !isset($decodedPayload['exp']) || !is_numeric($decodedPayload['exp']) || time() >= (int) $decodedPayload['exp']) {
    http_response_code(401);
    echo json_encode(['error' => 'token expired']);
    exit;
}

$signature = hash_hmac('sha256', "$tokenParts[0].$tokenParts[1]", $JWT_SECRET, true);
$signatureEncoded = base64UrlEncode($signature);

if (!hash_equals($signatureEncoded, $tokenKey)) {
    http_response_code(401);
    echo json_encode(['error' => 'no token']);
    exit;
}

require_once dirname(__DIR__) . "/src/connection.php";

// If uploads are marked private, allow serving them only after token validation
if ($route === 'uploads' && ($UPLOADS_PUBLIC ?? '1') === '0') {
    serveUploadedImage($url[1] ?? '');
}

if ($route === 'upload') {
    uploadDebug('request received', [
        'method' => $method,
        'contentLength' => $_SERVER['CONTENT_LENGTH'] ?? null,
        'postMaxSize' => ini_get('post_max_size'),
        'uploadMaxFilesize' => ini_get('upload_max_filesize'),
        'memoryLimit' => ini_get('memory_limit'),
    ]);

    if ($method !== 'POST') {
        http_response_code(405);
        echo json_encode(['error' => 'method not allowed']);
        exit;
    }

    $naam = trim((string) ($_POST['naam'] ?? ''));
    $type = trim((string) ($_POST['Type'] ?? $_POST['type'] ?? ''));
    $beschrijving = trim((string) ($_POST['beschrijving'] ?? ''));
    $frameIdRaw = (string) ($_POST['frameId'] ?? '');
    $frameStyle = trim((string) ($_POST['frameStyle'] ?? ''));

    if ($naam === '') {
        http_response_code(400);
        echo json_encode(['error' => 'naam is verplicht']);
        exit;
    }

    if ($type === '') {
        $type = 'Overig';
    }

    if (mb_strlen($naam) > 255) {
        http_response_code(400);
        echo json_encode(['error' => 'naam is te lang']);
        exit;
    }

    if (mb_strlen($type) > 80 || !preg_match('/^[\p{L}\p{N} .,\'&-]{1,80}$/u', $type)) {
        http_response_code(400);
        echo json_encode(['error' => 'ongeldig type']);
        exit;
    }

    if (mb_strlen($beschrijving) > 5000) {
        http_response_code(400);
        echo json_encode(['error' => 'beschrijving is te lang']);
        exit;
    }

    if (!ctype_digit($frameIdRaw)) {
        http_response_code(400);
        echo json_encode(['error' => 'ongeldige frameId']);
        exit;
    }

    $frameId = (int) $frameIdRaw;
    if ($frameId < 1 || $frameId > 6) {
        http_response_code(400);
        echo json_encode(['error' => 'ongeldige frameId']);
        exit;
    }

    if ($frameStyle !== '' && !preg_match('/^[a-zA-Z0-9_-]{1,30}$/', $frameStyle)) {
        http_response_code(400);
        echo json_encode(['error' => 'ongeldige frameStyle']);
        exit;
    }

    if (!isset($_FILES['afbeelding']) || !is_array($_FILES['afbeelding'])) {
        uploadDebug('missing afbeelding field', [
            'postKeys' => array_keys($_POST),
            'fileKeys' => array_keys($_FILES),
        ]);
        http_response_code(400);
        echo json_encode(['error' => 'afbeelding is verplicht']);
        exit;
    }

    $file = $_FILES['afbeelding'];
    $uploadError = $file['error'] ?? UPLOAD_ERR_NO_FILE;
    uploadDebug('file metadata', [
        'error' => $uploadError,
        'size' => $file['size'] ?? null,
        'name' => $file['name'] ?? null,
        'type' => $file['type'] ?? null,
    ]);
    if ($uploadError !== UPLOAD_ERR_OK) {
        $uploadErrors = [
            UPLOAD_ERR_INI_SIZE => 'bestand is te groot voor de server',
            UPLOAD_ERR_FORM_SIZE => 'bestand is te groot voor het formulier',
            UPLOAD_ERR_PARTIAL => 'bestand is gedeeltelijk geüpload',
            UPLOAD_ERR_NO_FILE => 'afbeelding is verplicht',
            UPLOAD_ERR_NO_TMP_DIR => 'tijdelijke uploadmap ontbreekt',
            UPLOAD_ERR_CANT_WRITE => 'kon bestand niet naar schijf schrijven',
            UPLOAD_ERR_EXTENSION => 'een PHP-extensie heeft de upload gestopt',
        ];

        http_response_code(400);
        echo json_encode(['error' => $uploadErrors[$uploadError] ?? 'upload mislukt']);
        exit;
    }

    $maxBytes = 50 * 1024 * 1024;
    if (($file['size'] ?? 0) <= 0 || $file['size'] > $maxBytes) {
        uploadDebug('size validation failed', [
            'size' => $file['size'] ?? 0,
            'maxBytes' => $maxBytes,
        ]);
        http_response_code(400);
        echo json_encode(['error' => 'bestand moet tussen 1 byte en 50 MB zijn']);
        exit;
    }

    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $mimeType = $finfo->file($file['tmp_name']);
    uploadDebug('mime detected', ['mimeType' => $mimeType]);
    $allowedMimes = [
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/webp' => 'webp',
    ];

    if (!isset($allowedMimes[$mimeType])) {
        http_response_code(400);
        echo json_encode(['error' => 'alleen JPG, PNG en WEBP zijn toegestaan']);
        exit;
    }

    // Basic image validation to ensure file is a real image
    $sizeInfo = @getimagesize($file['tmp_name']);
    if ($sizeInfo === false || !in_array($sizeInfo['mime'] ?? '', array_keys($allowedMimes), true)) {
        http_response_code(400);
        echo json_encode(['error' => 'ongeldig afbeeldingsbestand']);
        exit;
    }

    $uploadDir = getUploadStorageDir();
    if (!is_dir($uploadDir) && !mkdir($uploadDir, 0775, true)) {
        http_response_code(500);
        echo json_encode(['error' => 'kon uploadmap niet maken']);
        exit;
    }

    $safeFileName = bin2hex(random_bytes(16)) . '.' . $allowedMimes[$mimeType];
    $targetPath = $uploadDir . '/' . $safeFileName;

    if (!move_uploaded_file($file['tmp_name'], $targetPath)) {
        uploadDebug('move_uploaded_file failed', [
            'targetPath' => $targetPath,
        ]);
        http_response_code(500);
        echo json_encode(['error' => 'kon bestand niet opslaan']);
        exit;
    }

    $imageUrl = '/api/uploads/' . $safeFileName;
    $position = $frameId;

    $stmt = $conn->prepare("INSERT INTO `Kunstwerken` (`Naam`, `Beschrijving`, `ImageUrl`, `Position`, `Type`) VALUES (?, ?, ?, ?, ?)");
    if (!$stmt) {
        uploadDebug('database prepare failed', [
            'dbError' => $conn->error,
        ]);
        @unlink($targetPath);
        http_response_code(500);
        echo json_encode(['error' => 'database prepare failed']);
        exit;
    }

    $stmt->bind_param("sssis", $naam, $beschrijving, $imageUrl, $position, $type);
    $ok = $stmt->execute();
    $newId = $stmt->insert_id;
    $stmtError = $stmt->error;
    $stmt->close();

    if (!$ok) {
        uploadDebug('database insert failed', [
            'stmtError' => $stmtError,
            'dbError' => ($APP_DEBUG_UPLOADS ?? '0') === '1' ? $conn->error : 'redacted',
        ]);
        @unlink($targetPath);
        http_response_code(500);
        echo json_encode(['error' => 'database insert failed']);
        exit;
    }

    http_response_code(201);
    echo json_encode([
        'id' => $newId,
        'Naam' => $naam,
        'Beschrijving' => $beschrijving,
        'ImageUrl' => $imageUrl,
        'Position' => $position,
        'Type' => $type,
    ]);
    exit;
}

if ($route !== '' && ctype_digit($route) && (int) $route > 0) {
    if (isset($url[1])) {

        $allowedColumns = ['Id', 'Type', 'Naam', 'Beschrijving', 'ImageUrl', 'Position'];
        $column = $url[1];

        if (!in_array($column, $allowedColumns, true)) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid column']);
            exit;
        }

        $stmt = $conn->prepare("SELECT `$column` FROM `Kunstwerken` WHERE id = ?");
        $id = intval($route);
        $stmt->bind_param("i", $id);
        $stmt->execute();
        $result = $stmt->get_result();
        echo json_encode($result->fetch_all(MYSQLI_ASSOC));
        $stmt->close();
        exit;
    }

    $stmt = $conn->prepare("SELECT * FROM `Kunstwerken` WHERE id = ?");
    $id = intval($route);
    $stmt->bind_param("i", $id);
    $stmt->execute();
    $result = $stmt->get_result();
    echo json_encode($result->fetch_all(MYSQLI_ASSOC));
    $stmt->close();
    exit;
}

$stmt = $conn->prepare("SELECT * FROM `Kunstwerken`");
$stmt->execute();
$result = $stmt->get_result();
echo json_encode($result->fetch_all(MYSQLI_ASSOC));
$stmt->close();

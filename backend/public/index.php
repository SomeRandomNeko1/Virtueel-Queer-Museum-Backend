<?php
header('Access-Control-Allow-Origin: http://10.120.5.132:5173');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Access-Control-Allow-Credentials: true');

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');

// Belangrijk: Het OPTIONS (preflight) verzoek moet direct akkoord krijgen met de headers hierboven
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
        'jpg'  => 'image/jpeg',
        'jpeg' => 'image/jpeg',
        'png'  => 'image/png',
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
        $header = ['alg' => 'HS256', 'typ' => 'JWT'];
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

// Allow POST only for upload, GET for everything else
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

if (!is_array($decodedHeader) || ($decodedHeader['alg'] ?? '') !== 'HS256'
    || !is_array($decodedPayload) || ($decodedPayload['sub'] ?? '') !== $AUTH_USERNAME
    || !isset($decodedPayload['exp']) || !is_numeric($decodedPayload['exp'])
    || time() >= (int) $decodedPayload['exp']) {
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

// --- NIEUW: Route voor kamers ---
if ($route === 'kamers') {
    $stmt = $conn->prepare("SELECT `Id`, `Naam` FROM `Kamers` ORDER BY `Id`");
    $stmt->execute();
    $result = $stmt->get_result();
    echo json_encode($result->fetch_all(MYSQLI_ASSOC));
    $stmt->close();
    exit;
}

// --- Upload route (aangepast) ---
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

    // -------------------- Lees velden uit POST --------------------
    $naam         = trim((string) ($_POST['naam'] ?? $_POST['Naam'] ?? ''));
    $type         = trim((string) ($_POST['Type'] ?? $_POST['type'] ?? ''));
    $beschrijving = trim((string) ($_POST['beschrijving'] ?? $_POST['Beschrijving'] ?? ''));
    $auteur       = trim((string) ($_POST['auteur'] ?? $_POST['Auteur'] ?? ''));
    $kamerIdRaw   = (string) ($_POST['kamerId'] ?? $_POST['KamerId'] ?? '');
    $positieRaw   = (string) ($_POST['position'] ?? $_POST['Position'] ?? '');  // Position in kamer
    $imageUrl     = trim((string) ($_POST['imageUrl'] ?? $_POST['ImageUrl'] ?? ''));
    $audioPath    = trim((string) ($_POST['audioFilePath'] ?? $_POST['AudioFilePath'] ?? ''));

    // -------------------- Validatie --------------------
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
    if (mb_strlen($auteur) > 255) {
        http_response_code(400);
        echo json_encode(['error' => 'auteur is te lang']);
        exit;
    }
    if (mb_strlen($audioPath) > 500) {
        http_response_code(400);
        echo json_encode(['error' => 'audiobestand pad is te lang']);
        exit;
    }

    // KamerId: optioneel? In DB is het een FK, verplicht.
    if (!ctype_digit($kamerIdRaw) || (int)$kamerIdRaw <= 0) {
        http_response_code(400);
        echo json_encode(['error' => 'ongeldige KamerId']);
        exit;
    }
    $kamerId = (int)$kamerIdRaw;

    // Position: optioneel, default 0 of 1?
    $position = 0;
    if ($positieRaw !== '') {
        if (!ctype_digit($positieRaw) || (int)$positieRaw < 0) {
            http_response_code(400);
            echo json_encode(['error' => 'ongeldige positie']);
            exit;
        }
        $position = (int)$positieRaw;
    }

    // -------------------- Afbeelding verwerken --------------------
    $finalImageUrl = '';
    $hasImageFile = isset($_FILES['afbeelding']) && $_FILES['afbeelding']['error'] === UPLOAD_ERR_OK;

    if ($hasImageFile) {
        // Bestand verwerken (zelfde logica als eerder)
        $file = $_FILES['afbeelding'];
        $maxBytes = 50 * 1024 * 1024;
        if ($file['size'] <= 0 || $file['size'] > $maxBytes) {
            http_response_code(400);
            echo json_encode(['error' => 'bestand moet tussen 1 byte en 50 MB zijn']);
            exit;
        }

        $finfo = new finfo(FILEINFO_MIME_TYPE);
        $mimeType = $finfo->file($file['tmp_name']);
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
            http_response_code(500);
            echo json_encode(['error' => 'kon bestand niet opslaan']);
            exit;
        }

        $finalImageUrl = '/api/uploads/' . $safeFileName;
    } elseif ($imageUrl !== '') {
        // Als er een URL is meegegeven, valideer deze eenvoudig
        if (!filter_var($imageUrl, FILTER_VALIDATE_URL)) {
            http_response_code(400);
            echo json_encode(['error' => 'ongeldige ImageUrl']);
            exit;
        }
        if (mb_strlen($imageUrl) > 500) {
            http_response_code(400);
            echo json_encode(['error' => 'ImageUrl is te lang']);
            exit;
        }
        $finalImageUrl = $imageUrl;
    } else {
        // Verplicht afbeelding of URL
        http_response_code(400);
        echo json_encode(['error' => 'afbeelding of ImageUrl is verplicht']);
        exit;
    }

    // -------------------- Audiobestand verwerken --------------------
    $finalAudioPath = '';
    $hasAudioFile = isset($_FILES['audio']) && $_FILES['audio']['error'] === UPLOAD_ERR_OK;

    if ($hasAudioFile) {
        $audioFile = $_FILES['audio'];
        $maxBytes = 50 * 1024 * 1024;
        if ($audioFile['size'] <= 0 || $audioFile['size'] > $maxBytes) {
            http_response_code(400);
            echo json_encode(['error' => 'audiobestand moet tussen 1 byte en 50 MB zijn']);
            exit;
        }

        $finfo = new finfo(FILEINFO_MIME_TYPE);
        $mimeType = $finfo->file($audioFile['tmp_name']);
        // Sta veelgebruikte audioformaten toe (aanpassen naar wens)
        $allowedAudioMimes = [
            'audio/mpeg' => 'mp3',
            'audio/ogg' => 'ogg',
            'audio/wav' => 'wav',
            'audio/mp4' => 'm4a',
            'audio/x-m4a' => 'm4a',
        ];
        if (!isset($allowedAudioMimes[$mimeType])) {
            http_response_code(400);
            echo json_encode(['error' => 'ongeldig audiobestand (mp3, ogg, wav, m4a)']);
            exit;
        }

        $uploadDir = getUploadStorageDir();
        if (!is_dir($uploadDir) && !mkdir($uploadDir, 0775, true)) {
            http_response_code(500);
            echo json_encode(['error' => 'kon uploadmap niet maken']);
            exit;
        }

        $safeAudioName = bin2hex(random_bytes(16)) . '.' . $allowedAudioMimes[$mimeType];
        $targetAudioPath = $uploadDir . '/' . $safeAudioName;

        if (!move_uploaded_file($audioFile['tmp_name'], $targetAudioPath)) {
            http_response_code(500);
            echo json_encode(['error' => 'kon audiobestand niet opslaan']);
            exit;
        }

        $finalAudioPath = '/api/uploads/' . $safeAudioName;
    } elseif ($audioPath !== '') {
        // Gebruik het opgegeven pad (bijv. externe URL of lokaal pad)
        if (!filter_var($audioPath, FILTER_VALIDATE_URL) && !preg_match('#^/[a-zA-Z0-9_/.-]+$#', $audioPath)) {
            http_response_code(400);
            echo json_encode(['error' => 'ongeldig audiobestand pad']);
            exit;
        }
        $finalAudioPath = $audioPath;
    }
    // Audio is optioneel, dus leeg laten is oké

    // -------------------- Database insert --------------------
    // Let op: de tabel `Kunstwerken` heeft kolommen: Id, Type, Naam, Beschrijving, KamerId, FrameNummer, Frameless, ImageUrl, AudioFilePath, Auteur, Position
    // Wij gebruiken: Type, Naam, Beschrijving, KamerId, ImageUrl, AudioFilePath, Auteur, Position
    // FrameNummer en Frameless laten we voor nu op NULL/0, of pas aan als nodig.
    $stmt = $conn->prepare("INSERT INTO `Kunstwerken` (`Type`, `Naam`, `Beschrijving`, `KamerId`, `ImageUrl`, `AudioFilePath`, `Auteur`, `Position`) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
    if (!$stmt) {
        uploadDebug('database prepare failed', ['dbError' => $conn->error]);
        if ($hasImageFile) @unlink($targetPath);
        if ($hasAudioFile) @unlink($targetAudioPath);
        http_response_code(500);
        echo json_encode(['error' => 'database prepare failed']);
        exit;
    }

    $stmt->bind_param("sssissis", $type, $naam, $beschrijving, $kamerId, $finalImageUrl, $finalAudioPath, $auteur, $position);
    $ok = $stmt->execute();
    $newId = $stmt->insert_id;
    $stmtError = $stmt->error;
    $stmt->close();

    if (!$ok) {
        uploadDebug('database insert failed', ['stmtError' => $stmtError]);
        if ($hasImageFile) @unlink($targetPath);
        if ($hasAudioFile) @unlink($targetAudioPath);
        http_response_code(500);
        echo json_encode(['error' => 'database insert failed']);
        exit;
    }

    http_response_code(201);
    echo json_encode([
        'id'            => $newId,
        'Type'          => $type,
        'Naam'          => $naam,
        'Beschrijving'  => $beschrijving,
        'KamerId'       => $kamerId,
        'ImageUrl'      => $finalImageUrl,
        'AudioFilePath' => $finalAudioPath,
        'Auteur'        => $auteur,
        'Position'      => $position,
    ]);
    exit;
}

// -------------------- Overige GET-routes (bestaand) --------------------
if ($route !== '' && ctype_digit($route) && (int) $route > 0) {
    if (isset($url[1])) {
        $allowedColumns = ['Id', 'Type', 'Naam', 'Beschrijving', 'ImageUrl', 'Position', 'Auteur', 'KamerId', 'AudioFilePath'];
        $column = $url[1];
        if (!in_array($column, $allowedColumns, true)) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid column']);
            exit;
        }
        $stmt = $conn->prepare("SELECT `$column` FROM `Kunstwerken` WHERE Id = ?");
        $id = intval($route);
        $stmt->bind_param("i", $id);
        $stmt->execute();
        $result = $stmt->get_result();
        echo json_encode($result->fetch_all(MYSQLI_ASSOC));
        $stmt->close();
        exit;
    }
    $stmt = $conn->prepare("SELECT * FROM `Kunstwerken` WHERE Id = ?");
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
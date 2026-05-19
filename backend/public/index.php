<?php

// --- CORS & Headers ---
header('Access-Control-Allow-Origin: http://10.120.5.132:5173');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Access-Control-Allow-Credentials: true');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

require_once dirname(__DIR__) . "/src/config.php";

function readJsonBody(): array {
    $raw = file_get_contents('php://input');
    if (!$raw) return [];
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
}

function base64UrlEncode(string $data): string {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function base64UrlDecode(string $data): string|false {
    $remainder = strlen($data) % 4;
    if ($remainder !== 0) {
        $data .= str_repeat('=', 4 - $remainder);
    }
    return base64_decode(strtr($data, '-_', '+/'), true);
}

function getBearerToken(): string {
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

function uploadDebug(string $message, array $context = []): void {
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
    return sys_get_temp_dir() . '/virtueel-queer-museum-uploads';
}

function serveUploadedImage(string $fileName): void {
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
        'jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg',
        'png' => 'image/png', 'webp' => 'image/webp',
    ];
    $ext = strtolower(pathinfo($fileName, PATHINFO_EXTENSION));
    header('Content-Type: ' . ($mimeMap[$ext] ?? 'application/octet-stream'));
    header('Content-Length: ' . filesize($filePath));
    readfile($filePath);
    exit;
}

// --- Routing ---
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$url = explode('/', trim($path, '/'));
$route = $url[0] ?? '';
$method = $_SERVER['REQUEST_METHOD'];

// Serve uploaded files (public or private)
if ($route === 'uploads') {
    $isPublic = ($UPLOADS_PUBLIC ?? '1') === '1';
    if ($isPublic) {
        serveUploadedImage($url[1] ?? '');
    } else {
        // Private: require valid token first (see auth block below)
    }
}

// GET /api/kamers - Lijst van alle kamers
if ($route === 'kamers' && $method === 'GET') {
    require_once dirname(__DIR__) . "/src/connection.php";
    $stmt = $conn->prepare("SELECT `KamerId`, `Naam` FROM `Kamers` ORDER BY `KamerId`");
    $stmt->execute();
    $result = $stmt->get_result();
    echo json_encode($result->fetch_all(MYSQLI_ASSOC));
    $stmt->close();
    exit;
}

if ($route === 'frameplaatsen' && $method === 'GET') {
    require_once dirname(__DIR__) . "/src/connection.php";
    $kamerIdFilter = (int)($_GET['kamerId'] ?? 0);
    if ($kamerIdFilter <= 0) {
        http_response_code(400);
        echo json_encode(['error' => 'kamerId query parameter is verplicht']);
        exit;
    }
    $stmt = $conn->prepare("SELECT `FramePlaatsId`, `PlaatsNr` FROM `FramePlaatsen` WHERE `KamerId` = ? ORDER BY `PlaatsNr`");
    $stmt->bind_param("i", $kamerIdFilter);
    $stmt->execute();
    $result = $stmt->get_result();
    echo json_encode($result->fetch_all(MYSQLI_ASSOC));
    $stmt->close();
    exit;
}


if ($route === 'auth' && $method === 'POST') {
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
        $payload = ['sub' => $AUTH_USERNAME, 'iat' => time(), 'exp' => time() + 3600];
        $headerEnc = base64UrlEncode(json_encode($header, JSON_UNESCAPED_SLASHES));
        $payloadEnc = base64UrlEncode(json_encode($payload, JSON_UNESCAPED_SLASHES));
        $signature = hash_hmac('sha256', "$headerEnc.$payloadEnc", $JWT_SECRET, true);
        $signatureEnc = base64UrlEncode($signature);
        echo json_encode(['token' => "$headerEnc.$payloadEnc.$signatureEnc"]);
        exit;
    }
    http_response_code(401);
    echo json_encode(['error' => 'Ongeldige inloggegevens']);
    exit;
}

$protectedRoutes = ['upload'];
$isProtected = in_array($route, $protectedRoutes, true) || ($route === 'uploads' && ($UPLOADS_PUBLIC ?? '1') === '0');

if ($isProtected) {
    $token = getBearerToken();
    $parts = explode(".", $token);
    if (count($parts) !== 3) {
        http_response_code(401);
        echo json_encode(['error' => 'Authenticatie vereist']);
        exit;
    }

    $decodedHeader = json_decode(base64UrlDecode($parts[0]) ?: '', true);
    $decodedPayload = json_decode(base64UrlDecode($parts[1]) ?: '', true);

    if (!is_array($decodedHeader) || ($decodedHeader['alg'] ?? '') !== 'HS256'
        || !is_array($decodedPayload) || ($decodedPayload['sub'] ?? '') !== $AUTH_USERNAME
        || !isset($decodedPayload['exp']) || !is_numeric($decodedPayload['exp'])
        || time() >= (int) $decodedPayload['exp']) {
        http_response_code(401);
        echo json_encode(['error' => 'Token verlopen of ongeldig']);
        exit;
    }

    $signature = hash_hmac('sha256', "$parts[0].$parts[1]", $JWT_SECRET, true);
    if (!hash_equals(base64UrlEncode($signature), $parts[2])) {
        http_response_code(401);
        echo json_encode(['error' => 'Token signature invalid']);
        exit;
    }

    // Private uploads: serve only after auth
    if ($route === 'uploads' && ($UPLOADS_PUBLIC ?? '1') === '0') {
        serveUploadedImage($url[1] ?? '');
    }
}


// POST /api/upload - Nieuw kunstwerk toevoegen
if ($route === 'upload') {
    if ($method !== 'POST') {
        http_response_code(405);
        echo json_encode(['error' => 'Alleen POST toegestaan']);
        exit;
    }

    require_once dirname(__DIR__) . "/src/connection.php";

    uploadDebug('upload request', [
        'postMaxSize' => ini_get('post_max_size'),
        'uploadMaxFilesize' => ini_get('upload_max_filesize'),
        'files' => array_keys($_FILES ?? [])
    ]);

    // --- Lees POST velden (case-insensitive) ---
    $naam           = trim((string) ($_POST['naam'] ?? $_POST['Naam'] ?? ''));
    $type           = trim((string) ($_POST['type'] ?? $_POST['Type'] ?? 'Overig'));
    $beschrijving   = trim((string) ($_POST['beschrijving'] ?? $_POST['Beschrijving'] ?? ''));
    $auteur         = trim((string) ($_POST['auteur'] ?? $_POST['Auteur'] ?? ''));
    $framePlaatsRaw = trim((string) ($_POST['frameplaatsid'] ?? $_POST['FramePlaatsId'] ?? ''));
    $positieRaw     = trim((string) ($_POST['position'] ?? $_POST['Position'] ?? '0'));
    $imageUrl       = trim((string) ($_POST['imageurl'] ?? $_POST['ImageUrl'] ?? ''));
    $audioPath      = trim((string) ($_POST['audiopath'] ?? $_POST['AudioFilePath'] ?? $_POST['audioFilePath'] ?? ''));

    // --- Validatie ---
    if ($naam === '' || mb_strlen($naam) > 255) {
        http_response_code(400);
        echo json_encode(['error' => 'Naam is verplicht (max 255 karakters)']);
        exit;
    }
    if ($type === '' || mb_strlen($type) > 80 || !preg_match('/^[\p{L}\p{N} .,\'&-]{1,80}$/u', $type)) {
        http_response_code(400);
        echo json_encode(['error' => 'Ongeldig type']);
        exit;
    }
    if (mb_strlen($beschrijving ?? '') > 5000) {
        http_response_code(400);
        echo json_encode(['error' => 'Beschrijving te lang (max 5000)']);
        exit;
    }
    if (mb_strlen($auteur ?? '') > 255) {
        http_response_code(400);
        echo json_encode(['error' => 'Auteur te lang']);
        exit;
    }
    if (!ctype_digit($framePlaatsRaw) || (int)$framePlaatsRaw <= 0) {
        http_response_code(400);
        echo json_encode(['error' => 'FramePlaatsId is verplicht en moet een positief getal zijn']);
        exit;
    }
    $framePlaatsId = (int)$framePlaatsRaw;
    $position = ctype_digit($positieRaw) ? (int)$positieRaw : 0;
    if ($position < 0) {
        http_response_code(400);
        echo json_encode(['error' => 'Positie kan niet negatief zijn']);
        exit;
    }

    // --- Afbeelding verwerken ---
    $finalImageUrl = '';
    $uploadedImageTmp = null;
    $hasImageFile = isset($_FILES['afbeelding']) && $_FILES['afbeelding']['error'] === UPLOAD_ERR_OK;

    if ($hasImageFile) {
        $file = $_FILES['afbeelding'];
        if ($file['size'] <= 0 || $file['size'] > 50 * 1024 * 1024) {
            http_response_code(400);
            echo json_encode(['error' => 'Afbeelding moet tussen 1 byte en 50MB zijn']);
            exit;
        }
        $finfo = new finfo(FILEINFO_MIME_TYPE);
        $mime = $finfo->file($file['tmp_name']);
        $allowed = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
        if (!isset($allowed[$mime]) || !@getimagesize($file['tmp_name'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Alleen JPG, PNG of WEBP afbeeldingen toegestaan']);
            exit;
        }
        $uploadDir = getUploadStorageDir();
        if (!is_dir($uploadDir) && !mkdir($uploadDir, 0775, true)) {
            http_response_code(500);
            echo json_encode(['error' => 'Uploadmap niet aan te maken']);
            exit;
        }
        $safeName = bin2hex(random_bytes(16)) . '.' . $allowed[$mime];
        $targetPath = $uploadDir . '/' . $safeName;
        if (!move_uploaded_file($file['tmp_name'], $targetPath)) {
            http_response_code(500);
            echo json_encode(['error' => 'Kon afbeelding niet opslaan']);
            exit;
        }
        $finalImageUrl = '/api/uploads/' . $safeName;
        $uploadedImageTmp = $targetPath;
    } elseif ($imageUrl !== '') {
        if (!filter_var($imageUrl, FILTER_VALIDATE_URL) || mb_strlen($imageUrl) > 500) {
            http_response_code(400);
            echo json_encode(['error' => 'Ongeldige ImageUrl']);
            exit;
        }
        $finalImageUrl = $imageUrl;
    } else {
        http_response_code(400);
        echo json_encode(['error' => 'Afbeelding of ImageUrl is verplicht']);
        exit;
    }

    // --- Audio verwerken (optioneel) ---
    $finalAudioPath = '';
    $uploadedAudioTmp = null;
    $hasAudioFile = isset($_FILES['audio']) && $_FILES['audio']['error'] === UPLOAD_ERR_OK;

    if ($hasAudioFile) {
        $file = $_FILES['audio'];
        if ($file['size'] <= 0 || $file['size'] > 50 * 1024 * 1024) {
            http_response_code(400);
            echo json_encode(['error' => 'Audio moet tussen 1 byte en 50MB zijn']);
            exit;
        }
        $finfo = new finfo(FILEINFO_MIME_TYPE);
        $mime = $finfo->file($file['tmp_name']);
        $allowed = [
            'audio/mpeg' => 'mp3', 'audio/ogg' => 'ogg',
            'audio/wav' => 'wav', 'audio/mp4' => 'm4a', 'audio/x-m4a' => 'm4a'
        ];
        if (!isset($allowed[$mime])) {
            http_response_code(400);
            echo json_encode(['error' => 'Alleen MP3, OGG, WAV of M4A audio toegestaan']);
            exit;
        }
        $uploadDir = getUploadStorageDir();
        if (!is_dir($uploadDir) && !mkdir($uploadDir, 0775, true)) {
            http_response_code(500);
            echo json_encode(['error' => 'Uploadmap niet aan te maken']);
            exit;
        }
        $safeName = bin2hex(random_bytes(16)) . '.' . $allowed[$mime];
        $targetPath = $uploadDir . '/' . $safeName;
        if (!move_uploaded_file($file['tmp_name'], $targetPath)) {
            @unlink($uploadedImageTmp);
            http_response_code(500);
            echo json_encode(['error' => 'Kon audio niet opslaan']);
            exit;
        }
        $finalAudioPath = '/api/uploads/' . $safeName;
        $uploadedAudioTmp = $targetPath;
    } elseif ($audioPath !== '') {
        if (!filter_var($audioPath, FILTER_VALIDATE_URL) && !preg_match('#^/[a-zA-Z0-9_/.-]+$#', $audioPath)) {
            http_response_code(400);
            echo json_encode(['error' => 'Ongeldig audio pad']);
            exit;
        }
        if (mb_strlen($audioPath) > 500) {
            http_response_code(400);
            echo json_encode(['error' => 'Audio pad te lang']);
            exit;
        }
        $finalAudioPath = $audioPath;
    }
    // Audio is optioneel: leeg laten mag

    // Tabel Kunstwerken: Id, Type, Naam, Beschrijving, FramePlaatsId, ImageUrl, AudioFilePath, Auteur, Position, Frameless
    $stmt = $conn->prepare("INSERT INTO `Kunstwerken` (`Type`, `Naam`, `Beschrijving`, `FramePlaatsId`, `ImageUrl`, `AudioFilePath`, `Auteur`, `Position`, `Frameless`) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
    if (!$stmt) {
        uploadDebug('prepare failed', ['error' => $conn->error]);
        @unlink($uploadedImageTmp);
        @unlink($uploadedAudioTmp);
        http_response_code(500);
        echo json_encode(['error' => 'Database fout (prepare)']);
        exit;
    }

    $frameless = 0; // Default: met frame. Pas aan als je dit via POST wilt laten sturen.
    $stmt->bind_param("sssisssii", $type, $naam, $beschrijving, $framePlaatsId, $finalImageUrl, $finalAudioPath, $auteur, $position, $frameless);
    
    if (!$stmt->execute()) {
        uploadDebug('insert failed', ['error' => $stmt->error]);
        @unlink($uploadedImageTmp);
        @unlink($uploadedAudioTmp);
        $stmt->close();
        http_response_code(500);
        echo json_encode(['error' => 'Database fout (insert)']);
        exit;
    }

    $newId = $stmt->insert_id;
    $stmt->close();

    http_response_code(201);
    echo json_encode([
        'id' => $newId,
        'Type' => $type,
        'Naam' => $naam,
        'Beschrijving' => $beschrijving,
        'FramePlaatsId' => $framePlaatsId,
        'ImageUrl' => $finalImageUrl,
        'AudioFilePath' => $finalAudioPath,
        'Auteur' => $auteur,
        'Position' => $position,
        'Frameless' => $frameless,
    ]);
    exit;
}

require_once dirname(__DIR__) . "/src/connection.php";

// GET /api/123 of /api/123/Naam
if ($route !== '' && ctype_digit($route) && (int)$route > 0) {
    $id = (int)$route;
    if (isset($url[1])) {
        $allowed = ['Id','Type','Naam','Beschrijving','ImageUrl','Position','Auteur','FramePlaatsId','AudioFilePath','Frameless'];
        $col = $url[1];
        if (!in_array($col, $allowed, true)) {
            http_response_code(400);
            echo json_encode(['error' => 'Ongeldige kolom']);
            exit;
        }
        $stmt = $conn->prepare("SELECT `$col` FROM `Kunstwerken` WHERE Id = ?");
        $stmt->bind_param("i", $id);
    } else {
        $stmt = $conn->prepare("SELECT * FROM `Kunstwerken` WHERE Id = ?");
        $stmt->bind_param("i", $id);
    }
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
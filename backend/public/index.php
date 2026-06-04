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

// PHP hoists function definitions, dus we kunnen ze hier bovenaan zetten.

function cleanupOldLogs(mysqli $conn): void {
    $conn->query("DELETE FROM `Logs` WHERE `CreatedAt` < DATE_SUB(NOW(), INTERVAL 30 DAY)");
}

function addLogEntry(mysqli $conn, string $message, string $status = 'info', ?string $username = null): void {
    $stmt = $conn->prepare("INSERT INTO `Logs` (`Message`, `Status`, `Username`) VALUES (?, ?, ?)");
    if (!$stmt) return;
    $stmt->bind_param("sss", $message, $status, $username);
    $stmt->execute();
    $stmt->close();
}

// ---- ROUTING ----
$path  = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$url   = explode('/', trim($path, '/'));
$route = $url[0] ?? '';

if ($route === 'index.php') {
    array_shift($url);
    $route = $url[0] ?? '';
}

// $method vroeg definiëren zodat alle routes het kunnen gebruiken
$method = $_SERVER['REQUEST_METHOD'];

// ---- UPLOADS PUBLIC ----
if ($route === 'uploads' && ($UPLOADS_PUBLIC ?? '1') === '1') {
    serveUploadedFile($url[1] ?? '');
}

// ---- AUTH ----
if ($route === 'auth') {
    if ($method !== 'POST') {
        http_response_code(405);
        echo json_encode(['error' => 'method not allowed']);
        exit;
    }

    $data     = readJsonBody();
    $username = trim((string) ($data['username'] ?? ''));
    $password = (string) ($data['password'] ?? '');

    if ($username === '' || $password === '') {
        http_response_code(400);
        echo json_encode(['error' => 'username en password zijn verplicht']);
        exit;
    }

    require_once dirname(__DIR__) . "/src/connection.php";

    $stmt = $conn->prepare("SELECT `UserId`, `Username`, `PasswordHash` FROM `Users` WHERE `Username` = ? LIMIT 1");
    if (!$stmt) {
        http_response_code(500);
        echo json_encode(['error' => 'database fout']);
        exit;
    }

    $stmt->bind_param("s", $username);
    $stmt->execute();
    $result = $stmt->get_result();
    $user   = $result->fetch_assoc();
    $stmt->close();

    if (!$user || !password_verify($password, $user['PasswordHash'])) {
        // Log mislukte poging
        addLogEntry($conn, "Mislukte inlogpoging voor gebruiker: {$username}", 'error', null);
        http_response_code(401);
        echo json_encode(['error' => 'Invalid credentials']);
        exit;
    }

    $header  = ['alg' => 'HS256', 'typ' => 'JWT'];
    $payload = [
        'sub' => $user['Username'],
        'uid' => $user['UserId'],
        'iat' => time(),
        'exp' => time() + 3600,
    ];

    $headerEncoded  = base64UrlEncode(json_encode($header,  JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
    $payloadEncoded = base64UrlEncode(json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
    $signature      = hash_hmac('sha256', "$headerEncoded.$payloadEncoded", $JWT_SECRET, true);
    $jwt = "$headerEncoded.$payloadEncoded." . base64UrlEncode($signature);

    // Log succesvolle login
    addLogEntry($conn, "Ingelogd: {$user['Username']}", 'success', $user['Username']);

    echo json_encode([
        'token'    => $jwt,
        'username' => $user['Username'],
    ]);
    exit;
}

// ---- USERS CREATE (POST /users) ----
if ($route === 'users' && $method === 'POST') {
    require_once dirname(__DIR__) . "/src/connection.php";

    $check    = $conn->query("SELECT COUNT(*) as cnt FROM `Users`");
    $row      = $check->fetch_assoc();
    $hasUsers = (int)$row['cnt'] > 0;

    $creatorUsername = null;

    if ($hasUsers) {
        $token      = getBearerToken();
        $tokenParts = explode(".", $token);
        if (count($tokenParts) !== 3) {
            http_response_code(401);
            echo json_encode(['error' => 'Token vereist om gebruikers toe te voegen']);
            exit;
        }

        $decodedHeader  = json_decode(base64UrlDecode($tokenParts[0]) ?: '', true);
        $decodedPayload = json_decode(base64UrlDecode($tokenParts[1]) ?: '', true);
        $tokenKey = $tokenParts[2];

        if (!is_array($decodedHeader)  || ($decodedHeader['alg'] ?? '') !== 'HS256'
         || !is_array($decodedPayload)
         || empty($decodedPayload['sub'])
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
            echo json_encode(['error' => 'invalid token']);
            exit;
        }

        $creatorUsername = $decodedPayload['sub'];
    }

    $data     = readJsonBody();
    $username = trim((string) ($data['username'] ?? ''));
    $password = (string) ($data['password'] ?? '');

    if ($username === '' || $password === '') {
        http_response_code(400);
        echo json_encode(['error' => 'username en password zijn verplicht']);
        exit;
    }
    if (mb_strlen($username) < 3 || mb_strlen($username) > 100) {
        http_response_code(400);
        echo json_encode(['error' => 'username moet tussen 3 en 100 tekens zijn']);
        exit;
    }
    if (mb_strlen($password) < 8) {
        http_response_code(400);
        echo json_encode(['error' => 'wachtwoord moet minimaal 8 tekens zijn']);
        exit;
    }

    $hash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);

    $stmt = $conn->prepare("INSERT INTO `Users` (`Username`, `PasswordHash`) VALUES (?, ?)");
    if (!$stmt) {
        http_response_code(500);
        echo json_encode(['error' => 'database fout']);
        exit;
    }

    $stmt->bind_param("ss", $username, $hash);
    $ok       = $stmt->execute();
    $insertId = $stmt->insert_id;
    $errNo    = $conn->errno;
    $stmt->close();

    if (!$ok) {
        if ($errNo === 1062) {
            http_response_code(409);
            echo json_encode(['error' => 'Deze username bestaat al']);
        } else {
            http_response_code(500);
            echo json_encode(['error' => 'kon gebruiker niet aanmaken']);
        }
        exit;
    }

    // Log wie de gebruiker aanmaakte
    $logActor = $creatorUsername ?? $username; // bij eerste setup = zichzelf
    addLogEntry($conn, "Gebruiker aangemaakt: {$username}", 'success', $logActor);

    http_response_code(201);
    echo json_encode([
        'message'  => 'Gebruiker aangemaakt',
        'id'       => $insertId,
        'username' => $username,
    ]);
    exit;
}

if ($route === 'gastenboek' && $method === 'POST' && !isset($url[1])) {
    require_once dirname(__DIR__) . "/src/connection.php";

    $data    = readJsonBody();
    $naam    = trim((string) ($data['naam']    ?? $data['Naam']    ?? ''));
    $sterren = (int) ($data['sterren']         ?? $data['Sterren'] ?? 0);
    $bericht = trim((string) ($data['bericht'] ?? $data['Bericht'] ?? ''));

    if ($naam === '') {
        http_response_code(400);
        echo json_encode(['error' => 'Naam is verplicht']);
        exit;
    }
    if (mb_strlen($naam) > 100) {
        http_response_code(400);
        echo json_encode(['error' => 'Naam is te lang (max 100 tekens)']);
        exit;
    }
    if ($sterren < 1 || $sterren > 5) {
        http_response_code(400);
        echo json_encode(['error' => 'Sterren moet tussen 1 en 5 zijn']);
        exit;
    }
    if ($bericht === '') {
        http_response_code(400);
        echo json_encode(['error' => 'Bericht is verplicht']);
        exit;
    }
    if (mb_strlen($bericht) > 2000) {
        http_response_code(400);
        echo json_encode(['error' => 'Bericht is te lang (max 2000 tekens)']);
        exit;
    }

    $stmt = $conn->prepare("INSERT INTO `Gastenboek` (`Naam`, `Sterren`, `Bericht`) VALUES (?, ?, ?)");
    if (!$stmt) {
        http_response_code(500);
        echo json_encode(['error' => 'database fout']);
        exit;
    }

    $stmt->bind_param("sis", $naam, $sterren, $bericht);
    $ok       = $stmt->execute();
    $insertId = $stmt->insert_id;
    $stmt->close();

    if (!$ok) {
        http_response_code(500);
        echo json_encode(['error' => 'kon bericht niet opslaan']);
        exit;
    }

    addLogEntry($conn, "Gastenboek: nieuw bericht van {$naam} ({$sterren}★)", 'success', null);

    http_response_code(201);
    echo json_encode([
        'GastenboekId' => $insertId,
        'Naam'         => $naam,
        'Sterren'      => $sterren,
        'Bericht'      => $bericht,
    ]);
    exit;
}

// ---- METHODE CHECK ----
if ($method !== 'GET'
    && !($method === 'POST' && in_array($route, ['upload', 'items', 'users', 'logs', 'gastenboek']))
    && $method !== 'PATCH'
    && $method !== 'DELETE'
) {
    http_response_code(405);
    echo json_encode(['error' => 'method not allowed']);
    exit;
}

// ---- TOKEN VALIDATIE (verplicht voor alles behalve GET) ----
$authedUsername = '';
if ($method !== 'GET') {
    $token      = getBearerToken();
    $tokenParts = explode(".", $token);
    if (count($tokenParts) !== 3) {
        http_response_code(401);
        echo json_encode(['error' => 'no token']);
        exit;
    }

    $decodedHeader  = json_decode(base64UrlDecode($tokenParts[0]) ?: '', true);
    $decodedPayload = json_decode(base64UrlDecode($tokenParts[1]) ?: '', true);
    $tokenKey = $tokenParts[2];

    if (!is_array($decodedHeader)  || ($decodedHeader['alg'] ?? '') !== 'HS256'
     || !is_array($decodedPayload)
     || empty($decodedPayload['sub'])
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
        echo json_encode(['error' => 'invalid signature']);
        exit;
    }

    // ← Dit is de fix: authedUsername wordt hier gezet voor ALLE beveiligde routes
    $authedUsername = $decodedPayload['sub'];
}

require_once dirname(__DIR__) . "/src/connection.php";

// ---- UPLOADS PRIVATE ----
if ($route === 'uploads' && ($UPLOADS_PUBLIC ?? '1') === '0') {
    serveUploadedFile($url[1] ?? '');
}

// ---- USERS LIST (GET /users) ----
if ($route === 'users' && $method === 'GET') {
    $stmt = $conn->prepare("SELECT `UserId`, `Username`, `CreatedAt` FROM `Users` ORDER BY `UserId`");
    $stmt->execute();
    echo json_encode($stmt->get_result()->fetch_all(MYSQLI_ASSOC));
    $stmt->close();
    exit;
}

// ---- USERS DELETE (DELETE /users/{id}) ----
if ($route === 'users' && $method === 'DELETE' && isset($url[1]) && ctype_digit(trim($url[1]))) {
    $deleteId = (int) $url[1];

    $countStmt = $conn->query("SELECT COUNT(*) as cnt FROM `Users`");
    $countRow  = $countStmt->fetch_assoc();
    if ((int)$countRow['cnt'] <= 1) {
        http_response_code(400);
        echo json_encode(['error' => 'Kan de laatste gebruiker niet verwijderen']);
        exit;
    }

    $selfStmt = $conn->prepare("SELECT `Username` FROM `Users` WHERE `UserId` = ? LIMIT 1");
    $selfStmt->bind_param("i", $deleteId);
    $selfStmt->execute();
    $targetUser = $selfStmt->get_result()->fetch_assoc();
    $selfStmt->close();

    if (!$targetUser) {
        http_response_code(404);
        echo json_encode(['error' => 'Gebruiker niet gevonden']);
        exit;
    }

    if ($targetUser['Username'] === $authedUsername) {
        http_response_code(400);
        echo json_encode(['error' => 'Je kunt jezelf niet verwijderen']);
        exit;
    }

    $stmt = $conn->prepare("DELETE FROM `Users` WHERE `UserId` = ?");
    $stmt->bind_param("i", $deleteId);
    $ok       = $stmt->execute();
    $affected = $stmt->affected_rows;
    $stmt->close();

    if (!$ok || $affected === 0) {
        http_response_code(500);
        echo json_encode(['error' => 'verwijderen mislukt']);
        exit;
    }

    addLogEntry($conn, "Gebruiker verwijderd: {$targetUser['Username']}", 'success', $authedUsername);

    echo json_encode([
        'deleted'  => $deleteId,
        'username' => $targetUser['Username'],
    ]);
    exit;
}

// ---- LOGS LIST (GET /logs) ----
if ($route === 'logs' && $method === 'GET') {
    cleanupOldLogs($conn);

    $limit = 100;
    if (isset($_GET['limit']) && ctype_digit($_GET['limit']) && (int)$_GET['limit'] > 0 && (int)$_GET['limit'] <= 500) {
        $limit = (int)$_GET['limit'];
    }

    $stmt = $conn->prepare("SELECT `LogId`, `Message`, `Status`, `Username`, `CreatedAt` FROM `Logs` ORDER BY `CreatedAt` DESC LIMIT ?");
    $stmt->bind_param("i", $limit);
    $stmt->execute();
    echo json_encode($stmt->get_result()->fetch_all(MYSQLI_ASSOC));
    $stmt->close();
    exit;
}

// ---- LOG CREATE (POST /logs) ----
if ($route === 'logs' && $method === 'POST') {
    $data    = readJsonBody();
    $message = trim((string) ($data['message'] ?? ''));
    $status  = trim((string) ($data['status']  ?? 'info'));

    if ($message === '') {
        http_response_code(400);
        echo json_encode(['error' => 'message is verplicht']);
        exit;
    }
    if (mb_strlen($message) > 500) {
        http_response_code(400);
        echo json_encode(['error' => 'message is te lang (max 500 tekens)']);
        exit;
    }
    if (!in_array($status, ['success', 'error', 'info'], true)) {
        $status = 'info';
    }

    addLogEntry($conn, $message, $status, $authedUsername ?: null);

    http_response_code(201);
    echo json_encode(['message' => 'Log opgeslagen']);
    exit;
}

// ---- LOGS DELETE ALL (DELETE /logs) ----
if ($route === 'logs' && $method === 'DELETE' && !isset($url[1])) {
    $conn->query("DELETE FROM `Logs`");
    addLogEntry($conn, "Alle logs gewist", 'info', $authedUsername);
    echo json_encode(['message' => 'Alle logs verwijderd']);
    exit;
}

// ---- GASTENBOEK LIST (GET /gastenboek) ----
if ($route === 'gastenboek' && $method === 'GET') {

    // Optioneel: ?sort=asc of ?sort=desc (standaard nieuwste eerst)
    $sortDir = 'DESC';
    if (isset($_GET['sort']) && strtolower($_GET['sort']) === 'asc') {
        $sortDir = 'ASC';
    }

    // Optioneel: ?limit=50
    $limit = 100;
    if (isset($_GET['limit']) && ctype_digit($_GET['limit']) && (int)$_GET['limit'] > 0 && (int)$_GET['limit'] <= 500) {
        $limit = (int)$_GET['limit'];
    }

    $stmt = $conn->prepare("SELECT `GastenboekId`, `Naam`, `Sterren`, `Bericht`, `CreatedAt`, `UpdatedAt` FROM `Gastenboek` ORDER BY `CreatedAt` $sortDir LIMIT ?");
    $stmt->bind_param("i", $limit);
    $stmt->execute();
    echo json_encode($stmt->get_result()->fetch_all(MYSQLI_ASSOC));
    $stmt->close();
    exit;
}

// ---- GASTENBOEK SINGLE (GET /gastenboek/{id}) ----
if ($route === 'gastenboek' && $method === 'GET' && isset($url[1]) && ctype_digit(trim($url[1]))) {
    $id   = (int) $url[1];
    $stmt = $conn->prepare("SELECT `GastenboekId`, `Naam`, `Sterren`, `Bericht`, `CreatedAt`, `UpdatedAt` FROM `Gastenboek` WHERE `GastenboekId` = ?");
    $stmt->bind_param("i", $id);
    $stmt->execute();
    $result = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if (!$result) {
        http_response_code(404);
        echo json_encode(['error' => 'Bericht niet gevonden']);
        exit;
    }

    echo json_encode($result);
    exit;
}

// ---- GASTENBOEK CREATE (POST /gastenboek) — GEEN token nodig ----
if ($route === 'gastenboek' && $method === 'POST' && !isset($url[1])) {
    $data    = readJsonBody();
    $naam    = trim((string) ($data['naam']    ?? $data['Naam']    ?? ''));
    $sterren = (int) ($data['sterren']         ?? $data['Sterren'] ?? 0);
    $bericht = trim((string) ($data['bericht'] ?? $data['Bericht'] ?? ''));

    // Validatie
    if ($naam === '') {
        http_response_code(400);
        echo json_encode(['error' => 'Naam is verplicht']);
        exit;
    }
    if (mb_strlen($naam) > 100) {
        http_response_code(400);
        echo json_encode(['error' => 'Naam is te lang (max 100 tekens)']);
        exit;
    }
    if ($sterren < 1 || $sterren > 5) {
        http_response_code(400);
        echo json_encode(['error' => 'Sterren moet tussen 1 en 5 zijn']);
        exit;
    }
    if ($bericht === '') {
        http_response_code(400);
        echo json_encode(['error' => 'Bericht is verplicht']);
        exit;
    }
    if (mb_strlen($bericht) > 2000) {
        http_response_code(400);
        echo json_encode(['error' => 'Bericht is te lang (max 2000 tekens)']);
        exit;
    }

    $stmt = $conn->prepare("INSERT INTO `Gastenboek` (`Naam`, `Sterren`, `Bericht`) VALUES (?, ?, ?)");
    if (!$stmt) {
        http_response_code(500);
        echo json_encode(['error' => 'database fout']);
        exit;
    }

    $stmt->bind_param("sis", $naam, $sterren, $bericht);
    $ok       = $stmt->execute();
    $insertId = $stmt->insert_id;
    $stmt->close();

    if (!$ok) {
        http_response_code(500);
        echo json_encode(['error' => 'kon bericht niet opslaan']);
        exit;
    }

    addLogEntry($conn, "Gastenboek: nieuw bericht van {$naam} ({$sterren}★)", 'success', null);

    http_response_code(201);
    echo json_encode([
        'GastenboekId' => $insertId,
        'Naam'         => $naam,
        'Sterren'      => $sterren,
        'Bericht'      => $bericht,
    ]);
    exit;
}

// ---- GASTENBOEK UPDATE (PATCH/POST /gastenboek/{id}) — token vereist ----
if (($method === 'PATCH' || $method === 'POST') && $route === 'gastenboek' && isset($url[1]) && ctype_digit(trim($url[1]))) {
    $id   = (int) $url[1];
    $data = readJsonBody();

    // Haal het huidige bericht op
    $stmt = $conn->prepare("SELECT `GastenboekId` FROM `Gastenboek` WHERE `GastenboekId` = ?");
    $stmt->bind_param("i", $id);
    $stmt->execute();
    $exists = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if (!$exists) {
        http_response_code(404);
        echo json_encode(['error' => 'Bericht niet gevonden']);
        exit;
    }

    // Bouw dynamische update
    $sets   = [];
    $params = [];
    $types  = "";

    if (isset($data['naam']) || isset($data['Naam'])) {
        $naam = trim((string) ($data['naam'] ?? $data['Naam']));
        if ($naam === '' || mb_strlen($naam) > 100) {
            http_response_code(400);
            echo json_encode(['error' => 'Ongeldige naam']);
            exit;
        }
        $sets[]   = "`Naam`=?";
        $params[] = $naam;
        $types   .= "s";
    }

    if (isset($data['sterren']) || isset($data['Sterren'])) {
        $sterren = (int) ($data['sterren'] ?? $data['Sterren']);
        if ($sterren < 1 || $sterren > 5) {
            http_response_code(400);
            echo json_encode(['error' => 'Sterren moet tussen 1 en 5 zijn']);
            exit;
        }
        $sets[]   = "`Sterren`=?";
        $params[] = $sterren;
        $types   .= "i";
    }

    if (isset($data['bericht']) || isset($data['Bericht'])) {
        $bericht = trim((string) ($data['bericht'] ?? $data['Bericht']));
        if ($bericht === '' || mb_strlen($bericht) > 2000) {
            http_response_code(400);
            echo json_encode(['error' => 'Ongeldig bericht']);
            exit;
        }
        $sets[]   = "`Bericht`=?";
        $params[] = $bericht;
        $types   .= "s";
    }

    if (empty($sets)) {
        http_response_code(400);
        echo json_encode(['error' => 'Geen velden om bij te werken']);
        exit;
    }

    $params[] = $id;
    $types   .= "i";

    $sql  = "UPDATE `Gastenboek` SET " . implode(", ", $sets) . " WHERE `GastenboekId`=?";
    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        http_response_code(500);
        echo json_encode(['error' => 'database fout']);
        exit;
    }
    $stmt->bind_param($types, ...$params);
    $ok = $stmt->execute();
    $stmt->close();

    if (!$ok) {
        http_response_code(500);
        echo json_encode(['error' => 'update mislukt']);
        exit;
    }

    addLogEntry($conn, "Gastenboek bijgewerkt (ID: {$id})", 'success', $authedUsername);

    echo json_encode(['updated' => $id]);
    exit;
}

// ---- GASTENBOEK DELETE (DELETE /gastenboek/{id}) — token vereist ----
if ($method === 'DELETE' && $route === 'gastenboek' && isset($url[1]) && ctype_digit(trim($url[1]))) {
    $id = (int) $url[1];

    $stmt = $conn->prepare("DELETE FROM `Gastenboek` WHERE `GastenboekId` = ?");
    $stmt->bind_param("i", $id);
    $ok       = $stmt->execute();
    $affected = $stmt->affected_rows;
    $stmt->close();

    if (!$ok) {
        http_response_code(500);
        echo json_encode(['error' => 'verwijderen mislukt']);
        exit;
    }
    if ($affected === 0) {
        http_response_code(404);
        echo json_encode(['error' => 'Bericht niet gevonden']);
        exit;
    }

    addLogEntry($conn, "Gastenboek verwijderd (ID: {$id})", 'success', $authedUsername);

    echo json_encode(['deleted' => $id]);
    exit;
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

    $naam             = trim((string) ($_POST['naam']          ?? $_POST['Naam']          ?? ''));
    $type             = trim((string) ($_POST['Type']          ?? $_POST['type']          ?? ''));
    $beschrijving     = trim((string) ($_POST['beschrijving']  ?? $_POST['Beschrijving']  ?? ''));
    $auteur           = trim((string) ($_POST['auteur']        ?? $_POST['Auteur']        ?? ''));
    $framePlaatsIdRaw = trim((string) ($_POST['framePlaatsId'] ?? $_POST['FramePlaatsId'] ?? ''));
    $framelessRaw     = trim((string) ($_POST['frameless']     ?? '0'));
    $imageUrl         = trim((string) ($_POST['imageUrl']      ?? $_POST['ImageUrl']      ?? ''));
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

    $finalAudioPath = '';
    $hasAudioFile   = isset($_FILES['audio']) && $_FILES['audio']['error'] === UPLOAD_ERR_OK;
    if ($hasAudioFile) {
        $audioFile         = $_FILES['audio'];
        $maxBytes          = 50 * 1024 * 1024;
        if ($audioFile['size'] <= 0 || $audioFile['size'] > $maxBytes) { http_response_code(400); echo json_encode(['error' => 'audiobestand moet tussen 1 byte en 50 MB zijn']); exit; }
        $finfo             = new finfo(FILEINFO_MIME_TYPE);
        $mimeType          = $finfo->file($audioFile['tmp_name']);
        $allowedAudioMimes = ['audio/mpeg' => 'mp3', 'audio/ogg' => 'ogg', 'audio/wav' => 'wav', 'audio/mp4' => 'm4a', 'audio/x-m4a' => 'm4a'];
        if (!isset($allowedAudioMimes[$mimeType])) { http_response_code(400); echo json_encode(['error' => 'ongeldig audiobestand (mp3, ogg, wav, m4a)']); exit; }
        $uploadDir       = getUploadStorageDir();
        if (!is_dir($uploadDir) && !mkdir($uploadDir, 0775, true)) { http_response_code(500); echo json_encode(['error' => 'kon uploadmap niet maken']); exit; }
        $safeAudioName   = bin2hex(random_bytes(16)) . '.' . $allowedAudioMimes[$mimeType];
        $targetAudioPath = $uploadDir . '/' . $safeAudioName;
        if (!move_uploaded_file($audioFile['tmp_name'], $targetAudioPath)) { http_response_code(500); echo json_encode(['error' => 'kon audiobestand niet opslaan']); exit; }
        $finalAudioPath  = $UPLOAD_BASE_URL . '/uploads/' . $safeAudioName;
    } elseif ($audioPath !== '') {
        if (!filter_var($audioPath, FILTER_VALIDATE_URL) && !preg_match('#^/[a-zA-Z0-9_/.-]+$#', $audioPath)) { http_response_code(400); echo json_encode(['error' => 'ongeldig audiobestand pad']); exit; }
        $finalAudioPath = $audioPath;
    }

    if (!$frameless && $framePlaatsId !== null) {
        $checkStmt = $conn->prepare("SELECT `Id` FROM `Kunstwerken` WHERE `FramePlaatsId` = ? LIMIT 1");
        $checkStmt->bind_param("i", $framePlaatsId);
        $checkStmt->execute();
        $checkStmt->store_result();
        if ($checkStmt->num_rows > 0) {
            $checkStmt->close();
            addLogEntry($conn, "Mislukt — framepositie al bezet (positie: {$framePlaatsId})", 'error', $authedUsername);
            http_response_code(409);
            echo json_encode(['error' => 'Deze framepositie is al bezet door een ander kunstwerk']);
            exit;
        }
        $checkStmt->close();
    }

    if ($framePlaatsId === null) {
        $stmt = $conn->prepare(
            "INSERT INTO `Kunstwerken` (`Type`, `Naam`, `Beschrijving`, `FramePlaatsId`, `ImageUrl`, `Audiopath`, `Auteur`, `Frameless`)
            VALUES (?, ?, ?, NULL, ?, ?, ?, ?)"
        );
        if (!$stmt) {
            uploadDebug('database prepare failed', ['dbError' => $conn->error]);
            if ($hasImageFile) @unlink($targetPath);
            if ($hasAudioFile) @unlink($targetAudioPath);
            http_response_code(500);
            echo json_encode(['error' => 'database prepare failed']);
            exit;
        }
        $stmt->bind_param("ssssssi",
            $type,
            $naam,
            $beschrijving,
            $finalImageUrl,
            $finalAudioPath,
            $auteur,
            $frameless
        );
    } else {
        $stmt = $conn->prepare(
            "INSERT INTO `Kunstwerken` (`Type`, `Naam`, `Beschrijving`, `FramePlaatsId`, `ImageUrl`, `Audiopath`, `Auteur`, `Frameless`)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        );
        if (!$stmt) {
            uploadDebug('database prepare failed', ['dbError' => $conn->error]);
            if ($hasImageFile) @unlink($targetPath);
            if ($hasAudioFile) @unlink($targetAudioPath);
            http_response_code(500);
            echo json_encode(['error' => 'database prepare failed']);
            exit;
        }
        $stmt->bind_param("sssisssi",
            $type,
            $naam,
            $beschrijving,
            $framePlaatsId,
            $finalImageUrl,
            $finalAudioPath,
            $auteur,
            $frameless
        );
    }

    $ok        = $stmt->execute();
    $newId     = $stmt->insert_id;
    $stmtError = $stmt->error;
    $stmt->close();
    addLogEntry($conn, "Kunstwerk toegevoegd: {$naam} (ID: {$newId})", 'success', $authedUsername);

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
if (($method === 'POST' || $method === 'PATCH') && $route === 'items' && isset($url[1]) && ctype_digit(trim($url[1]))) {
    $id = (int)$url[1];

    $naam             = trim((string) ($_POST['naam']          ?? $_POST['Naam']          ?? ''));
    $type             = trim((string) ($_POST['Type']          ?? $_POST['type']          ?? ''));
    $beschrijving     = trim((string) ($_POST['beschrijving']  ?? $_POST['Beschrijving']  ?? ''));
    $auteur           = trim((string) ($_POST['auteur']        ?? $_POST['Auteur']        ?? ''));
    $framePlaatsIdRaw = trim((string) ($_POST['framePlaatsId'] ?? $_POST['FramePlaatsId'] ?? ''));
    $framelessRaw     = trim((string) ($_POST['frameless']     ?? '0'));

    $frameless     = $framelessRaw === '1' ? 1 : 0;
    $framePlaatsId = null;
    if (!$frameless) {
        if (!ctype_digit($framePlaatsIdRaw) || (int)$framePlaatsIdRaw <= 0) {
            http_response_code(400); echo json_encode(['error' => 'ongeldige FramePlaatsId']); exit;
        }
        $framePlaatsId = (int)$framePlaatsIdRaw;
    }

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

    if (!$frameless && $framePlaatsId !== null) {
        $checkStmt = $conn->prepare("SELECT `Id` FROM `Kunstwerken` WHERE `FramePlaatsId` = ? AND `Id` != ? LIMIT 1");
        $checkStmt->bind_param("ii", $framePlaatsId, $id);
        $checkStmt->execute();
        $checkStmt->store_result();
        if ($checkStmt->num_rows > 0) {
            $checkStmt->close();
            addLogEntry($conn, "Mislukt — framepositie al bezet bij bewerken (positie: {$framePlaatsId})", 'error', $authedUsername);
            http_response_code(409);
            echo json_encode(['error' => 'Deze framepositie is al bezet door een ander kunstwerk']);
            exit;
        }
        $checkStmt->close();
    }

    if ($framePlaatsId === null) {
        // Gebruik NULL direct in de query voor dit veld
        $sets   = ["`Naam`=?", "`Type`=?", "`Beschrijving`=?", "`Auteur`=?", "`FramePlaatsId`=NULL", "`Frameless`=?"];
        $params = [$naam, $type, $beschrijving, $auteur, $frameless];
        $types  = "ssssi";
    } else {
        $sets   = ["`Naam`=?", "`Type`=?", "`Beschrijving`=?", "`Auteur`=?", "`FramePlaatsId`=?", "`Frameless`=?"];
        $params = [$naam, $type, $beschrijving, $auteur, $framePlaatsId, $frameless];
        $types  = "ssssii";
    }

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

    addLogEntry($conn, "Kunstwerk bijgewerkt: {$naam} (ID: {$id})", 'success', $authedUsername);

    echo json_encode(['updated' => $id]);
    exit;
}

// ---- DELETE kunstwerk ----
if ($method === 'DELETE' && $route !== '' && ctype_digit($route) && (int)$route > 0) {
    $id   = (int)$route;
    $stmt = $conn->prepare("DELETE FROM `Kunstwerken` WHERE `Id` = ?");
    if (!$stmt) { http_response_code(500); echo json_encode(['error' => 'database prepare failed']); exit; }
    $stmt->bind_param("i", $id);
    $ok       = $stmt->execute();
    $affected = $stmt->affected_rows;
    $stmt->close();

    if (!$ok)            { http_response_code(500); echo json_encode(['error' => 'delete failed']); exit; }
    if ($affected === 0) { http_response_code(404); echo json_encode(['error' => 'niet gevonden']); exit; }

    addLogEntry($conn, "Kunstwerk verwijderd (ID: {$id})", 'success', $authedUsername);

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
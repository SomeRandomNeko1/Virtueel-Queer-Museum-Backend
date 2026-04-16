<?php
header('Content-Type: application/json; charset=utf-8');


if ($_SERVER['REQUEST_METHOD'] === 'GET') {

    //parse de url en maak er een array van
    $path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
    $url = explode('/', trim($path, '/'));

    // authenthication
    if ($url[0] === "auth") {

        $data = json_decode(file_get_contents('php://input'), true);
        $username = $data['username'] ?? '';
        $password = $data['password'] ?? '';

        if ($username === 'admin' && $password === 'password') {

            $base64UrlEncode = function ($data) {
                return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
            };

            $header = [
                'alg' => 'HS256',
                'typ' => 'JWT'
            ];
            $payload = [
                'sub' => 'admin',
                'iat' => time(),
                'exp' => time() + (60 * 60) // Token is 1 hour geldig
            ];
            $secret = 'thesixsevenkeyofatleast67bitslongpleaseicantgiveuaweakkeydamn';
            $headerEncoded = $base64UrlEncode(json_encode($header));
            $payloadEncoded = $base64UrlEncode(json_encode($payload));
            $signature = hash_hmac('sha256', "$headerEncoded.$payloadEncoded", $secret, true);
            $signatureEncoded = $base64UrlEncode($signature);
            $jwt = "$headerEncoded.$payloadEncoded.$signatureEncoded";
            echo json_encode(['token' => $jwt]);

        } else {
            http_response_code(401);
            echo json_encode(['error' => 'Invalid credentials']);
        }

        //als het geen authenthication is dan checkt hij voor een token
        } else {

        $token = json_decode(file_get_contents('php://input'), true)['token'] ?? '';
        if ($token === '') {
            http_response_code(401);
            echo json_encode(['error' => 'no token']);
            exit;
        }

        //als er een token heeft checkt hij of er 3 delen zijn
        $tokenParts = explode(".", $token);
        if (count($tokenParts) !== 3) {
            http_response_code(401);
            echo json_encode(['error' => 'no token']);
            exit;
        }

        //checken of de token klopt en geldig is
        $decodedHeader = json_decode(base64_decode($tokenParts[0]), true);
        $decodedPayload = json_decode(base64_decode($tokenParts[1]), true);
        $tokenKey = $tokenParts[2];
        $key = 'thesixsevenkeyofatleast67bitslongpleaseicantgiveuaweakkeydamn';

        //checken of de token nog geldig is
        if (!is_array($decodedPayload) || !isset($decodedPayload['exp']) || !is_numeric($decodedPayload['exp']) || time() >= (int) $decodedPayload['exp']) {
            http_response_code(401);
            echo json_encode(['error' => 'token expired']);
            exit;
        }

        $signature = hash_hmac('sha256', "$tokenParts[0].$tokenParts[1]", $key, true);
        $signatureEncoded = rtrim(strtr(base64_encode($signature), '+/', '-_'), '=');

        // als het klopt gaat hij hier verder
        if ($signatureEncoded === $tokenKey) {

            require_once dirname(__DIR__) . "/src/config.php";
            require_once dirname(__DIR__) . "/src/connection.php";

            //check of er een id is meegegeven in de url, en of deze een integer is groter dan 0
            if (is_int(intval($url[0])) && intval($url[0]) > 0) {
                if (isset($url[1])) {

                    //columns in database die gevraagd mogen worden
                    $allowedColumns = ['Id', 'Type', 'Naam', 'Beschrijving', 'ImageUrl', 'Position'];
                    $column = $url[1];

                    //check of de column gebruikt mag worden
                    if (!in_array($column, $allowedColumns, true)) {
                        http_response_code(400);
                        echo json_encode(['error' => 'Invalid column']);
                        exit;
                    }

                    //pakt de column als er voor een specefieke id gevraagd wordt
                    $stmt = $conn->prepare("SELECT `$column` FROM `Kunstwerken` WHERE id = ?");
                    $id = intval($url[0]);
                    $stmt->bind_param("i", $id);
                    $stmt->execute();
                    $result = $stmt->get_result();
                    echo json_encode($result->fetch_all(MYSQLI_ASSOC));
                    $stmt->close();
                    exit;

                }

                //pakt de hele rij als er voor een specefieke id gevraagd wordt
                $stmt = $conn->prepare("SELECT * FROM `Kunstwerken` WHERE id = ?");
                $id = intval($url[0]);
                $stmt->bind_param("i", $id);
                $stmt->execute();
                $result = $stmt->get_result();
                echo json_encode($result->fetch_all(MYSQLI_ASSOC));
                $stmt->close();

            } else {

                //pakt alles als er niks wordt meegegeven in de url
                $stmt = $conn->prepare("SELECT * FROM `Kunstwerken`");
                $stmt->execute();
                $result = $stmt->get_result();
                echo json_encode($result->fetch_all(MYSQLI_ASSOC));
                $stmt->close();
            }

            //als het niet klopt returnt hij een error
        } else {
            http_response_code(401);
            echo json_encode(['error' => 'no token']);
            exit;
        }
    }
}

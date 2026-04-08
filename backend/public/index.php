<?php
header('Content-Type: application/json; charset=utf-8');


if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    require_once dirname(__DIR__) . "/src/config.php";
    require_once dirname(__DIR__) . "/src/connection.php";

    //parse de url en maak er een array van
    $path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
    $url = explode('/', trim($path, '/'));


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

}
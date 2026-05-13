<?php

require_once __DIR__ . "/config.php";

// Create connection
$conn = new mysqli($DB_HOST, $USER, $PASS, $DB);

// Check connection
if ($conn->connect_error) {
  error_log('[db] connection failed: ' . $conn->connect_error);
  http_response_code(500);
  header('Content-Type: application/json; charset=utf-8');
  echo json_encode(['error' => 'database connection failed']);
  exit;
}

$conn->set_charset('utf8mb4');
?>
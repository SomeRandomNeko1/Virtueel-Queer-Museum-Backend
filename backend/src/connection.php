<?php

require_once __DIR__ . "/config.php";

// Create connection
$conn = new mysqli("mysql", $USER, $PASS, $DB);

// Check connection
if ($conn->connect_error) {
  die("Connection failed: " . $conn->connect_error);
}
?>
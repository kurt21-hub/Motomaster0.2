<?php
header('Content-Type: application/json');

$dbHost = '127.0.0.1';
$dbUser = 'root';
$dbPass = '';
$dbName = 'motomasterdb';

// Connect without database first to create it if needed
$mysqli = new mysqli($dbHost, $dbUser, $dbPass);
if ($mysqli->connect_errno) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database connection failed']);
    exit;
}

// Create database if it doesn't exist
$mysqli->query("CREATE DATABASE IF NOT EXISTS $dbName CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");

// Now select the database
$mysqli->select_db($dbName);

$input = json_decode(file_get_contents('php://input'), true);
if (!$input) { $input = $_POST; }

$first = isset($input['first_name']) ? trim($input['first_name']) : '';
$last = isset($input['last_name']) ? trim($input['last_name']) : '';
$email = isset($input['email']) ? trim($input['email']) : '';
$password = isset($input['password']) ? $input['password'] : '';

if (!$first || !$last || !$email || !$password) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Missing required fields']);
    exit;
}

// Create admin table if missing
$createSql = "CREATE TABLE IF NOT EXISTS admin (
    admin_id INT AUTO_INCREMENT PRIMARY KEY,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";
$mysqli->query($createSql);

// Ensure password column wide enough
$mysqli->query("ALTER TABLE admin MODIFY password VARCHAR(255) NOT NULL");

// Check existing email
$stmt = $mysqli->prepare('SELECT admin_id FROM admin WHERE email = ? LIMIT 1');
$stmt->bind_param('s', $email);
$stmt->execute();
$stmt->store_result();
if ($stmt->num_rows > 0) {
    http_response_code(409);
    echo json_encode(['success' => false, 'message' => 'Email already registered']);
    exit;
}
$stmt->close();

$hash = password_hash($password, PASSWORD_DEFAULT);
$ins = $mysqli->prepare('INSERT INTO admin (first_name, last_name, email, password) VALUES (?, ?, ?, ?)');
$ins->bind_param('ssss', $first, $last, $email, $hash);
if ($ins->execute()) {
    echo json_encode(['success' => true, 'message' => 'Registered']);
} else {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Failed to register']);
}

$ins->close();
$mysqli->close();

?>

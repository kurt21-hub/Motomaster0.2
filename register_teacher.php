<?php
header('Content-Type: application/json');

$dbHost = '127.0.0.1';
$dbUser = 'root';
$dbPass = '';
$dbName = 'motomasterdb';

$mysqli = new mysqli($dbHost, $dbUser, $dbPass, $dbName);
if ($mysqli->connect_errno) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database connection failed']);
    exit;
}

// Create instructors table if missing
$createSql = "CREATE TABLE IF NOT EXISTS instructors (
    instructor_id INT AUTO_INCREMENT PRIMARY KEY,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    specialization VARCHAR(100) NOT NULL,
    contact_number VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";
$mysqli->query($createSql);

$input = json_decode(file_get_contents('php://input'), true);
if (!$input) {
    $input = $_POST;
}

$first = isset($input['first_name']) ? trim($input['first_name']) : '';
$last = isset($input['last_name']) ? trim($input['last_name']) : '';
$email = isset($input['email']) ? trim($input['email']) : '';
$specialization = isset($input['specialization']) ? trim($input['specialization']) : '';
$contact = isset($input['contact_number']) ? trim($input['contact_number']) : '';
$password = isset($input['password']) ? $input['password'] : '';

if (!$first || !$last || !$email || !$specialization || !$contact || !$password) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Missing required fields']);
    exit;
}

// Ensure password column can store password hashes
$mysqli->query("ALTER TABLE instructors MODIFY password VARCHAR(255) NOT NULL");

$stmt = $mysqli->prepare('SELECT instructor_id FROM instructors WHERE email = ? LIMIT 1');
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
$ins = $mysqli->prepare('INSERT INTO instructors (first_name, last_name, email, password, specialization, contact_number) VALUES (?, ?, ?, ?, ?, ?)');
$ins->bind_param('ssssss', $first, $last, $email, $hash, $specialization, $contact);

if ($ins->execute()) {
    echo json_encode([
        'success' => true,
        'message' => 'Registered',
        'instructor' => [
            'first_name' => $first,
            'last_name' => $last,
            'email' => $email,
            'specialization' => $specialization,
            'contact_number' => $contact,
            'role' => 'Teacher'
        ]
    ]);
} else {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Failed to register']);
}

$ins->close();
$mysqli->close();

?>

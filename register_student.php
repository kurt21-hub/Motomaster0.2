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

$input = json_decode(file_get_contents('php://input'), true);
if (!$input) {
    $input = $_POST;
}

$first = isset($input['first_name']) ? trim($input['first_name']) : '';
$last = isset($input['last_name']) ? trim($input['last_name']) : '';
$email = isset($input['email']) ? trim($input['email']) : '';
$section = isset($input['section']) ? trim($input['section']) : '';
$password = isset($input['password']) ? $input['password'] : '';

if (!$first || !$last || !$email || !$password) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Missing required fields']);
    exit;
}

if (strlen($email) > 150) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Email is too long']);
    exit;
}

if (strlen($first) > 50 || strlen($last) > 50) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Name is too long (max 50 characters)']);
    exit;
}

if (strlen($section) > 50) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Section is too long (max 50 characters)']);
    exit;
}

/**
 * Ensure students table exists and supports new registrations.
 */
function ensureStudentsSchema(mysqli $mysqli): void
{
    $tableRes = $mysqli->query("SHOW TABLES LIKE 'students'");
    if (!$tableRes || $tableRes->num_rows === 0) {
        $mysqli->query(
            "CREATE TABLE students (
                student_id INT(11) NOT NULL AUTO_INCREMENT,
                first_name VARCHAR(50) NOT NULL,
                last_name VARCHAR(50) NOT NULL,
                email VARCHAR(150) NOT NULL,
                password VARCHAR(255) NOT NULL,
                section VARCHAR(50) NOT NULL DEFAULT '',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (student_id),
                UNIQUE KEY email (email)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
        );
        return;
    }
    if ($tableRes) {
        $tableRes->free();
    }

    $mysqli->query('ALTER TABLE students MODIFY email VARCHAR(150) NOT NULL');
    $mysqli->query("ALTER TABLE students MODIFY section VARCHAR(50) NOT NULL DEFAULT ''");
    $mysqli->query('ALTER TABLE students MODIFY password VARCHAR(255) NOT NULL');

    $colRes = $mysqli->query("SHOW COLUMNS FROM students LIKE 'student_id'");
    if ($colRes && ($col = $colRes->fetch_assoc())) {
        $extra = strtolower($col['Extra'] ?? '');
        if (strpos($extra, 'auto_increment') === false) {
            $mysqli->query('ALTER TABLE students MODIFY student_id INT(11) NOT NULL AUTO_INCREMENT');
        }
        $colRes->free();
    }
}

function nextStudentId(mysqli $mysqli): int
{
    $res = $mysqli->query('SELECT COALESCE(MAX(student_id), 0) + 1 AS next_id FROM students');
    if (!$res) {
        return 1;
    }
    $row = $res->fetch_assoc();
    $res->free();
    return (int) ($row['next_id'] ?? 1);
}

try {
    ensureStudentsSchema($mysqli);
} catch (mysqli_sql_exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Could not prepare students table']);
    $mysqli->close();
    exit;
}

$stmt = $mysqli->prepare('SELECT student_id FROM students WHERE email = ? LIMIT 1');
$stmt->bind_param('s', $email);
$stmt->execute();
$stmt->store_result();
if ($stmt->num_rows > 0) {
    http_response_code(409);
    echo json_encode(['success' => false, 'message' => 'Email already registered']);
    $stmt->close();
    $mysqli->close();
    exit;
}
$stmt->close();

$hash = password_hash($password, PASSWORD_DEFAULT);
$studentId = null;
$registered = false;

$ins = $mysqli->prepare(
    'INSERT INTO students (first_name, last_name, email, password, section) VALUES (?, ?, ?, ?, ?)'
);
if ($ins) {
    $ins->bind_param('sssss', $first, $last, $email, $hash, $section);
    try {
        $registered = $ins->execute();
        if ($registered) {
            $studentId = (int) $mysqli->insert_id;
        }
    } catch (mysqli_sql_exception $e) {
        $registered = false;
    }
    $ins->close();
}

if (!$registered) {
    $studentId = nextStudentId($mysqli);
    $ins2 = $mysqli->prepare(
        'INSERT INTO students (student_id, first_name, last_name, email, password, section) VALUES (?, ?, ?, ?, ?, ?)'
    );
    if (!$ins2) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Failed to register']);
        $mysqli->close();
        exit;
    }
    $ins2->bind_param('isssss', $studentId, $first, $last, $email, $hash, $section);
    try {
        $registered = $ins2->execute();
    } catch (mysqli_sql_exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Failed to register: ' . $e->getMessage()]);
        $ins2->close();
        $mysqli->close();
        exit;
    }
    $ins2->close();
}

if (!$registered || !$studentId) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Failed to register']);
    $mysqli->close();
    exit;
}

echo json_encode([
    'success' => true,
    'message' => 'Registered',
    'student' => [
        'student_id' => $studentId,
        'first_name' => $first,
        'last_name' => $last,
        'email' => $email,
        'section' => $section,
        'role' => 'Student',
    ],
]);

$mysqli->close();

<?php
header('Content-Type: application/json');
require_once __DIR__ . '/auth_session.php';

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

$studentId = motoMasterRequireStudentId();

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    $moduleKey = isset($_GET['module_key']) ? trim($_GET['module_key']) : '';
    if ($moduleKey === '') {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Missing module key']);
        exit;
    }

    $noteText = '';
    $stmt = $mysqli->prepare('SELECT note_text FROM student_module_notes WHERE student_id = ? AND module_key = ? LIMIT 1');
    $stmt->bind_param('is', $studentId, $moduleKey);
    $stmt->execute();
    $stmt->bind_result($noteText);
    $found = $stmt->fetch();
    $stmt->close();

    echo json_encode([
        'success' => true,
        'student_id' => $studentId,
        'module_key' => $moduleKey,
        'note_text' => $found ? $noteText : ''
    ]);
    $mysqli->close();
    exit;
}

if ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    if (!$input) {
        $input = $_POST;
    }

    $moduleKey = isset($input['module_key']) ? trim($input['module_key']) : '';
    $noteText = isset($input['note_text']) ? trim($input['note_text']) : '';

    if ($moduleKey === '') {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Missing module key']);
        exit;
    }

    // Insert or update note (using ON DUPLICATE KEY UPDATE)
    $stmt = $mysqli->prepare(
        'INSERT INTO student_module_notes (student_id, module_key, note_text) 
         VALUES (?, ?, ?) 
         ON DUPLICATE KEY UPDATE note_text = ?, date_updated = NOW()'
    );
    $stmt->bind_param('isss', $studentId, $moduleKey, $noteText, $noteText);
    $ok = $stmt->execute();
    $stmt->close();

    if (!$ok) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Failed to save note']);
        exit;
    }

    echo json_encode([
        'success' => true,
        'message' => 'Note saved successfully',
        'module_key' => $moduleKey,
        'note_text' => $noteText
    ]);
    $mysqli->close();
    exit;
}

http_response_code(405);
echo json_encode(['success' => false, 'message' => 'Method not allowed']);
$mysqli->close();

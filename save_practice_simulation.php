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

$input = json_decode(file_get_contents('php://input'), true);
if (!$input) {
    $input = $_POST;
}

$studentId = motoMasterRequireStudentId();
$title = isset($input['title']) ? trim($input['title']) : 'Battery Maintenance';
$score = isset($input['score']) ? (float) $input['score'] : 0;
$completionStatus = isset($input['completion_status']) ? trim($input['completion_status']) : 'Completed';
$steps = isset($input['steps']) && is_array($input['steps']) ? $input['steps'] : [];
$timeElapsed = isset($input['time_elapsed_seconds']) ? (int) $input['time_elapsed_seconds'] : 0;

if ($title === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Simulation title is required']);
    exit;
}

$payload = [
    'time_elapsed_seconds' => $timeElapsed,
    'steps' => $steps,
    'saved_at' => date('c'),
];
$description = json_encode($payload, JSON_UNESCAPED_UNICODE);
if ($description === false) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid step data']);
    exit;
}

$existingId = null;
$find = $mysqli->prepare(
    "SELECT simulation_id FROM simulation
     WHERE student_id = ? AND title = ? AND completion_status <> 'Locked'
     ORDER BY simulation_id DESC LIMIT 1"
);
$find->bind_param('is', $studentId, $title);
$find->execute();
$find->bind_result($existingId);
$find->fetch();
$find->close();

if ($existingId !== null) {
    $upd = $mysqli->prepare(
        'UPDATE simulation
         SET description = ?, date_attempted = NOW(), completion_status = ?, score = ?
         WHERE simulation_id = ? AND student_id = ?'
    );
    $upd->bind_param('ssdii', $description, $completionStatus, $score, $existingId, $studentId);
    $ok = $upd->execute();
    $simulationId = $existingId;
    $upd->close();
} else {
    $nextId = 1;
    $res = $mysqli->query('SELECT COALESCE(MAX(simulation_id), 0) + 1 AS next_id FROM simulation');
    if ($res) {
        $row = $res->fetch_assoc();
        $nextId = (int) $row['next_id'];
        $res->free();
    }

    $ins = $mysqli->prepare(
        'INSERT INTO simulation (simulation_id, student_id, title, description, date_attempted, completion_status, score)
         VALUES (?, ?, ?, ?, NOW(), ?, ?)'
    );
    $ins->bind_param('iisssd', $nextId, $studentId, $title, $description, $completionStatus, $score);
    $ok = $ins->execute();
    $simulationId = $nextId;
    $ins->close();
}

if (!$ok) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Failed to save simulation results']);
    $mysqli->close();
    exit;
}

echo json_encode([
    'success' => true,
    'message' => 'Simulation results saved',
    'simulation_id' => $simulationId,
    'student_id' => $studentId,
]);

$mysqli->close();

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

if ($title === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Simulation title is required']);
    exit;
}

// Reset the simulation progress for this student and title
// Set score = 0, completion_status = 'In Progress', and empty steps
$payload = [
    'time_elapsed_seconds' => 0,
    'steps' => [],
    'saved_at' => date('c'),
];
$description = json_encode($payload, JSON_UNESCAPED_UNICODE);

$existingId = null;
$find = $mysqli->prepare(
    "SELECT simulation_id FROM simulation WHERE student_id = ? AND title = ? ORDER BY date_attempted DESC LIMIT 1"
);
$find->bind_param('is', $studentId, $title);
$find->execute();
$find->bind_result($existingId);
$find->fetch();
$find->close();

$score = 0.0;
$status = 'In Progress';

if ($existingId !== null) {
    $upd = $mysqli->prepare(
        'UPDATE simulation SET score = ?, completion_status = ?, description = ?, date_attempted = NOW() WHERE simulation_id = ? AND student_id = ?'
    );
    $upd->bind_param('dssii', $score, $status, $description, $existingId, $studentId);
    $ok = $upd->execute();
    $simulationId = $existingId;
    $upd->close();
} else {
    // Generate next simulation_id
    $nextId = 1;
    $res = $mysqli->query('SELECT COALESCE(MAX(simulation_id), 0) + 1 AS next_id FROM simulation');
    if ($res) {
        $row = $res->fetch_assoc();
        $nextId = (int) $row['next_id'];
        $res->free();
    }

    $ins = $mysqli->prepare(
        'INSERT INTO simulation (simulation_id, student_id, title, description, date_attempted, completion_status, score) VALUES (?, ?, ?, ?, NOW(), ?, ?)'
    );
    $ins->bind_param('iisssd', $nextId, $studentId, $title, $description, $status, $score);
    $ok = $ins->execute();
    $simulationId = $nextId;
    $ins->close();
}

if (!$ok) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Failed to reset simulation progress']);
    $mysqli->close();
    exit;
}

echo json_encode([
    'success' => true,
    'message' => 'Simulation progress reset successfully',
    'simulation_id' => $simulationId,
    'student_id' => $studentId,
    'title' => $title,
]);

$mysqli->close();
?>

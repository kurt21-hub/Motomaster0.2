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
$title = isset($input['title']) ? trim($input['title']) : 'Battery Maintenance Assessment';

if ($title === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Assessment title is required']);
    exit;
}

$emptySteps = [
    ['step_index' => 0, 'title' => 'Step 1: Inspect Battery Condition', 'correct' => [], 'mistakes' => [], 'score' => 0],
    ['step_index' => 1, 'title' => 'Step 2: Clean Battery Terminals', 'correct' => [], 'mistakes' => [], 'score' => 0],
    ['step_index' => 2, 'title' => 'Step 3: Check Electrolyte Level', 'correct' => [], 'mistakes' => [], 'score' => 0],
    ['step_index' => 3, 'title' => 'Step 4: Secure Battery Mount', 'correct' => [], 'mistakes' => [], 'score' => 0],
    ['step_index' => 4, 'title' => 'Step 5: Test Electrical System', 'correct' => [], 'mistakes' => [], 'score' => 0],
];

$payload = [
    'time_elapsed_seconds' => 0,
    'steps' => $emptySteps,
    'completion_status' => 'Not Started',
    'saved_at' => date('c'),
    'reset_at' => date('c'),
];
$details = json_encode($payload, JSON_UNESCAPED_UNICODE);

$existingId = null;
$find = $mysqli->prepare(
    'SELECT assessment_id FROM assessment WHERE student_id = ? AND title = ? ORDER BY date_taken DESC LIMIT 1'
);
$find->bind_param('is', $studentId, $title);
$find->execute();
$find->bind_result($existingId);
$find->fetch();
$find->close();

$score = 0.0;
$remarks = 'Not Started';
$type = 'Battery';

if ($existingId !== null) {
    $upd = $mysqli->prepare(
        'UPDATE assessment SET score = ?, remarks = ?, details = ?, type = ?, date_taken = NOW() WHERE assessment_id = ? AND student_id = ?'
    );
    $upd->bind_param('dsssii', $score, $remarks, $details, $type, $existingId, $studentId);
    $ok = $upd->execute();
    $assessmentId = $existingId;
    $upd->close();
} else {
    $ins = $mysqli->prepare(
        'INSERT INTO assessment (student_id, title, type, score, remarks, details, date_taken) VALUES (?, ?, ?, ?, ?, ?, NOW())'
    );
    $ins->bind_param('issdss', $studentId, $title, $type, $score, $remarks, $details);
    $ok = $ins->execute();
    $assessmentId = (int) $mysqli->insert_id;
    $ins->close();
}

if (!$ok) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Failed to reset assessment']);
    $mysqli->close();
    exit;
}

echo json_encode([
    'success' => true,
    'message' => 'Assessment reset',
    'assessment_id' => $assessmentId,
    'student_id' => $studentId,
    'title' => $title,
]);

$mysqli->close();

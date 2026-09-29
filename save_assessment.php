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
$score = isset($input['score']) ? (float) $input['score'] : 0;
$completionStatus = isset($input['completion_status']) ? trim($input['completion_status']) : 'Completed';
$type = isset($input['type']) ? trim($input['type']) : 'Battery';
$steps = isset($input['steps']) && is_array($input['steps']) ? $input['steps'] : [];
$timeElapsed = isset($input['time_elapsed_seconds']) ? (int) $input['time_elapsed_seconds'] : 0;

if ($title === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Assessment title is required']);
    exit;
}

$payload = [
    'time_elapsed_seconds' => $timeElapsed,
    'steps' => $steps,
    'completion_status' => $completionStatus,
    'saved_at' => date('c'),
];
$details = json_encode($payload, JSON_UNESCAPED_UNICODE);
if ($details === false) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid step data']);
    exit;
}

$remarks = $completionStatus;
if ($score >= 90) {
    $remarks = 'Excellent';
} elseif ($score >= 75) {
    $remarks = 'Good';
} elseif ($score >= 60) {
    $remarks = 'Needs Work';
} else {
    $remarks = 'Review Again';
}

$existingId = null;
$find = $mysqli->prepare(
    'SELECT assessment_id FROM assessment WHERE student_id = ? AND title = ? ORDER BY date_taken DESC LIMIT 1'
);
$find->bind_param('is', $studentId, $title);
$find->execute();
$find->bind_result($existingId);
$find->fetch();
$find->close();

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
    echo json_encode(['success' => false, 'message' => 'Failed to save assessment results']);
    $mysqli->close();
    exit;
}

echo json_encode([
    'success' => true,
    'message' => 'Assessment results saved',
    'assessment_id' => $assessmentId,
    'student_id' => $studentId,
]);

$mysqli->close();

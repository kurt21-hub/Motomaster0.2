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

function ensureProgressTable(mysqli $mysqli): void
{
    $mysqli->query(
        "CREATE TABLE IF NOT EXISTS student_module_progress (
            progress_id INT(11) NOT NULL AUTO_INCREMENT,
            student_id INT(11) NOT NULL,
            module_key VARCHAR(80) NOT NULL,
            progress_percent TINYINT(3) NOT NULL DEFAULT 0,
            date_updated DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (progress_id),
            UNIQUE KEY student_module (student_id, module_key),
            KEY idx_student_id (student_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    );

    $hasProgressId = false;
    $hasLegacyId = false;
    $columnChecks = [
        'progress_id' => &$hasProgressId,
        'id' => &$hasLegacyId,
    ];

    foreach ($columnChecks as $column => &$present) {
        $columnName = $mysqli->real_escape_string($column);
        $result = $mysqli->query("SHOW COLUMNS FROM student_module_progress LIKE '{$columnName}'");
        $present = $result && $result->num_rows > 0;
        if ($result instanceof mysqli_result) {
            $result->free();
        }
    }
    unset($present);

    if ($hasLegacyId && !$hasProgressId) {
        $mysqli->query(
            "ALTER TABLE student_module_progress CHANGE COLUMN id progress_id INT(11) NOT NULL AUTO_INCREMENT"
        );
    }

    $normalizeColumns = [
        "ALTER TABLE student_module_progress MODIFY COLUMN student_id INT(11) NOT NULL",
        "ALTER TABLE student_module_progress MODIFY COLUMN module_key VARCHAR(80) NOT NULL",
        "ALTER TABLE student_module_progress MODIFY COLUMN progress_percent TINYINT(3) NOT NULL DEFAULT 0",
        "ALTER TABLE student_module_progress MODIFY COLUMN date_updated DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP",
    ];

    foreach ($normalizeColumns as $sql) {
        $mysqli->query($sql);
    }

    $indexChecks = [
        'student_module' => "ALTER TABLE student_module_progress ADD UNIQUE KEY student_module (student_id, module_key)",
        'idx_student_id' => "ALTER TABLE student_module_progress ADD KEY idx_student_id (student_id)",
    ];

    foreach ($indexChecks as $indexName => $sql) {
        $indexNameEscaped = $mysqli->real_escape_string($indexName);
        $result = $mysqli->query("SHOW INDEX FROM student_module_progress WHERE Key_name = '{$indexNameEscaped}'");
        $hasIndex = $result && $result->num_rows > 0;
        if ($result instanceof mysqli_result) {
            $result->free();
        }
        if (!$hasIndex) {
            $mysqli->query($sql);
        }
    }
}

function resolveStudentId(mysqli $mysqli, ?int $studentId, string $email): ?int
{
    if ($studentId !== null && $studentId > 0) {
        return $studentId;
    }
    if ($email === '') {
        return null;
    }
    $stmt = $mysqli->prepare('SELECT student_id FROM students WHERE email = ? LIMIT 1');
    $stmt->bind_param('s', $email);
    $stmt->execute();
    $stmt->bind_result($foundId);
    $resolved = null;
    if ($stmt->fetch()) {
        $resolved = (int) $foundId;
    }
    $stmt->close();
    return $resolved;
}

ensureProgressTable($mysqli);

$authenticatedStudentId = motoMasterRequireStudentId();

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    $studentId = $authenticatedStudentId;

    $progress = [];
    $progressDetails = [];
    $stmt = $mysqli->prepare(
        'SELECT module_key, progress_percent, date_updated FROM student_module_progress WHERE student_id = ?'
    );
    $stmt->bind_param('i', $studentId);
    $stmt->execute();
    $result = $stmt->get_result();
    while ($row = $result->fetch_assoc()) {
        $progress[$row['module_key']] = (int) $row['progress_percent'];
        $progressDetails[] = [
            'module_key' => $row['module_key'],
            'progress_percent' => (int) $row['progress_percent'],
            'date_updated' => $row['date_updated']
        ];
    }
    $stmt->close();

    echo json_encode([
        'success' => true,
        'student_id' => $studentId,
        'progress' => $progress,
        'progress_details' => $progressDetails,
    ]);
    $mysqli->close();
    exit;
}

if ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    if (!$input) {
        $input = $_POST;
    }

    $studentId = $authenticatedStudentId;
    $moduleKey = isset($input['module_key']) ? trim($input['module_key']) : '';
    $progressPercent = isset($input['progress_percent']) ? (int) $input['progress_percent'] : 0;

    if ($moduleKey === '' || strpos($moduleKey, 'mod_progress_') !== 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Invalid module key']);
        exit;
    }

    $progressPercent = max(0, min(100, $progressPercent));

    $existingPct = 0;
    $find = $mysqli->prepare(
        'SELECT progress_percent FROM student_module_progress WHERE student_id = ? AND module_key = ? LIMIT 1'
    );
    $find->bind_param('is', $studentId, $moduleKey);
    $find->execute();
    $find->bind_result($existingPct);
    $hasRow = $find->fetch();
    $find->close();

    $finalPct = $hasRow ? max((int) $existingPct, $progressPercent) : $progressPercent;

    if ($hasRow) {
        $upd = $mysqli->prepare(
            'UPDATE student_module_progress SET progress_percent = ?, date_updated = NOW()
             WHERE student_id = ? AND module_key = ?'
        );
        $upd->bind_param('iis', $finalPct, $studentId, $moduleKey);
        $ok = $upd->execute();
        $upd->close();
    } else {
        $ins = $mysqli->prepare(
            'INSERT INTO student_module_progress (student_id, module_key, progress_percent, date_updated)
             VALUES (?, ?, ?, NOW())'
        );
        $ins->bind_param('isi', $studentId, $moduleKey, $finalPct);
        $ok = $ins->execute();
        $ins->close();
    }

    if (!$ok) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Failed to save progress']);
        exit;
    }

    echo json_encode([
        'success' => true,
        'student_id' => $studentId,
        'module_key' => $moduleKey,
        'progress_percent' => $finalPct,
    ]);
    $mysqli->close();
    exit;
}

http_response_code(405);
echo json_encode(['success' => false, 'message' => 'Method not allowed']);
$mysqli->close();

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

$currentUser = motoMasterRequireAuthenticatedUser();

function motoMasterEnsureMessagesTable(mysqli $mysqli): void
{
    $createSql = "CREATE TABLE IF NOT EXISTS messages (
        message_id INT AUTO_INCREMENT PRIMARY KEY,
        sender_role VARCHAR(20) NOT NULL,
        sender_id INT NOT NULL,
        sender_name VARCHAR(150) NOT NULL,
        recipient_role VARCHAR(20) NOT NULL,
        recipient_id INT NOT NULL DEFAULT 0,
        recipient_name VARCHAR(150) NULL,
        subject VARCHAR(200) NOT NULL DEFAULT '',
        message_text TEXT NOT NULL,
        category VARCHAR(20) NOT NULL DEFAULT 'message',
        is_read TINYINT(1) NOT NULL DEFAULT 0,
        read_at DATETIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_recipient (recipient_role, recipient_id, is_read, created_at),
        INDEX idx_sender (sender_role, sender_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";

    if (!$mysqli->query($createSql)) {
        motoMasterJsonFail('Failed to initialize messages storage', 500);
    }
}

function motoMasterResolveUserByRoleAndId(mysqli $mysqli, string $role, int $userId): ?array
{
    $map = [
        'Student' => ['table' => 'students', 'id' => 'student_id', 'name' => 'CONCAT(first_name, " ", last_name)', 'email' => 'email'],
        'Teacher' => ['table' => 'instructors', 'id' => 'instructor_id', 'name' => 'CONCAT(first_name, " ", last_name)', 'email' => 'email'],
        'Admin' => ['table' => 'admin', 'id' => 'admin_id', 'name' => 'CONCAT(first_name, " ", last_name)', 'email' => 'email'],
    ];

    if (!isset($map[$role])) {
        return null;
    }

    $config = $map[$role];
    $sql = "SELECT {$config['id']} AS user_id, {$config['name']} AS full_name, {$config['email']} AS email FROM {$config['table']} WHERE {$config['id']} = ? LIMIT 1";
    $stmt = $mysqli->prepare($sql);
    if (!$stmt) {
        return null;
    }

    $stmt->bind_param('i', $userId);
    $stmt->execute();
    $result = $stmt->get_result();
    $row = $result ? $result->fetch_assoc() : null;
    $stmt->close();

    if (!$row) {
        return null;
    }

    return [
        'role' => $role,
        'user_id' => (int) $row['user_id'],
        'name' => trim((string) $row['full_name']),
        'email' => (string) $row['email'],
    ];
}

function motoMasterResolveRecipient(mysqli $mysqli, array $input): ?array
{
    $recipientRole = isset($input['recipient_role']) ? trim((string) $input['recipient_role']) : '';
    $recipientEmail = isset($input['recipient_email']) ? trim((string) $input['recipient_email']) : '';
    $recipientId = isset($input['recipient_id']) ? (int) $input['recipient_id'] : 0;
    $broadcast = !empty($input['broadcast']);

    if ($recipientRole === '') {
        return null;
    }

    if ($broadcast) {
        if (!in_array($recipientRole, ['All', 'Student', 'Teacher', 'Admin'], true)) {
            return null;
        }

        return [
            'role' => $recipientRole,
            'user_id' => 0,
            'name' => $recipientRole === 'All' ? 'All Users' : 'All ' . $recipientRole . 's',
            'email' => '',
            'broadcast' => true,
        ];
    }

    if ($recipientEmail !== '') {
        $lookups = [
            'Student' => ['table' => 'students', 'id' => 'student_id', 'name' => 'CONCAT(first_name, " ", last_name)'],
            'Teacher' => ['table' => 'instructors', 'id' => 'instructor_id', 'name' => 'CONCAT(first_name, " ", last_name)'],
            'Admin' => ['table' => 'admin', 'id' => 'admin_id', 'name' => 'CONCAT(first_name, " ", last_name)'],
        ];

        $preferredRoles = $recipientRole === 'All' ? ['Student', 'Teacher', 'Admin'] : [$recipientRole];

        foreach ($preferredRoles as $role) {
            if (!isset($lookups[$role])) {
                continue;
            }

            $config = $lookups[$role];
            $sql = "SELECT {$config['id']} AS user_id, {$config['name']} AS full_name, email FROM {$config['table']} WHERE email = ? LIMIT 1";
            $stmt = $mysqli->prepare($sql);
            if (!$stmt) {
                continue;
            }

            $stmt->bind_param('s', $recipientEmail);
            $stmt->execute();
            $result = $stmt->get_result();
            $row = $result ? $result->fetch_assoc() : null;
            $stmt->close();

            if ($row) {
                return [
                    'role' => $role,
                    'user_id' => (int) $row['user_id'],
                    'name' => trim((string) $row['full_name']),
                    'email' => (string) $row['email'],
                    'broadcast' => false,
                ];
            }
        }
    }

    if ($recipientId > 0) {
        return motoMasterResolveUserByRoleAndId($mysqli, $recipientRole, $recipientId);
    }

    return null;
}

motoMasterEnsureMessagesTable($mysqli);

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    $currentRole = $currentUser['role'];
    $currentUserId = (int) $currentUser['user_id'];

    if (isset($_GET['mark_read'])) {
        $upd = $mysqli->prepare(
            "UPDATE messages
             SET is_read = 1, read_at = NOW()
             WHERE ((recipient_role = ? AND (recipient_id = ? OR recipient_id = 0)) OR recipient_role = 'All')
             AND NOT (sender_role = ? AND sender_id = ?)"
        );
        $upd->bind_param("sisi", $currentRole, $currentUserId, $currentRole, $currentUserId);
        $upd->execute();
        $upd->close();
    }

     $messages = [];
     $stmt = $mysqli->prepare(
          "SELECT message_id, sender_role, sender_id, sender_name, recipient_role, recipient_id, recipient_name, subject, message_text, category, is_read, read_at, created_at 
            FROM messages 
            WHERE (sender_role = ? AND sender_id = ?) 
                OR ((recipient_role = ? AND (recipient_id = ? OR recipient_id = 0)) OR recipient_role = 'All') 
            ORDER BY created_at DESC"
     );
    $stmt->bind_param('sisi', $currentRole, $currentUserId, $currentRole, $currentUserId);
    $stmt->execute();
    $result = $stmt->get_result();
    while ($row = $result->fetch_assoc()) {
        $isOutgoing = $row['sender_role'] === $currentRole && (int) $row['sender_id'] === $currentUserId;
        $messages[] = [
            'message_id' => (int) $row['message_id'],
            'sender_role' => $row['sender_role'],
            'sender_id' => (int) $row['sender_id'],
            'sender_name' => $row['sender_name'],
            'recipient_role' => $row['recipient_role'],
            'recipient_id' => (int) $row['recipient_id'],
            'recipient_name' => $row['recipient_name'],
            'subject' => $row['subject'],
            'message_text' => $row['message_text'],
            'category' => $row['category'],
            'created_at' => $row['created_at'],
            'read_at' => $row['read_at'],
            'is_read' => (int) $row['is_read'],
            'direction' => $isOutgoing ? 'outgoing' : 'incoming'
        ];
    }
    $stmt->close();

    echo json_encode([
        'success' => true,
        'user' => $currentUser,
        'messages' => $messages,
        'unread_count' => count(array_filter($messages, static function ($message) {
            return $message['direction'] === 'incoming' && $message['is_read'] === 0;
        }))
    ]);
    $mysqli->close();
    exit;
}

if ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    if (!$input) {
        $input = $_POST;
    }

    $recipient = motoMasterResolveRecipient($mysqli, $input);
    $subject = isset($input['subject']) ? trim((string) $input['subject']) : '';
    $messageText = isset($input['message_text']) ? trim((string) $input['message_text']) : '';
    $category = isset($input['category']) ? trim((string) $input['category']) : 'message';

    if ($category === '') {
        $category = 'message';
    }

    if (!$recipient || $messageText === '') {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Please choose a recipient and enter a message']);
        exit;
    }

    $senderRole = (string) $currentUser['role'];
    $senderId = (int) $currentUser['user_id'];
    $senderName = trim((string) $currentUser['name']);
    if ($senderName === '') {
        $senderName = $senderRole;
    }
    $recipientRole = (string) $recipient['role'];
    $recipientId = (int) $recipient['user_id'];
    $recipientName = (string) $recipient['name'];

    $stmt = $mysqli->prepare(
        'INSERT INTO messages (sender_role, sender_id, sender_name, recipient_role, recipient_id, recipient_name, subject, message_text, category, is_read, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NOW())'
    );
    if (!$stmt) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Failed to prepare message']);
        exit;
    }

    $stmt->bind_param(
        'sississss',
        $senderRole,
        $senderId,
        $senderName,
        $recipientRole,
        $recipientId,
        $recipientName,
        $subject,
        $messageText,
        $category
    );
    $ok = $stmt->execute();
    $stmt->close();

    if (!$ok) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Failed to send message']);
        exit;
    }

    echo json_encode([
        'success' => true,
        'message' => 'Message sent successfully'
    ]);
    $mysqli->close();
    exit;
}

http_response_code(405);
echo json_encode(['success' => false, 'message' => 'Method not allowed']);
$mysqli->close();

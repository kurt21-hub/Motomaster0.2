<?php
/**
 * MotoMaster Database Setup Script
 * Run this once to create the database and all tables
 */

$dbHost = '127.0.0.1';
$dbUser = 'root';
$dbPass = '';
$dbName = 'motomasterdb';

header('Content-Type: text/plain');

echo "=== MotoMaster Database Setup ===\n\n";

// Connect without database to create it
$mysqli = new mysqli($dbHost, $dbUser, $dbPass);
if ($mysqli->connect_errno) {
    die("Failed to connect to MySQL: " . $mysqli->connect_error . "\n");
}
echo "1. Connected to MySQL server\n";

// Create database if not exists
$createDb = "CREATE DATABASE IF NOT EXISTS $dbName CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci";
if (!$mysqli->query($createDb)) {
    die("Failed to create database: " . $mysqli->error . "\n");
}
echo "2. Database '$dbName' created/verified\n";

// Select the database
$mysqli->select_db($dbName);

// Create students table
$studentsTable = "CREATE TABLE IF NOT EXISTS students (
    student_id INT(11) NOT NULL AUTO_INCREMENT,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    section VARCHAR(50) NOT NULL DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (student_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";

if (!$mysqli->query($studentsTable)) {
    echo "ERROR creating students table: " . $mysqli->error . "\n";
} else {
    echo "3. Students table created/verified\n";
}

// Create instructors table
$instructorsTable = "CREATE TABLE IF NOT EXISTS instructors (
    instructor_id INT AUTO_INCREMENT PRIMARY KEY,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    specialization VARCHAR(100) NOT NULL,
    contact_number VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";

if (!$mysqli->query($instructorsTable)) {
    echo "ERROR creating instructors table: " . $mysqli->error . "\n";
} else {
    echo "4. Instructors table created/verified\n";
}

// Create admin table
$adminTable = "CREATE TABLE IF NOT EXISTS admin (
    admin_id INT AUTO_INCREMENT PRIMARY KEY,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";

if (!$mysqli->query($adminTable)) {
    echo "ERROR creating admin table: " . $mysqli->error . "\n";
} else {
    echo "5. Admin table created/verified\n";
}

// Create simulation table
$simulationTable = "CREATE TABLE IF NOT EXISTS simulation (
    simulation_id INT NOT NULL,
    student_id INT NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    date_attempted DATETIME DEFAULT CURRENT_TIMESTAMP,
    completion_status VARCHAR(50),
    score DECIMAL(5,2),
    PRIMARY KEY (simulation_id, student_id),
    INDEX idx_student (student_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";

if (!$mysqli->query($simulationTable)) {
    echo "ERROR creating simulation table: " . $mysqli->error . "\n";
} else {
    echo "6. Simulation table created/verified\n";
}

// Create student_module_progress table
$progressTable = "CREATE TABLE IF NOT EXISTS student_module_progress (
    progress_id INT(11) NOT NULL AUTO_INCREMENT,
    student_id INT(11) NOT NULL,
    module_key VARCHAR(80) NOT NULL,
    progress_percent TINYINT(3) NOT NULL DEFAULT 0,
    date_updated DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (progress_id),
    UNIQUE KEY student_module (student_id, module_key),
    KEY idx_student_id (student_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";

if (!$mysqli->query($progressTable)) {
    echo "ERROR creating student_module_progress table: " . $mysqli->error . "\n";
} else {
    echo "7. Student module progress table created/verified\n";
}

// Create assessment_results table
$assessmentTable = "CREATE TABLE IF NOT EXISTS assessment_results (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    assessment_type VARCHAR(50) NOT NULL,
    score INT NOT NULL,
    total_questions INT NOT NULL,
    correct_answers INT NOT NULL,
    completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_student (student_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";

if (!$mysqli->query($assessmentTable)) {
    echo "ERROR creating assessment_results table: " . $mysqli->error . "\n";
} else {
    echo "8. Assessment results table created/verified\n";
}

// Create assessment table
$assessmentMainTable = "CREATE TABLE IF NOT EXISTS assessment (
    assessment_id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    title VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL,
    score DECIMAL(5,2) NOT NULL,
    remarks VARCHAR(50) NOT NULL,
    details LONGTEXT,
    date_taken TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_student_assess (student_id),
    FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";

if (!$mysqli->query($assessmentMainTable)) {
    echo "ERROR creating assessment table: " . $mysqli->error . "\n";
} else {
    echo "8b. Assessment table created/verified\n";
}

// Create activity_logs table
$logsTable = "CREATE TABLE IF NOT EXISTS activity_logs (
    log_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    user_type VARCHAR(20),
    action VARCHAR(100),
    details TEXT,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user (user_id),
    INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";

if (!$mysqli->query($logsTable)) {
    echo "ERROR creating activity_logs table: " . $mysqli->error . "\n";
} else {
    echo "9. Activity logs table created/verified\n";
}

// Create messages table
$messagesTable = "CREATE TABLE IF NOT EXISTS messages (
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

if (!$mysqli->query($messagesTable)) {
    echo "ERROR creating messages table: " . $mysqli->error . "\n";
} else {
    echo "10. Messages table created/verified\n";
}

$mysqli->close();

echo "\n=== Setup Complete ===\n";
echo "You can now register student, teacher, and admin accounts.\n";
?>

<?php
header('Content-Type: application/json');
require_once __DIR__ . '/auth_session.php';

// Verify teacher session
motoMasterStartSession();
if (!isset($_SESSION['role']) || $_SESSION['role'] !== 'Teacher') {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Access denied: Teachers only']);
    exit;
}

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

$action = isset($_GET['action']) ? $_GET['action'] : 'get_dashboard_data';

// Helper: relative time formatter
function formatSQLDateRelative($dateStr) {
    if (!$dateStr) return '—';
    $time = strtotime($dateStr);
    if (!$time) return $dateStr;
    
    $diff = time() - $time;
    if ($diff < 60) return 'Just now';
    if ($diff < 3600) return round($diff / 60) . 'm ago';
    if ($diff < 86400) return round($diff / 3600) . 'h ago';
    if ($diff < 172800) return 'Yesterday';
    return date('M d, Y', $time);
}

// Module keys array
$moduleKeys = [
    'Engine Oil Change' => 'mod_progress_enginemodule',
    'Brake Pad Replacement' => 'mod_progress_brakemodule',
    'Air Filter Replacement' => 'mod_progress_airmodule',
    'Fuel Filter Replacement' => 'mod_progress_fuelmodule',
    'Battery Maintenance' => 'mod_progress_batterymodule',
    'Spark Plug Replacement' => 'mod_progress_sparkmodule'
];

$moduleColors = [
    'Engine Oil Change' => '#2563eb',
    'Brake Pad Replacement' => '#16a34a',
    'Air Filter Replacement' => '#d97706',
    'Fuel Filter Replacement' => '#9333ea',
    'Battery Maintenance' => '#06b6d4',
    'Spark Plug Replacement' => '#ec4899'
];

// 1. FETCH ALL STUDENTS WITH AGGREGATED STATS
if ($action === 'get_students_data' || $action === 'get_dashboard_data' || $action === 'get_analytics_data') {
    $studentsList = [];
    
    $res = $mysqli->query('SELECT student_id, first_name, last_name, email, section, created_at FROM students ORDER BY last_name ASC');
    if ($res) {
        while ($s = $res->fetch_assoc()) {
            $studentId = (int)$s['student_id'];
            $name = $s['first_name'] . ' ' . $s['last_name'];
            $initials = strtoupper(substr($s['first_name'], 0, 1) . substr($s['last_name'], 0, 1));
            
            // Default color based on first letter
            $char = ord(substr($s['last_name'], 0, 1)) % 5;
            $colors = ['#2563eb', '#16a34a', '#9333ea', '#d97706', '#06b6d4'];
            $color = $colors[$char];
            
            // Get module progress
            $modProgressMap = [];
            $stmt = $mysqli->prepare('SELECT module_key, progress_percent, date_updated FROM student_module_progress WHERE student_id = ?');
            $stmt->bind_param('i', $studentId);
            $stmt->execute();
            $stmt->bind_result($mKey, $progVal, $dateUpd);
            $lastModuleDate = null;
            while ($stmt->fetch()) {
                $modProgressMap[$mKey] = (int)$progVal;
                if ($dateUpd && (!$lastModuleDate || $dateUpd > $lastModuleDate)) {
                    $lastModuleDate = $dateUpd;
                }
            }
            $stmt->close();
            
            // Get practice simulation progress
            $practiceMap = [];
            $stmt = $mysqli->prepare("SELECT title, score, completion_status, date_attempted FROM simulation WHERE student_id = ? AND completion_status <> 'Locked'");
            $stmt->bind_param('i', $studentId);
            $stmt->execute();
            $stmt->bind_result($pTitle, $pScore, $pStatus, $pDate);
            $lastPracticeDate = null;
            while ($stmt->fetch()) {
                $practiceMap[$pTitle] = [
                    'score' => (float)$pScore,
                    'status' => $pStatus,
                    'date' => $pDate
                ];
                if ($pDate && (!$lastPracticeDate || $pDate > $lastPracticeDate)) {
                    $lastPracticeDate = $pDate;
                }
            }
            $stmt->close();
            
            // Get assessment progress
            $assessMap = [];
            $stmt = $mysqli->prepare('SELECT title, score, remarks, date_taken FROM assessment WHERE student_id = ?');
            $stmt->bind_param('i', $studentId);
            $stmt->execute();
            $stmt->bind_result($aTitle, $aScore, $aRemarks, $aDate);
            $lastAssessmentDate = null;
            $lastAssessmentName = 'None';
            while ($stmt->fetch()) {
                $assessMap[$aTitle] = [
                    'score' => (float)$aScore,
                    'remarks' => $aRemarks,
                    'date' => $aDate
                ];
                if ($aDate && (!$lastAssessmentDate || $aDate > $lastAssessmentDate)) {
                    $lastAssessmentDate = $aDate;
                    $lastAssessmentName = str_replace(' Assessment', '', $aTitle) . ' — ' . date('M d', strtotime($aDate));
                }
            }
            $stmt->close();
            
            // Calculate overall metrics
            // Modules completed count (progress >= 100)
            $completedModules = 0;
            $totalModuleProgSum = 0;
            foreach ($moduleKeys as $mTitle => $mKey) {
                $prog = $modProgressMap[$mKey] ?? 0;
                $totalModuleProgSum += $prog;
                if ($prog >= 100) {
                    $completedModules++;
                }
            }
            $avgModuleProg = count($moduleKeys) > 0 ? ($totalModuleProgSum / count($moduleKeys)) : 0;
            
            // Practice completion rate
            $completedPractices = 0;
            foreach ($practiceMap as $title => $pData) {
                if ($pData['status'] === 'Completed') {
                    $completedPractices++;
                }
            }
            $practiceRate = count($moduleKeys) > 0 ? ($completedPractices / count($moduleKeys) * 100) : 0;
            
            // Assessment completion rate and score
            $completedAssessments = 0;
            $totalAssessScoreSum = 0;
            foreach ($assessMap as $title => $aData) {
                if ($aData['remarks'] === 'Completed' || $aData['remarks'] === 'Excellent' || $aData['remarks'] === 'Good' || $aData['remarks'] === 'Needs Work' || $aData['remarks'] === 'Review Again') {
                    $completedAssessments++;
                    $totalAssessScoreSum += $aData['score'];
                }
            }
            $assessRate = count($moduleKeys) > 0 ? ($completedAssessments / count($moduleKeys) * 100) : 0;
            $avgAssessScore = $completedAssessments > 0 ? round($totalAssessScoreSum / $completedAssessments) : 0;
            
            // Overall progress
            $overallProgress = round(($avgModuleProg + $practiceRate + $assessRate) / 3);
            
            // Last active date
            $dates = array_filter([$lastModuleDate, $lastPracticeDate, $lastAssessmentDate, $s['created_at']]);
            $lastActiveDate = count($dates) > 0 ? max($dates) : $s['created_at'];
            $lastActiveStr = formatSQLDateRelative($lastActiveDate);
            
            // Determine student status
            $status = 'on-track';
            if ($avgAssessScore > 0 && $avgAssessScore < 65) {
                $status = 'at-risk';
            } elseif ($overallProgress < 50 && $overallProgress > 0) {
                $status = 'at-risk';
            }
            
            // If inactive for > 14 days
            if (strtotime($lastActiveDate) < (time() - 14 * 86400)) {
                $status = 'inactive';
            }
            
            // Build moduleProgress detailed breakdown
            $modProgressBreakdown = [];
            foreach ($moduleKeys as $mTitle => $mKey) {
                $progVal = $modProgressMap[$mKey] ?? 0;
                $assessTitle = $mTitle . ' Assessment';
                $scoreVal = isset($assessMap[$assessTitle]) ? (int)$assessMap[$assessTitle]['score'] : 0;
                $modProgressBreakdown[] = [
                    'n' => $mTitle,
                    'c' => $moduleColors[$mTitle] ?? '#64748b',
                    'p' => $progVal,
                    's' => $scoreVal
                ];
            }
            
            $studentsList[] = [
                'id' => $studentId,
                'initials' => $initials,
                'color' => $color,
                'name' => $name,
                'grade' => 'Section ' . $s['section'],
                'sid' => 'STU-' . str_pad($studentId, 3, '0', STR_PAD_LEFT),
                'status' => $status,
                'modules' => $completedModules,
                'progress' => $overallProgress,
                'score' => $avgAssessScore,
                'lastActive' => $lastActiveStr,
                'lastAssessment' => $lastAssessmentName,
                'moduleProgress' => $modProgressBreakdown,
                'email' => $s['email']
            ];
        }
    }
}

// 2. FETCH ALL LOGS (PRACTICE AND ASSESSMENT LOGS JOINED WITH STUDENTS)
if ($action === 'get_logs' || $action === 'get_dashboard_data') {
    $practiceSessions = [];
    $assessmentsList = [];
    $recentActivities = [];
    
    // Fetch practices
    $res = $mysqli->query('SELECT p.simulation_id, p.title, p.score, p.completion_status, p.date_attempted, s.first_name, s.last_name, s.student_id
                           FROM simulation p
                           JOIN students s ON p.student_id = s.student_id
                           ORDER BY p.date_attempted DESC');
    if ($res) {
        while ($row = $res->fetch_assoc()) {
            $sessId = (int)$row['simulation_id'];
            $studentName = $row['first_name'] . ' ' . $row['last_name'];
            $title = $row['title'];
            $score = (float)$row['score'];
            $status = $row['completion_status'];
            $date = $row['date_attempted'];
            
            $practiceSessions[] = [
                'session_id' => $sessId,
                'student_id' => (int)$row['student_id'],
                'student_name' => $studentName,
                'title' => $title,
                'score' => $score,
                'status' => $status,
                'date_attempted' => $date,
                'date_formatted' => formatSQLDateRelative($date)
            ];
            
            $recentActivities[] = [
                'student_name' => $studentName,
                'title' => $title . ' Practice',
                'status' => $status,
                'type' => 'practice',
                'date' => $date,
                'timeStr' => formatSQLDateRelative($date)
            ];
        }
    }
    
    // Fetch assessments
    $res = $mysqli->query('SELECT a.assessment_id, a.title, a.score, a.remarks, a.date_taken, s.first_name, s.last_name, s.student_id
                           FROM assessment a
                           JOIN students s ON a.student_id = s.student_id
                           ORDER BY a.date_taken DESC');
    if ($res) {
        while ($row = $res->fetch_assoc()) {
            $assessId = (int)$row['assessment_id'];
            $studentName = $row['first_name'] . ' ' . $row['last_name'];
            $title = $row['title'];
            $score = (float)$row['score'];
            $remarks = $row['remarks'];
            $date = $row['date_taken'];
            
            $assessmentsList[] = [
                'assessment_id' => $assessId,
                'student_id' => (int)$row['student_id'],
                'student_name' => $studentName,
                'title' => $title,
                'score' => $score,
                'remarks' => $remarks,
                'date_taken' => $date,
                'date_formatted' => formatSQLDateRelative($date)
            ];
            
            $recentActivities[] = [
                'student_name' => $studentName,
                'title' => str_replace(' Assessment', '', $title) . ' Assessment',
                'status' => $remarks,
                'type' => 'assessment',
                'date' => $date,
                'timeStr' => formatSQLDateRelative($date)
            ];
        }
    }
    
    // Sort recent activities newest first
    usort($recentActivities, function($a, $b) {
        return strtotime($b['date']) - strtotime($a['date']);
    });
}

// 3. ACTION OUTPUTS
if ($action === 'get_students_data') {
    echo json_encode([
        'success' => true,
        'students' => $studentsList
    ]);
} elseif ($action === 'get_logs') {
    echo json_encode([
        'success' => true,
        'practice_sessions' => $practiceSessions,
        'assessments' => $assessmentsList
    ]);
} elseif ($action === 'get_dashboard_data') {
    // Aggregated stats for dashboard cards
    $totalStudents = count($studentsList);
    $totalAssessmentScores = 0;
    $completedAssessCount = 0;
    $totalModuleProgress = 0;
    $atRiskCount = 0;
    
    foreach ($studentsList as $s) {
        if ($s['status'] === 'at-risk') {
            $atRiskCount++;
        }
        $totalModuleProgress += $s['progress'];
    }
    
    // Average progress
    $avgProgress = $totalStudents > 0 ? round($totalModuleProgress / $totalStudents) : 0;
    
    // Average score across all assessments
    $scoreSum = 0;
    $scoreCount = 0;
    foreach ($assessmentsList as $a) {
        $scoreSum += $a['score'];
        $scoreCount++;
    }
    $avgScore = $scoreCount > 0 ? round($scoreSum / $scoreCount) : 0;
    
    echo json_encode([
        'success' => true,
        'stats' => [
            'total_students' => $totalStudents,
            'avg_progress' => $avgProgress,
            'avg_score' => $avgScore,
            'at_risk_count' => $atRiskCount,
            'pending_reviews' => $atRiskCount, // using atRisk as demo pending reviews
            'active_modules' => 6
        ],
        'students' => $studentsList,
        'recent_activities' => array_slice($recentActivities, 0, 10),
        'practice_sessions' => array_slice($practiceSessions, 0, 10),
        'assessments' => array_slice($assessmentsList, 0, 10)
    ]);
}

$mysqli->close();
?>

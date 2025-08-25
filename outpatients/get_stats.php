<?php
/**
 * الحصول على إحصائيات المعاينة - مستشفى الوحدة العلاجي
 * Get Outpatient Statistics - Hospital Unity
 */

header('Content-Type: application/json; charset=utf-8');

require_once '../includes/functions.php';

// التحقق من تسجيل الدخول
if (!$hospital->isLoggedIn()) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'غير مصرح']);
    exit();
}

$date = $_GET['date'] ?? date('Y-m-d');

try {
    $db = (new Database())->getConnection();
    
    // إحصائيات اليوم
    $stats_query = "SELECT 
                        COUNT(*) as total,
                        SUM(CASE WHEN status = 'waiting' THEN 1 ELSE 0 END) as waiting,
                        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
                        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
                        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled
                    FROM outpatients WHERE visit_date = :date";
    
    $stats_stmt = $db->prepare($stats_query);
    $stats_stmt->bindParam(':date', $date);
    $stats_stmt->execute();
    
    $stats = $stats_stmt->fetch();
    
    echo json_encode([
        'success' => true,
        'stats' => $stats,
        'date' => $date
    ]);
    
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'message' => 'حدث خطأ في جلب الإحصائيات'
    ]);
}
?>
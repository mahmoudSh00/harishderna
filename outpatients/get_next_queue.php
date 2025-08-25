<?php
/**
 * الحصول على رقم الطابور التالي - مستشفى الوحدة العلاجي
 * Get Next Queue Number - Hospital Unity
 */

header('Content-Type: application/json; charset=utf-8');

require_once '../includes/functions.php';

// التحقق من تسجيل الدخول
if (!$hospital->isLoggedIn()) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'غير مصرح']);
    exit();
}

// التحقق من وجود التاريخ
$date = $_GET['date'] ?? date('Y-m-d');

try {
    $queue_number = $hospital->getNextQueueNumber($date);
    
    if ($queue_number === false) {
        echo json_encode([
            'success' => false,
            'message' => 'تم الوصول للحد الأقصى من أرقام الطابور'
        ]);
    } else {
        echo json_encode([
            'success' => true,
            'queue_number' => $queue_number,
            'date' => $date
        ]);
    }
    
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'message' => 'حدث خطأ في جلب رقم الطابور'
    ]);
}
?>
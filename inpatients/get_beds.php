<?php
/**
 * الحصول على الأسرة المتاحة - مستشفى الوحدة العلاجي
 * Get Available Beds - Hospital Unity
 */

header('Content-Type: application/json; charset=utf-8');

require_once '../includes/functions.php';

// التحقق من تسجيل الدخول
if (!$hospital->isLoggedIn()) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'غير مصرح']);
    exit();
}

// التحقق من وجود معرف الغرفة
if (empty($_GET['room_id'])) {
    echo json_encode(['success' => false, 'message' => 'معرف الغرفة مطلوب']);
    exit();
}

$room_id = intval($_GET['room_id']);

try {
    $db = (new Database())->getConnection();
    
    // الحصول على الأسرة في الغرفة المحددة
    $query = "SELECT id, bed_number, is_occupied FROM beds WHERE room_id = :room_id ORDER BY bed_number";
    $stmt = $db->prepare($query);
    $stmt->bindParam(':room_id', $room_id);
    $stmt->execute();
    
    $beds = $stmt->fetchAll();
    
    echo json_encode([
        'success' => true,
        'beds' => $beds
    ]);
    
} catch (Exception $e) {
    echo json_encode([
        'success' => false,
        'message' => 'حدث خطأ في جلب البيانات'
    ]);
}
?>
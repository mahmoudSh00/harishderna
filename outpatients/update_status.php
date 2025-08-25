<?php
/**
 * تحديث حالة المريض - مستشفى الوحدة العلاجي
 * Update Patient Status - Hospital Unity
 */

header('Content-Type: application/json; charset=utf-8');

require_once '../includes/functions.php';

// التحقق من تسجيل الدخول
if (!$hospital->isLoggedIn()) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'غير مصرح']);
    exit();
}

// التحقق من البيانات المطلوبة
if (empty($_POST['patient_id']) || empty($_POST['status'])) {
    echo json_encode(['success' => false, 'message' => 'البيانات المطلوبة مفقودة']);
    exit();
}

$patient_id = intval($_POST['patient_id']);
$status = $_POST['status'];

// التحقق من صحة الحالة
$valid_statuses = ['waiting', 'in_progress', 'completed', 'cancelled'];
if (!in_array($status, $valid_statuses)) {
    echo json_encode(['success' => false, 'message' => 'حالة غير صحيحة']);
    exit();
}

try {
    $db = (new Database())->getConnection();
    
    // التحقق من وجود المريض
    $check_query = "SELECT id, patient_name, status FROM outpatients WHERE id = :id";
    $check_stmt = $db->prepare($check_query);
    $check_stmt->bindParam(':id', $patient_id);
    $check_stmt->execute();
    
    $patient = $check_stmt->fetch();
    if (!$patient) {
        echo json_encode(['success' => false, 'message' => 'المريض غير موجود']);
        exit();
    }
    
    // تحديث حالة المريض
    $update_query = "UPDATE outpatients SET status = :status, updated_at = CURRENT_TIMESTAMP WHERE id = :id";
    $update_stmt = $db->prepare($update_query);
    $update_stmt->bindParam(':status', $status);
    $update_stmt->bindParam(':id', $patient_id);
    
    if ($update_stmt->execute()) {
        // تسجيل العملية
        $status_text = '';
        switch ($status) {
            case 'waiting':
                $status_text = 'في الانتظار';
                break;
            case 'in_progress':
                $status_text = 'قيد الفحص';
                break;
            case 'completed':
                $status_text = 'مكتمل';
                break;
            case 'cancelled':
                $status_text = 'ملغي';
                break;
        }
        
        $hospital->logActivity(
            $_SESSION['user_id'], 
            "تحديث حالة المريض إلى: {$status_text}", 
            'outpatients', 
            $patient_id
        );
        
        echo json_encode([
            'success' => true, 
            'message' => 'تم تحديث حالة المريض بنجاح',
            'new_status' => $status,
            'status_text' => $status_text
        ]);
    } else {
        echo json_encode(['success' => false, 'message' => 'فشل في تحديث حالة المريض']);
    }
    
} catch (Exception $e) {
    echo json_encode(['success' => false, 'message' => 'حدث خطأ في النظام']);
}
?>
<?php
/**
 * معالجة تسجيل الدخول - مستشفى الوحدة العلاجي
 * Login Handler - Hospital Unity
 */

header('Content-Type: application/json; charset=utf-8');

require_once '../includes/functions.php';

// التحقق من طريقة الطلب
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode([
        'success' => false,
        'message' => 'طريقة طلب غير مسموحة'
    ]);
    exit();
}

// التحقق من وجود البيانات المطلوبة
if (empty($_POST['username']) || empty($_POST['password'])) {
    echo json_encode([
        'success' => false,
        'message' => 'يرجى إدخال اسم المستخدم وكلمة المرور'
    ]);
    exit();
}

$username = $hospital->sanitizeInput($_POST['username']);
$password = $_POST['password']; // لا نقوم بتنظيف كلمة المرور لتجنب تغيير الأحرف الخاصة

// محاولة تسجيل الدخول
try {
    if ($hospital->login($username, $password)) {
        echo json_encode([
            'success' => true,
            'message' => 'تم تسجيل الدخول بنجاح',
            'redirect' => '../dashboard.php'
        ]);
    } else {
        // تسجيل محاولة دخول فاشلة
        $ip_address = $_SERVER['REMOTE_ADDR'] ?? 'غير معروف';
        error_log("محاولة دخول فاشلة - المستخدم: {$username} - IP: {$ip_address}");
        
        echo json_encode([
            'success' => false,
            'message' => 'اسم المستخدم أو كلمة المرور غير صحيحة'
        ]);
    }
} catch (Exception $e) {
    error_log("خطأ في تسجيل الدخول: " . $e->getMessage());
    
    echo json_encode([
        'success' => false,
        'message' => 'حدث خطأ في النظام، يرجى المحاولة مرة أخرى'
    ]);
}
?>
<?php
/**
 * تسجيل الخروج - مستشفى الوحدة العلاجي
 * Logout - Hospital Unity
 */

require_once '../includes/functions.php';

// تسجيل الخروج
$hospital->logout();

// إعادة التوجيه إلى الصفحة الرئيسية
header('Location: ../index.php?message=' . urlencode('تم تسجيل الخروج بنجاح') . '&type=success');
exit();
?>
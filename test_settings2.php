<?php
session_start();
require_once 'includes/functions.php';

echo "اختبار تفصيلي للإعدادات:\n";

try {
    $db = (new Database())->getConnection();
    
    // اختبار تحديث إعداد موجود
    echo "1. اختبار تحديث إعداد موجود:\n";
    $result = $hospital->updateSystemSetting('hospital_name', 'مستشفى الوحدة العلاجي المحدث');
    echo "   النتيجة: " . ($result ? 'نجح' : 'فشل') . "\n";
    
    if ($result) {
        $value = $hospital->getSystemSetting('hospital_name');
        echo "   القيمة الجديدة: " . $value . "\n";
    }
    
    // اختبار إضافة إعداد جديد
    echo "\n2. اختبار إضافة إعداد جديد:\n";
    $test_key = 'test_setting_' . time();
    $test_value = 'قيمة اختبار ' . date('Y-m-d H:i:s');
    $result = $hospital->updateSystemSetting($test_key, $test_value);
    echo "   النتيجة: " . ($result ? 'نجح' : 'فشل') . "\n";
    
    if ($result) {
        $value = $hospital->getSystemSetting($test_key);
        echo "   القيمة المسترجعة: " . $value . "\n";
    }
    
    // اختبار مباشر على قاعدة البيانات
    echo "\n3. اختبار مباشر:\n";
    $stmt = $db->prepare("INSERT INTO system_settings (setting_key, setting_value) VALUES (:key, :value) ON DUPLICATE KEY UPDATE setting_value = :value");
    $direct_key = 'direct_test';
    $direct_value = 'قيمة مباشرة';
    $stmt->bindParam(':key', $direct_key);
    $stmt->bindParam(':value', $direct_value);
    $direct_result = $stmt->execute();
    echo "   النتيجة المباشرة: " . ($direct_result ? 'نجح' : 'فشل') . "\n";
    
} catch (Exception $e) {
    echo "خطأ: " . $e->getMessage() . "\n";
    echo "التفاصيل: " . $e->getTraceAsString() . "\n";
}
?>
<?php
session_start();
require_once 'includes/functions.php';

echo "اختبار الإعدادات:\n";

try {
    // اختبار تحديث إعداد
    echo "1. اختبار تحديث إعداد:\n";
    $test_value = 'اختبار ' . date('Y-m-d H:i:s');
    if ($hospital->updateSystemSetting('test_setting', $test_value)) {
        echo "   ✓ تم تحديث الإعداد بنجاح\n";
        
        // التحقق من التحديث
        $retrieved_value = $hospital->getSystemSetting('test_setting');
        if ($retrieved_value === $test_value) {
            echo "   ✓ تم استرجاع الإعداد بنجاح: " . $retrieved_value . "\n";
        } else {
            echo "   ✗ فشل في استرجاع الإعداد\n";
        }
    } else {
        echo "   ✗ فشل في تحديث الإعداد\n";
    }
    
    // عرض جميع الإعدادات
    echo "\n2. جميع الإعدادات الحالية:\n";
    $db = (new Database())->getConnection();
    $stmt = $db->query('SELECT * FROM system_settings ORDER BY setting_key');
    while($row = $stmt->fetch()) {
        echo "   - " . $row['setting_key'] . ": " . $row['setting_value'] . "\n";
    }
    
} catch (Exception $e) {
    echo "خطأ: " . $e->getMessage() . "\n";
}
?>
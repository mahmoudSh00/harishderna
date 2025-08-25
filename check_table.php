<?php
session_start();
require_once 'includes/functions.php';

try {
    $db = (new Database())->getConnection();
    
    echo "بنية جدول system_settings:\n";
    $stmt = $db->query('DESCRIBE system_settings');
    while($row = $stmt->fetch()) {
        echo "   - " . $row['Field'] . " (" . $row['Type'] . ") " . $row['Key'] . "\n";
    }
    
    echo "\nالفهارس:\n";
    $stmt = $db->query('SHOW INDEX FROM system_settings');
    while($row = $stmt->fetch()) {
        echo "   - " . $row['Key_name'] . " على " . $row['Column_name'] . "\n";
    }
    
} catch (Exception $e) {
    echo "خطأ: " . $e->getMessage() . "\n";
}
?>
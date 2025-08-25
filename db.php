<?php
/**
 * ملف الاتصال بقاعدة البيانات - مستشفى الوحدة العلاجي
 * Database Connection File - Hospital Unity
 */

// تضمين إعدادات قاعدة البيانات والوظائف
require_once 'config/database.php';
require_once 'includes/functions.php';

// التحقق من وجود قاعدة البيانات وإنشاؤها إذا لم تكن موجودة
$database = new Database();
$conn = $database->getConnection();

// التحقق من وجود الجداول وإنشاؤها إذا لم تكن موجودة
try {
    // جدول المستخدمين
    $conn->exec("CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        full_name VARCHAR(100) NOT NULL,
        role ENUM('admin', 'doctor', 'nurse', 'receptionist') DEFAULT 'receptionist',
        phone VARCHAR(20),
        is_active TINYINT(1) DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    
    // إضافة عمود الهاتف إذا لم يكن موجوداً
    $conn->exec("ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20) AFTER role");

    // جدول المرضى المقيمين
    $conn->exec("CREATE TABLE IF NOT EXISTS inpatients (
        id INT AUTO_INCREMENT PRIMARY KEY,
        patient_name VARCHAR(100) NOT NULL,
        age INT NOT NULL,
        gender ENUM('male', 'female') NOT NULL,
        phone VARCHAR(20),
        address TEXT,
        admission_date DATE NOT NULL,
        discharge_date DATE NULL,
        bed_number VARCHAR(10),
        room_number VARCHAR(10),
        department VARCHAR(50),
        diagnosis TEXT,
        status ENUM('active', 'discharged', 'transferred') DEFAULT 'active',
        notes TEXT,
        created_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    // جدول المرضى للمعاينة
    $conn->exec("CREATE TABLE IF NOT EXISTS outpatients (
        id INT AUTO_INCREMENT PRIMARY KEY,
        patient_name VARCHAR(100) NOT NULL,
        age INT NOT NULL,
        gender ENUM('male', 'female') NOT NULL,
        phone VARCHAR(20),
        visit_date DATE NOT NULL,
        queue_number INT NOT NULL,
        department VARCHAR(50),
        complaint TEXT,
        status ENUM('waiting', 'in_progress', 'completed', 'cancelled') DEFAULT 'waiting',
        notes TEXT,
        created_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id),
        UNIQUE KEY unique_queue_date (visit_date, queue_number)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    // جدول سجل العمليات
    $conn->exec("CREATE TABLE IF NOT EXISTS activity_log (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        action VARCHAR(100) NOT NULL,
        table_name VARCHAR(50),
        record_id INT,
        old_values JSON,
        new_values JSON,
        ip_address VARCHAR(45),
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    // جدول إعدادات النظام
    $conn->exec("CREATE TABLE IF NOT EXISTS system_settings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        setting_key VARCHAR(100) UNIQUE NOT NULL,
        setting_value TEXT,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    // جدول الأقسام
    $conn->exec("CREATE TABLE IF NOT EXISTS departments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        head_doctor VARCHAR(100),
        phone VARCHAR(20),
        location VARCHAR(200),
        is_active TINYINT(1) DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    // جدول الأسرة
    $conn->exec("CREATE TABLE IF NOT EXISTS beds (
        id INT AUTO_INCREMENT PRIMARY KEY,
        bed_number VARCHAR(10) NOT NULL,
        room_number VARCHAR(10) NOT NULL,
        department_id INT,
        is_occupied TINYINT(1) DEFAULT 0,
        patient_id INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (department_id) REFERENCES departments(id),
        FOREIGN KEY (patient_id) REFERENCES inpatients(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    // جدول الغرف
    $conn->exec("CREATE TABLE IF NOT EXISTS rooms (
        id INT AUTO_INCREMENT PRIMARY KEY,
        room_number VARCHAR(10) NOT NULL,
        department_id INT,
        room_type ENUM('single', 'double', 'ward') DEFAULT 'single',
        total_beds INT DEFAULT 1,
        occupied_beds INT DEFAULT 0,
        is_active TINYINT(1) DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (department_id) REFERENCES departments(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    // إدراج المستخدم الافتراضي إذا لم يكن موجوداً
    $stmt = $conn->prepare("SELECT COUNT(*) FROM users WHERE username = 'amod'");
    $stmt->execute();
    $count = $stmt->fetchColumn();
    
    if ($count == 0) {
        $stmt = $conn->prepare("INSERT INTO users (username, password, full_name, role) VALUES ('amod', :password, 'المدير العام', 'admin')");
        $hashed_password = password_hash('1997200455', PASSWORD_DEFAULT);
        $stmt->bindParam(':password', $hashed_password);
        $stmt->execute();
    }

    // إدراج بعض الإعدادات الافتراضية
    $default_settings = [
        ['max_queue_number', '100', 'الحد الأقصى لرقم الطابور اليومي'],
        ['hospital_name', 'مستشفى الوحدة العلاجي', 'اسم المستشفى'],
        ['hospital_address', 'العراق - بغداد', 'عنوان المستشفى'],
        ['hospital_phone', '+964-XXX-XXXX', 'هاتف المستشفى'],
        ['sms_api_key', '', 'مفتاح API لخدمة الرسائل النصية'],
        ['sms_api_url', '', 'رابط API لخدمة الرسائل النصية']
    ];

    foreach ($default_settings as $setting) {
        $stmt = $conn->prepare("INSERT IGNORE INTO system_settings (setting_key, setting_value, description) VALUES (?, ?, ?)");
        $stmt->execute($setting);
    }

    // إدراج الأقسام الافتراضية
    $default_departments = [
        ['الطوارئ', 'قسم الطوارئ والحالات الحرجة', 'د. أحمد محمد', '07801234567', 'الطابق الأرضي'],
        ['الباطنية', 'قسم الأمراض الباطنية', 'د. فاطمة علي', '07801234568', 'الطابق الأول'],
        ['الجراحة العامة', 'قسم الجراحة العامة والتخصصية', 'د. محمد حسن', '07801234569', 'الطابق الثاني'],
        ['النساء والولادة', 'قسم النساء والولادة', 'د. زينب أحمد', '07801234570', 'الطابق الثالث'],
        ['الأطفال', 'قسم طب الأطفال', 'د. سارة محمود', '07801234571', 'الطابق الأول'],
        ['العظام', 'قسم جراحة العظام والكسور', 'د. علي حسين', '07801234572', 'الطابق الثاني']
    ];

    foreach ($default_departments as $dept) {
        $stmt = $conn->prepare("INSERT IGNORE INTO departments (name, description, head_doctor, phone, location) VALUES (?, ?, ?, ?, ?)");
        $stmt->execute($dept);
    }

} catch (PDOException $e) {
    die("خطأ في إنشاء الجداول: " . $e->getMessage());
}
?>
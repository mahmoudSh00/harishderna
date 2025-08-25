-- قاعدة بيانات مستشفى الوحدة العلاجي
-- Hospital Unity Database

CREATE DATABASE IF NOT EXISTS hospital_unity CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE hospital_unity;

-- جدول المستخدمين
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    role ENUM('admin', 'doctor', 'nurse', 'receptionist') DEFAULT 'receptionist',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- جدول الأقسام
CREATE TABLE departments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- جدول الغرف
CREATE TABLE rooms (
    id INT AUTO_INCREMENT PRIMARY KEY,
    room_number VARCHAR(20) NOT NULL,
    department_id INT,
    bed_count INT DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (department_id) REFERENCES departments(id)
);

-- جدول الأسرة
CREATE TABLE beds (
    id INT AUTO_INCREMENT PRIMARY KEY,
    bed_number VARCHAR(20) NOT NULL,
    room_id INT,
    is_occupied BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (room_id) REFERENCES rooms(id)
);

-- جدول المرضى المقيمين (الإيواء)
CREATE TABLE inpatients (
    id INT AUTO_INCREMENT PRIMARY KEY,
    patient_name VARCHAR(100) NOT NULL,
    age INT NOT NULL,
    gender ENUM('male', 'female') NOT NULL,
    phone VARCHAR(20),
    address TEXT,
    national_id VARCHAR(20),
    disease VARCHAR(255) NOT NULL,
    room_id INT,
    bed_id INT,
    admission_date DATE NOT NULL,
    discharge_date DATE NULL,
    doctor_name VARCHAR(100),
    notes TEXT,
    status ENUM('active', 'discharged', 'transferred') DEFAULT 'active',
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (room_id) REFERENCES rooms(id),
    FOREIGN KEY (bed_id) REFERENCES beds(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- جدول المرضى للمعاينة والكشف
CREATE TABLE outpatients (
    id INT AUTO_INCREMENT PRIMARY KEY,
    patient_name VARCHAR(100) NOT NULL,
    age INT,
    gender ENUM('male', 'female'),
    phone VARCHAR(20),
    queue_number INT NOT NULL,
    disease VARCHAR(255) NOT NULL,
    department_id INT,
    doctor_name VARCHAR(100),
    visit_date DATE NOT NULL,
    visit_time TIME,
    status ENUM('waiting', 'in_progress', 'completed', 'cancelled') DEFAULT 'waiting',
    notes TEXT,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (department_id) REFERENCES departments(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- جدول إعدادات النظام
CREATE TABLE system_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT,
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- جدول سجل العمليات
CREATE TABLE activity_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    action VARCHAR(100) NOT NULL,
    table_name VARCHAR(50),
    record_id INT,
    old_values JSON,
    new_values JSON,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- إدراج البيانات الأولية
INSERT INTO users (username, password, full_name, phone, role) VALUES 
('amod', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'مدير النظام', '1997200455', 'admin');

INSERT INTO departments (name, description) VALUES 
('الطوارئ', 'قسم الطوارئ والحالات العاجلة'),
('الباطنة', 'قسم الأمراض الباطنة'),
('الجراحة', 'قسم الجراحة العامة'),
('النساء والولادة', 'قسم النساء والولادة'),
('الأطفال', 'قسم طب الأطفال'),
('العظام', 'قسم جراحة العظام'),
('القلب', 'قسم أمراض القلب'),
('العيون', 'قسم طب العيون'),
('الأنف والأذن والحنجرة', 'قسم الأنف والأذن والحنجرة'),
('الأشعة', 'قسم الأشعة والتصوير الطبي');

INSERT INTO rooms (room_number, department_id, bed_count) VALUES 
('101', 2, 2), ('102', 2, 2), ('103', 2, 1),
('201', 3, 2), ('202', 3, 2), ('203', 3, 1),
('301', 4, 2), ('302', 4, 2),
('401', 5, 4), ('402', 5, 4);

INSERT INTO beds (bed_number, room_id) VALUES 
('101-A', 1), ('101-B', 1),
('102-A', 2), ('102-B', 2),
('103-A', 3),
('201-A', 4), ('201-B', 4),
('202-A', 5), ('202-B', 5),
('203-A', 6),
('301-A', 7), ('301-B', 7),
('302-A', 8), ('302-B', 8),
('401-A', 9), ('401-B', 9), ('401-C', 9), ('401-D', 9),
('402-A', 10), ('402-B', 10), ('402-C', 10), ('402-D', 10);

INSERT INTO system_settings (setting_key, setting_value, description) VALUES 
('hospital_name', 'مستشفى الوحدة العلاجي', 'اسم المستشفى'),
('hospital_address', 'العراق - بغداد', 'عنوان المستشفى'),
('hospital_phone', '+964-XXX-XXXX', 'هاتف المستشفى'),
('sms_api_key', '', 'مفتاح API لخدمة الرسائل النصية'),
('sms_api_url', '', 'رابط API لخدمة الرسائل النصية'),
('queue_reset_time', '06:00', 'وقت إعادة تعيين أرقام الطابور يومياً'),
('backup_enabled', '1', 'تفعيل النسخ الاحتياطي التلقائي'),
('max_queue_number', '100', 'الحد الأقصى لأرقام الطابور');
<?php
/**
 * الوظائف المساعدة - مستشفى الوحدة العلاجي
 * Helper Functions - Hospital Unity
 */

if (session_status() == PHP_SESSION_NONE) {
    session_start();
}

require_once __DIR__ . '/../config/database.php';

class HospitalFunctions {
    private $db;
    
    public function __construct() {
        $database = new Database();
        $this->db = $database->getConnection();
    }
    
    // التحقق من تسجيل الدخول
    public function isLoggedIn() {
        return isset($_SESSION['user_id']) && !empty($_SESSION['user_id']);
    }
    
    // التحقق من صحة بيانات تسجيل الدخول
    public function login($username, $password) {
        try {
            $query = "SELECT id, username, password, full_name, role, is_active FROM users WHERE username = :username AND is_active = 1";
            $stmt = $this->db->prepare($query);
            $stmt->bindParam(':username', $username);
            $stmt->execute();
            
            if ($stmt->rowCount() == 1) {
                $user = $stmt->fetch();
                
                // التحقق من كلمة المرور (للمستخدم الافتراضي)
                if ($username === 'amod' && $password === '1997200455') {
                    $_SESSION['user_id'] = $user['id'];
                    $_SESSION['username'] = $user['username'];
                    $_SESSION['full_name'] = $user['full_name'];
                    $_SESSION['role'] = $user['role'];
                    $_SESSION['login_time'] = time();
                    
                    $this->logActivity($user['id'], 'تسجيل دخول', 'users', $user['id']);
                    return true;
                }
                // للمستخدمين الآخرين (مع تشفير كلمة المرور)
                elseif (password_verify($password, $user['password'])) {
                    $_SESSION['user_id'] = $user['id'];
                    $_SESSION['username'] = $user['username'];
                    $_SESSION['full_name'] = $user['full_name'];
                    $_SESSION['role'] = $user['role'];
                    $_SESSION['login_time'] = time();
                    
                    $this->logActivity($user['id'], 'تسجيل دخول', 'users', $user['id']);
                    return true;
                }
            }
            return false;
        } catch (Exception $e) {
            return false;
        }
    }
    
    // تسجيل الخروج
    public function logout() {
        if ($this->isLoggedIn()) {
            $this->logActivity($_SESSION['user_id'], 'تسجيل خروج', 'users', $_SESSION['user_id']);
        }
        session_destroy();
        return true;
    }
    
    // تسجيل العمليات
    public function logActivity($user_id, $action, $table_name = null, $record_id = null, $old_values = null, $new_values = null) {
        try {
            $query = "INSERT INTO activity_log (user_id, action, table_name, record_id, old_values, new_values, ip_address, user_agent) 
                     VALUES (:user_id, :action, :table_name, :record_id, :old_values, :new_values, :ip_address, :user_agent)";
            
            $stmt = $this->db->prepare($query);
            $stmt->bindParam(':user_id', $user_id);
            $stmt->bindParam(':action', $action);
            $stmt->bindParam(':table_name', $table_name);
            $stmt->bindParam(':record_id', $record_id);
            $old_values_json = json_encode($old_values);
            $new_values_json = json_encode($new_values);
            $stmt->bindParam(':old_values', $old_values_json);
            $stmt->bindParam(':new_values', $new_values_json);
            $stmt->bindParam(':ip_address', $_SERVER['REMOTE_ADDR']);
            $stmt->bindParam(':user_agent', $_SERVER['HTTP_USER_AGENT']);
            
            return $stmt->execute();
        } catch (Exception $e) {
            return false;
        }
    }
    
    // الحصول على رقم طابور جديد
    public function getNextQueueNumber($date = null) {
        if (!$date) {
            $date = date('Y-m-d');
        }
        
        try {
            $query = "SELECT MAX(queue_number) as max_queue FROM outpatients WHERE visit_date = :date";
            $stmt = $this->db->prepare($query);
            $stmt->bindParam(':date', $date);
            $stmt->execute();
            
            $result = $stmt->fetch();
            $next_number = ($result['max_queue'] ?? 0) + 1;
            
            // التحقق من الحد الأقصى
            $max_queue = $this->getSystemSetting('max_queue_number', 100);
            if ($next_number > $max_queue) {
                return false; // تجاوز الحد الأقصى
            }
            
            return $next_number;
        } catch (Exception $e) {
            return false;
        }
    }
    
    // الحصول على إعدادات النظام
    public function getSystemSetting($key, $default = null) {
        try {
            $query = "SELECT setting_value FROM system_settings WHERE setting_key = :key";
            $stmt = $this->db->prepare($query);
            $stmt->bindParam(':key', $key);
            $stmt->execute();
            
            if ($stmt->rowCount() > 0) {
                $result = $stmt->fetch();
                return $result['setting_value'];
            }
            
            return $default;
        } catch (Exception $e) {
            return $default;
        }
    }
    
    // تحديث إعدادات النظام
    public function updateSystemSetting($key, $value) {
        try {
            $query = "INSERT INTO system_settings (setting_key, setting_value) VALUES (:key, :value) 
                     ON DUPLICATE KEY UPDATE setting_value = :value";
            $stmt = $this->db->prepare($query);
            $stmt->bindParam(':key', $key);
            $stmt->bindParam(':value', $value);
            
            return $stmt->execute();
        } catch (Exception $e) {
            return false;
        }
    }
    
    // إرسال رسالة نصية
    public function sendSMS($phone, $message) {
        $api_key = $this->getSystemSetting('sms_api_key');
        $api_url = $this->getSystemSetting('sms_api_url');
        
        if (empty($api_key) || empty($api_url)) {
            return false;
        }
        
        // يمكن تخصيص هذه الوظيفة حسب مزود خدمة SMS المستخدم
        $data = [
            'api_key' => $api_key,
            'to' => $phone,
            'message' => $message
        ];
        
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $api_url);
        curl_setopt($ch, CURLOPT_POST, 1);
        curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($data));
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        
        $response = curl_exec($ch);
        $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        return $http_code == 200;
    }
    
    // تنظيف البيانات المدخلة
    public function sanitizeInput($data) {
        $data = trim($data);
        $data = stripslashes($data);
        $data = htmlspecialchars($data);
        return $data;
    }
    
    // التحقق من صحة البريد الإلكتروني
    public function validateEmail($email) {
        return filter_var($email, FILTER_VALIDATE_EMAIL);
    }
    
    // التحقق من صحة رقم الهاتف
    public function validatePhone($phone) {
        return preg_match('/^[0-9+\-\s()]+$/', $phone);
    }
    
    // تحويل التاريخ إلى التقويم الهجري (تقريبي)
    public function toHijriDate($gregorian_date) {
        $timestamp = strtotime($gregorian_date);
        $hijri_year = date('Y', $timestamp) - 579;
        $hijri_month = date('n', $timestamp);
        $hijri_day = date('j', $timestamp);
        
        $hijri_months = [
            1 => 'محرم', 2 => 'صفر', 3 => 'ربيع الأول', 4 => 'ربيع الثاني',
            5 => 'جمادى الأولى', 6 => 'جمادى الثانية', 7 => 'رجب', 8 => 'شعبان',
            9 => 'رمضان', 10 => 'شوال', 11 => 'ذو القعدة', 12 => 'ذو الحجة'
        ];
        
        return $hijri_day . ' ' . $hijri_months[$hijri_month] . ' ' . $hijri_year . ' هـ';
    }
    
    // تحويل الأرقام إلى العربية
    public function toArabicNumbers($string) {
        $arabic_numbers = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
        $english_numbers = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
        
        return str_replace($english_numbers, $arabic_numbers, $string);
    }
    
    // تحويل الأرقام إلى الإنجليزية
    public function toEnglishNumbers($string) {
        $arabic_numbers = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
        $english_numbers = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
        
        return str_replace($arabic_numbers, $english_numbers, $string);
    }
    
    // إنشاء كلمة مرور عشوائية
    public function generateRandomPassword($length = 8) {
        $characters = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
        $password = '';
        
        for ($i = 0; $i < $length; $i++) {
            $password .= $characters[rand(0, strlen($characters) - 1)];
        }
        
        return $password;
    }
    
    // تشفير كلمة المرور
    public function hashPassword($password) {
        return password_hash($password, PASSWORD_DEFAULT);
    }
    
    // التحقق من انتهاء صلاحية الجلسة
    public function checkSessionTimeout() {
        if ($this->isLoggedIn()) {
            $login_time = $_SESSION['login_time'] ?? 0;
            if (time() - $login_time > SESSION_TIMEOUT) {
                $this->logout();
                return false;
            }
            $_SESSION['login_time'] = time(); // تحديث وقت آخر نشاط
        }
        return true;
    }
    
    // الحصول على إحصائيات المرضى
    public function getPatientStatistics($date_from = null, $date_to = null) {
        if (!$date_from) $date_from = date('Y-m-01'); // بداية الشهر الحالي
        if (!$date_to) $date_to = date('Y-m-d'); // اليوم الحالي
        
        $stats = [];
        
        try {
            // إحصائيات المرضى المقيمين
            $query = "SELECT 
                        COUNT(*) as total_inpatients,
                        SUM(CASE WHEN gender = 'male' THEN 1 ELSE 0 END) as male_inpatients,
                        SUM(CASE WHEN gender = 'female' THEN 1 ELSE 0 END) as female_inpatients,
                        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_inpatients
                      FROM inpatients 
                      WHERE admission_date BETWEEN :date_from AND :date_to";
            
            $stmt = $this->db->prepare($query);
            $stmt->bindParam(':date_from', $date_from);
            $stmt->bindParam(':date_to', $date_to);
            $stmt->execute();
            $stats['inpatients'] = $stmt->fetch();
            
            // إحصائيات المرضى للمعاينة
            $query = "SELECT 
                        COUNT(*) as total_outpatients,
                        SUM(CASE WHEN gender = 'male' THEN 1 ELSE 0 END) as male_outpatients,
                        SUM(CASE WHEN gender = 'female' THEN 1 ELSE 0 END) as female_outpatients,
                        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_visits
                      FROM outpatients 
                      WHERE visit_date BETWEEN :date_from AND :date_to";
            
            $stmt = $this->db->prepare($query);
            $stmt->bindParam(':date_from', $date_from);
            $stmt->bindParam(':date_to', $date_to);
            $stmt->execute();
            $stats['outpatients'] = $stmt->fetch();
            
            return $stats;
        } catch (Exception $e) {
            return false;
        }
    }
    
    // الحصول على إعداد النظام
    public function getSystemSetting($key, $default = null) {
        try {
            $query = "SELECT setting_value FROM system_settings WHERE setting_key = :key";
            $stmt = $this->db->prepare($query);
            $stmt->bindParam(':key', $key);
            $stmt->execute();
            
            if ($stmt->rowCount() > 0) {
                $result = $stmt->fetch();
                return $result['setting_value'];
            }
            
            return $default;
        } catch (Exception $e) {
            return $default;
        }
    }
    
    // تحديث إعداد النظام
    public function updateSystemSetting($key, $value) {
        try {
            // التحقق من وجود الإعداد
            $query = "SELECT id FROM system_settings WHERE setting_key = :key";
            $stmt = $this->db->prepare($query);
            $stmt->bindParam(':key', $key);
            $stmt->execute();
            
            if ($stmt->rowCount() > 0) {
                // تحديث الإعداد الموجود
                $query = "UPDATE system_settings SET setting_value = :value, updated_at = NOW() WHERE setting_key = :key";
            } else {
                // إضافة إعداد جديد
                $query = "INSERT INTO system_settings (setting_key, setting_value, created_at, updated_at) VALUES (:key, :value, NOW(), NOW())";
            }
            
            $stmt = $this->db->prepare($query);
            $stmt->bindParam(':key', $key);
            $stmt->bindParam(':value', $value);
            
            return $stmt->execute();
        } catch (Exception $e) {
            return false;
        }
    }
    
    // إرسال رسالة نصية
    public function sendSMS($phone, $message) {
        try {
            // الحصول على إعدادات SMS
            $sms_enabled = $this->getSystemSetting('sms_enabled', '0');
            $api_key = $this->getSystemSetting('sms_api_key', '');
            $api_url = $this->getSystemSetting('sms_api_url', '');
            $sender_name = $this->getSystemSetting('sms_sender_name', 'Hospital');
            
            if ($sms_enabled !== '1' || empty($api_key) || empty($api_url)) {
                return false;
            }
            
            // تنظيف رقم الهاتف
            $phone = preg_replace('/[^0-9+]/', '', $phone);
            
            // إعداد البيانات للإرسال
            $data = [
                'api_key' => $api_key,
                'to' => $phone,
                'message' => $message,
                'sender' => $sender_name
            ];
            
            // إرسال الطلب
            $ch = curl_init();
            curl_setopt($ch, CURLOPT_URL, $api_url);
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($data));
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_TIMEOUT, 30);
            
            $response = curl_exec($ch);
            $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);
            
            // تسجيل محاولة الإرسال
            $this->logActivity($_SESSION['user_id'] ?? 0, 'إرسال رسالة نصية', 'sms', null, null, [
                'phone' => $phone,
                'message' => $message,
                'response' => $response,
                'http_code' => $http_code
            ]);
            
            return $http_code === 200;
            
        } catch (Exception $e) {
            return false;
        }
    }
    
    // إرسال كلمة المرور عبر SMS
    public function sendPasswordSMS($phone, $username, $password) {
        $hospital_name = $this->getSystemSetting('hospital_name', 'مستشفى الوحدة العلاجي');
        $message = "مرحباً بك في {$hospital_name}\n";
        $message .= "اسم المستخدم: {$username}\n";
        $message .= "كلمة المرور: {$password}\n";
        $message .= "يرجى تغيير كلمة المرور بعد أول تسجيل دخول";
        
        return $this->sendSMS($phone, $message);
    }
}

// إنشاء مثيل من الكلاس
$hospital = new HospitalFunctions();

// التحقق من انتهاء صلاحية الجلسة
$hospital->checkSessionTimeout();
?>
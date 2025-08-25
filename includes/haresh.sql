<?php
/**
 * إعدادات قاعدة البيانات - مستشفى الوحدة العلاجي
 * Database Configuration - Hospital Unity
 */

class Database {
    private $host = 'localhost';
    private $db_name = 'hospital_unity';
    private $username = 'root';
    private $password = '';
    private $charset = 'utf8mb4';
    private $conn;
    
    // للاستضافة المحلية
    private $local_config = [
        'host' => 'localhost',
        'db_name' => 'haresh',
        'username' => 'root',
        'password' => ''
    ];
    
    // للاستضافة الخارجية
    private $remote_config = [
        'host' => 'your_remote_host',
        'db_name' => 'your_remote_db',
        'username' => 'your_remote_user',
        'password' => 'your_remote_password'
    ];
    
    public function __construct() {
        // تحديد نوع الاستضافة تلقائياً
        if ($this->isLocalhost()) {
            $config = $this->local_config;
        } else {
            $config = $this->remote_config;
        }
        
        $this->host = $config['host'];
        $this->db_name = $config['db_name'];
        $this->username = $config['username'];
        $this->password = $config['password'];
    }
    
    private function isLocalhost() {
        $localhost_ips = ['127.0.0.1', '::1', 'localhost'];
        return in_array($_SERVER['SERVER_NAME'] ?? $_SERVER['HTTP_HOST'] ?? '', $localhost_ips) ||
               in_array($_SERVER['REMOTE_ADDR'] ?? '', $localhost_ips);
    }
    
    public function getConnection() {
        $this->conn = null;
        
        try {
            $dsn = "mysql:host=" . $this->host . ";dbname=" . $this->db_name . ";charset=" . $this->charset;
            $options = [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
                PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4"
            ];
            
            $this->conn = new PDO($dsn, $this->username, $this->password, $options);
            
        } catch(PDOException $exception) {
            // في حالة فشل الاتصال، محاولة إنشاء قاعدة البيانات
            try {
                $dsn_without_db = "mysql:host=" . $this->host . ";charset=" . $this->charset;
                $temp_conn = new PDO($dsn_without_db, $this->username, $this->password, $options);
                $temp_conn->exec("CREATE DATABASE IF NOT EXISTS `{$this->db_name}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
                
                // إعادة المحاولة
                $dsn = "mysql:host=" . $this->host . ";dbname=" . $this->db_name . ";charset=" . $this->charset;
                $this->conn = new PDO($dsn, $this->username, $this->password, $options);
                
            } catch(PDOException $e) {
                die("خطأ في الاتصال بقاعدة البيانات: " . $e->getMessage());
            }
        }
        
        return $this->conn;
    }
    
    public function closeConnection() {
        $this->conn = null;
    }
    
    // إنشاء نسخة احتياطية من قاعدة البيانات
    public function createBackup() {
        $backup_file = 'backups/backup_' . date('Y-m-d_H-i-s') . '.sql';
        
        if (!file_exists('backups')) {
            mkdir('backups', 0777, true);
        }
        
        $command = "mysqldump --user={$this->username} --password={$this->password} --host={$this->host} {$this->db_name} > {$backup_file}";
        
        if (function_exists('exec')) {
            exec($command, $output, $return_var);
            return $return_var === 0 ? $backup_file : false;
        }
        
        return false;
    }
    
    // استعادة قاعدة البيانات من نسخة احتياطية
    public function restoreBackup($backup_file) {
        if (!file_exists($backup_file)) {
            return false;
        }
        
        $command = "mysql --user={$this->username} --password={$this->password} --host={$this->host} {$this->db_name} < {$backup_file}";
        
        if (function_exists('exec')) {
            exec($command, $output, $return_var);
            return $return_var === 0;
        }
        
        return false;
    }
}

// إعدادات عامة للتطبيق
define('APP_NAME', 'مستشفى الوحدة العلاجي');
define('APP_VERSION', '1.0.0');
define('APP_URL', 'http://localhost/hospital_unity/');
define('UPLOAD_PATH', 'uploads/');
define('BACKUP_PATH', 'backups/');

// إعدادات الأمان
define('SESSION_TIMEOUT', 3600); // ساعة واحدة
define('MAX_LOGIN_ATTEMPTS', 5);
define('LOGIN_LOCKOUT_TIME', 900); // 15 دقيقة

// إعدادات الطباعة
define('PRINT_LOGO_PATH', 'assets/images/logo.png');
define('PRINT_HEADER', 'مستشفى الوحدة العلاجي');
define('PRINT_ADDRESS', 'العراق - بغداد');
define('PRINT_PHONE', '+964-XXX-XXXX');

// بدء الجلسة
if (session_status() == PHP_SESSION_NONE) {
    session_start();
}

// إعدادات المنطقة الزمنية
date_default_timezone_set('Asia/Baghdad');

// إعدادات اللغة
setlocale(LC_ALL, 'ar_IQ.UTF-8');
?>
<?php
/**
 * إعدادات النظام - مستشفى الوحدة العلاجي
 * System Settings - Hospital Unity
 */

require_once '../includes/functions.php';

// التحقق من تسجيل الدخول
if (!$hospital->isLoggedIn()) {
    header('Location: ../index.php');
    exit();
}

// التحقق من صلاحيات الإدارة
if ($_SESSION['role'] !== 'admin') {
    header('Location: ../dashboard.php');
    exit();
}

$db = (new Database())->getConnection();

// معالجة العمليات
$message = '';
$message_type = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (isset($_POST['action'])) {
        switch ($_POST['action']) {
            case 'update_general':
                $settings = [
                    'hospital_name' => $hospital->sanitizeInput($_POST['hospital_name']),
                    'hospital_address' => $hospital->sanitizeInput($_POST['hospital_address']),
                    'hospital_phone' => $hospital->sanitizeInput($_POST['hospital_phone']),
                    'hospital_email' => $hospital->sanitizeInput($_POST['hospital_email']),
                    'max_queue_number' => (int)$_POST['max_queue_number']
                ];
                
                try {
                    foreach ($settings as $key => $value) {
                        $hospital->updateSystemSetting($key, $value);
                    }
                    $hospital->logActivity($_SESSION['user_id'], 'تحديث الإعدادات العامة', 'system_settings', null);
                    $message = "تم تحديث الإعدادات العامة بنجاح";
                    $message_type = 'success';
                } catch (Exception $e) {
                    $message = "خطأ في تحديث الإعدادات: " . $e->getMessage();
                    $message_type = 'danger';
                }
                break;
                
            case 'update_sms':
                $sms_settings = [
                    'sms_api_key' => $hospital->sanitizeInput($_POST['sms_api_key']),
                    'sms_api_url' => $hospital->sanitizeInput($_POST['sms_api_url']),
                    'sms_enabled' => isset($_POST['sms_enabled']) ? '1' : '0'
                ];
                
                try {
                    foreach ($sms_settings as $key => $value) {
                        $hospital->updateSystemSetting($key, $value);
                    }
                    $hospital->logActivity($_SESSION['user_id'], 'تحديث إعدادات SMS', 'system_settings', null);
                    $message = "تم تحديث إعدادات الرسائل النصية بنجاح";
                    $message_type = 'success';
                } catch (Exception $e) {
                    $message = "خطأ في تحديث إعدادات SMS: " . $e->getMessage();
                    $message_type = 'danger';
                }
                break;
                
            case 'test_sms':
                $test_phone = $hospital->sanitizeInput($_POST['test_phone']);
                $test_message = "رسالة اختبار من " . APP_NAME . " - " . date('Y-m-d H:i:s');
                
                if ($hospital->sendSMS($test_phone, $test_message)) {
                    $message = "تم إرسال رسالة الاختبار بنجاح";
                    $message_type = 'success';
                } else {
                    $message = "فشل في إرسال رسالة الاختبار. تحقق من إعدادات SMS";
                    $message_type = 'danger';
                }
                break;
                
            case 'backup_database':
                $backup_file = $hospital->createBackup();
                if ($backup_file) {
                    $hospital->logActivity($_SESSION['user_id'], 'إنشاء نسخة احتياطية', 'system', null);
                    $message = "تم إنشاء النسخة الاحتياطية بنجاح: " . $backup_file;
                    $message_type = 'success';
                } else {
                    $message = "فشل في إنشاء النسخة الاحتياطية";
                    $message_type = 'danger';
                }
                break;
                
            case 'add_setting':
                $key = $hospital->sanitizeInput($_POST['setting_key']);
                $value = $hospital->sanitizeInput($_POST['setting_value']);
                $description = $hospital->sanitizeInput($_POST['description']);
                
                try {
                    $query = "INSERT INTO system_settings (setting_key, setting_value, description) VALUES (:key, :value, :description)";
                    $stmt = $db->prepare($query);
                    $stmt->bindParam(':key', $key);
                    $stmt->bindParam(':value', $value);
                    $stmt->bindParam(':description', $description);
                    
                    if ($stmt->execute()) {
                        $hospital->logActivity($_SESSION['user_id'], 'إضافة إعداد جديد', 'system_settings', $db->lastInsertId());
                        $message = "تم إضافة الإعداد الجديد بنجاح";
                        $message_type = 'success';
                    }
                } catch (Exception $e) {
                    $message = "خطأ في إضافة الإعداد: " . $e->getMessage();
                    $message_type = 'danger';
                }
                break;
                
            case 'delete_setting':
                $id = (int)$_POST['id'];
                
                try {
                    $query = "DELETE FROM system_settings WHERE id = :id";
                    $stmt = $db->prepare($query);
                    $stmt->bindParam(':id', $id);
                    
                    if ($stmt->execute()) {
                        $hospital->logActivity($_SESSION['user_id'], 'حذف إعداد', 'system_settings', $id);
                        $message = "تم حذف الإعداد بنجاح";
                        $message_type = 'success';
                    }
                } catch (Exception $e) {
                    $message = "خطأ في حذف الإعداد: " . $e->getMessage();
                    $message_type = 'danger';
                }
                break;
        }
    }
}

// الحصول على الإعدادات الحالية
$settings = [];
$query = "SELECT * FROM system_settings ORDER BY setting_key";
$stmt = $db->prepare($query);
$stmt->execute();
$all_settings = $stmt->fetchAll();

foreach ($all_settings as $setting) {
    $settings[$setting['setting_key']] = $setting['setting_value'];
}

// إحصائيات النظام
$stats = [];
try {
    // عدد المستخدمين
    $stmt = $db->query("SELECT COUNT(*) as count FROM users");
    $stats['users'] = $stmt->fetch()['count'];
    
    // عدد الأقسام
    $stmt = $db->query("SELECT COUNT(*) as count FROM departments");
    $stats['departments'] = $stmt->fetch()['count'];
    
    // عدد المرضى المقيمين
    $stmt = $db->query("SELECT COUNT(*) as count FROM inpatients");
    $stats['inpatients'] = $stmt->fetch()['count'];
    
    // عدد المراجعين
    $stmt = $db->query("SELECT COUNT(*) as count FROM outpatients");
    $stats['outpatients'] = $stmt->fetch()['count'];
    
    // حجم قاعدة البيانات
    $stmt = $db->query("SELECT ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS size_mb FROM information_schema.tables WHERE table_schema = DATABASE()");
    $stats['db_size'] = $stmt->fetch()['size_mb'] . ' MB';
    
} catch (Exception $e) {
    $stats = ['users' => 0, 'departments' => 0, 'inpatients' => 0, 'outpatients' => 0, 'db_size' => '0 MB'];
}
?>

<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>إعدادات النظام - <?php echo APP_NAME; ?></title>
    
    <!-- Bootstrap CSS -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.0/font/bootstrap-icons.css" rel="stylesheet">
    
    <!-- Custom CSS -->
    <link href="../assets/css/style.css" rel="stylesheet">
    
    <!-- Google Fonts -->
    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700&display=swap" rel="stylesheet">
</head>
<body class="dashboard-page">
    <div class="container-fluid">
        <div class="row">
            <!-- الشريط الجانبي -->
            <nav class="col-md-3 col-lg-2 d-md-block sidebar collapse">
                <div class="position-sticky pt-3">
                    <!-- شعار المستشفى -->
                    <div class="text-center mb-4">
                        <i class="bi bi-hospital display-4 text-white"></i>
                        <h5 class="text-white mt-2">مستشفى الوحدة</h5>
                    </div>
                    
                    <!-- القائمة الرئيسية -->
                    <ul class="nav flex-column">
                        <li class="nav-item">
                            <a class="nav-link" href="../dashboard.php">
                                <i class="bi bi-speedometer2"></i>
                                لوحة التحكم
                            </a>
                        </li>
                        <li class="nav-item">
                            <a class="nav-link" href="../inpatients/">
                                <i class="bi bi-person-plus"></i>
                                قسم الإيواء
                            </a>
                        </li>
                        <li class="nav-item">
                            <a class="nav-link" href="../outpatients/">
                                <i class="bi bi-clipboard-check"></i>
                                المعاينة والكشف
                            </a>
                        </li>
                        <li class="nav-item">
                            <a class="nav-link" href="../departments/">
                                <i class="bi bi-building"></i>
                                الأقسام
                            </a>
                        </li>
                        <li class="nav-item">
                            <a class="nav-link" href="../reports/">
                                <i class="bi bi-graph-up"></i>
                                التقارير والإحصائيات
                            </a>
                        </li>
                        <li class="nav-item">
                            <a class="nav-link" href="../users/">
                                <i class="bi bi-people"></i>
                                المستخدمين
                            </a>
                        </li>
                        <li class="nav-item">
                            <a class="nav-link active" href="index.php">
                                <i class="bi bi-gear"></i>
                                الإعدادات
                            </a>
                        </li>
                    </ul>
                    
                    <hr class="my-3" style="border-color: rgba(255,255,255,0.3);">
                    
                    <!-- قائمة إضافية -->
                    <ul class="nav flex-column">
                        <li class="nav-item">
                            <a class="nav-link" href="../backup.php">
                                <i class="bi bi-cloud-download"></i>
                                النسخ الاحتياطي
                            </a>
                        </li>
                        <li class="nav-item">
                            <a class="nav-link" href="../auth/logout.php">
                                <i class="bi bi-box-arrow-right"></i>
                                تسجيل الخروج
                            </a>
                        </li>
                    </ul>
                </div>
            </nav>
            
            <!-- المحتوى الرئيسي -->
            <main class="col-md-9 ms-sm-auto col-lg-10 px-md-4 main-content">
                <!-- الهيدر -->
                <div class="main-header d-flex justify-content-between flex-wrap flex-md-nowrap align-items-center pt-3 pb-2 mb-3">
                    <div>
                        <h1 class="h2">إعدادات النظام</h1>
                        <p class="text-muted">إدارة إعدادات المستشفى والنظام</p>
                    </div>
                    
                    <div class="user-info">
                        <div class="user-avatar">
                            <?php echo substr($_SESSION['full_name'], 0, 1); ?>
                        </div>
                        <div>
                            <div class="fw-bold"><?php echo $_SESSION['full_name']; ?></div>
                            <small class="text-muted"><?php echo $_SESSION['role']; ?></small>
                        </div>
                    </div>
                </div>
                
                <!-- رسائل التنبيه -->
                <?php if (!empty($message)): ?>
                <div class="alert alert-<?php echo $message_type; ?> alert-dismissible fade show" role="alert">
                    <?php echo $message; ?>
                    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
                </div>
                <?php endif; ?>
                
                <!-- إحصائيات النظام -->
                <div class="row mb-4">
                    <div class="col-xl-2 col-md-4 col-6 mb-3">
                        <div class="stats-card text-center">
                            <div class="stats-icon primary mx-auto">
                                <i class="bi bi-people"></i>
                            </div>
                            <div class="stats-number"><?php echo $stats['users']; ?></div>
                            <div class="stats-label">المستخدمين</div>
                        </div>
                    </div>
                    <div class="col-xl-2 col-md-4 col-6 mb-3">
                        <div class="stats-card text-center">
                            <div class="stats-icon success mx-auto">
                                <i class="bi bi-building"></i>
                            </div>
                            <div class="stats-number"><?php echo $stats['departments']; ?></div>
                            <div class="stats-label">الأقسام</div>
                        </div>
                    </div>
                    <div class="col-xl-2 col-md-4 col-6 mb-3">
                        <div class="stats-card text-center">
                            <div class="stats-icon warning mx-auto">
                                <i class="bi bi-person-plus"></i>
                            </div>
                            <div class="stats-number"><?php echo $stats['inpatients']; ?></div>
                            <div class="stats-label">المرضى المقيمين</div>
                        </div>
                    </div>
                    <div class="col-xl-2 col-md-4 col-6 mb-3">
                        <div class="stats-card text-center">
                            <div class="stats-icon info mx-auto">
                                <i class="bi bi-clipboard-check"></i>
                            </div>
                            <div class="stats-number"><?php echo $stats['outpatients']; ?></div>
                            <div class="stats-label">المراجعين</div>
                        </div>
                    </div>
                    <div class="col-xl-2 col-md-4 col-6 mb-3">
                        <div class="stats-card text-center">
                            <div class="stats-icon primary mx-auto">
                                <i class="bi bi-database"></i>
                            </div>
                            <div class="stats-number"><?php echo $stats['db_size']; ?></div>
                            <div class="stats-label">حجم قاعدة البيانات</div>
                        </div>
                    </div>
                    <div class="col-xl-2 col-md-4 col-6 mb-3">
                        <div class="stats-card text-center">
                            <form method="POST" style="display: inline;">
                                <input type="hidden" name="action" value="backup_database">
                                <button type="submit" class="btn btn-link p-0 text-decoration-none">
                                    <div class="stats-icon success mx-auto">
                                        <i class="bi bi-cloud-download"></i>
                                    </div>
                                    <div class="stats-label mt-2">نسخة احتياطية</div>
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
                
                <!-- تبويبات الإعدادات -->
                <ul class="nav nav-tabs mb-4" id="settingsTabs" role="tablist">
                    <li class="nav-item" role="presentation">
                        <button class="nav-link active" id="general-tab" data-bs-toggle="tab" data-bs-target="#general" type="button" role="tab">
                            <i class="bi bi-gear me-2"></i>الإعدادات العامة
                        </button>
                    </li>
                    <li class="nav-item" role="presentation">
                        <button class="nav-link" id="sms-tab" data-bs-toggle="tab" data-bs-target="#sms" type="button" role="tab">
                            <i class="bi bi-chat-text me-2"></i>إعدادات SMS
                        </button>
                    </li>
                    <li class="nav-item" role="presentation">
                        <button class="nav-link" id="advanced-tab" data-bs-toggle="tab" data-bs-target="#advanced" type="button" role="tab">
                            <i class="bi bi-sliders me-2"></i>إعدادات متقدمة
                        </button>
                    </li>
                </ul>
                
                <div class="tab-content" id="settingsTabContent">
                    <!-- الإعدادات العامة -->
                    <div class="tab-pane fade show active" id="general" role="tabpanel">
                        <div class="form-container">
                            <h5 class="mb-3">
                                <i class="bi bi-gear me-2"></i>
                                الإعدادات العامة للمستشفى
                            </h5>
                            
                            <form method="POST">
                                <input type="hidden" name="action" value="update_general">
                                
                                <div class="row">
                                    <div class="col-md-6 mb-3">
                                        <label for="hospital_name" class="form-label">اسم المستشفى</label>
                                        <input type="text" class="form-control" id="hospital_name" name="hospital_name" 
                                               value="<?php echo htmlspecialchars($settings['hospital_name'] ?? ''); ?>" required>
                                    </div>
                                    <div class="col-md-6 mb-3">
                                        <label for="hospital_phone" class="form-label">هاتف المستشفى</label>
                                        <input type="tel" class="form-control" id="hospital_phone" name="hospital_phone" 
                                               value="<?php echo htmlspecialchars($settings['hospital_phone'] ?? ''); ?>">
                                    </div>
                                </div>
                                
                                <div class="row">
                                    <div class="col-md-6 mb-3">
                                        <label for="hospital_address" class="form-label">عنوان المستشفى</label>
                                        <textarea class="form-control" id="hospital_address" name="hospital_address" rows="3"><?php echo htmlspecialchars($settings['hospital_address'] ?? ''); ?></textarea>
                                    </div>
                                    <div class="col-md-6 mb-3">
                                        <label for="hospital_email" class="form-label">البريد الإلكتروني</label>
                                        <input type="email" class="form-control" id="hospital_email" name="hospital_email" 
                                               value="<?php echo htmlspecialchars($settings['hospital_email'] ?? ''); ?>">
                                        
                                        <label for="max_queue_number" class="form-label mt-3">الحد الأقصى لرقم الطابور اليومي</label>
                                        <input type="number" class="form-control" id="max_queue_number" name="max_queue_number" 
                                               value="<?php echo htmlspecialchars($settings['max_queue_number'] ?? '100'); ?>" min="1" max="999">
                                    </div>
                                </div>
                                
                                <div class="text-end">
                                    <button type="submit" class="btn btn-primary">
                                        <i class="bi bi-check-lg me-2"></i>
                                        حفظ الإعدادات العامة
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                    
                    <!-- إعدادات SMS -->
                    <div class="tab-pane fade" id="sms" role="tabpanel">
                        <div class="form-container">
                            <h5 class="mb-3">
                                <i class="bi bi-chat-text me-2"></i>
                                إعدادات الرسائل النصية
                            </h5>
                            
                            <form method="POST">
                                <input type="hidden" name="action" value="update_sms">
                                
                                <div class="mb-3">
                                    <div class="form-check">
                                        <input class="form-check-input" type="checkbox" id="sms_enabled" name="sms_enabled" 
                                               <?php echo ($settings['sms_enabled'] ?? '0') == '1' ? 'checked' : ''; ?>>
                                        <label class="form-check-label" for="sms_enabled">
                                            تفعيل خدمة الرسائل النصية
                                        </label>
                                    </div>
                                </div>
                                
                                <div class="row">
                                    <div class="col-md-6 mb-3">
                                        <label for="sms_api_key" class="form-label">مفتاح API</label>
                                        <input type="text" class="form-control" id="sms_api_key" name="sms_api_key" 
                                               value="<?php echo htmlspecialchars($settings['sms_api_key'] ?? ''); ?>">
                                    </div>
                                    <div class="col-md-6 mb-3">
                                        <label for="sms_api_url" class="form-label">رابط API</label>
                                        <input type="url" class="form-control" id="sms_api_url" name="sms_api_url" 
                                               value="<?php echo htmlspecialchars($settings['sms_api_url'] ?? ''); ?>">
                                    </div>
                                </div>
                                
                                <div class="text-end mb-3">
                                    <button type="submit" class="btn btn-primary">
                                        <i class="bi bi-check-lg me-2"></i>
                                        حفظ إعدادات SMS
                                    </button>
                                </div>
                            </form>
                            
                            <!-- اختبار SMS -->
                            <hr>
                            <h6>اختبار الرسائل النصية</h6>
                            <form method="POST" class="row g-3">
                                <input type="hidden" name="action" value="test_sms">
                                <div class="col-md-8">
                                    <input type="tel" class="form-control" name="test_phone" placeholder="رقم الهاتف للاختبار" required>
                                </div>
                                <div class="col-md-4">
                                    <button type="submit" class="btn btn-info w-100">
                                        <i class="bi bi-send me-2"></i>
                                        إرسال رسالة اختبار
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                    
                    <!-- الإعدادات المتقدمة -->
                    <div class="tab-pane fade" id="advanced" role="tabpanel">
                        <div class="form-container">
                            <h5 class="mb-3">
                                <i class="bi bi-sliders me-2"></i>
                                الإعدادات المتقدمة
                            </h5>
                            
                            <!-- إضافة إعداد جديد -->
                            <div class="mb-4">
                                <h6>إضافة إعداد جديد</h6>
                                <form method="POST" class="row g-3">
                                    <input type="hidden" name="action" value="add_setting">
                                    <div class="col-md-3">
                                        <input type="text" class="form-control" name="setting_key" placeholder="مفتاح الإعداد" required>
                                    </div>
                                    <div class="col-md-3">
                                        <input type="text" class="form-control" name="setting_value" placeholder="قيمة الإعداد" required>
                                    </div>
                                    <div class="col-md-4">
                                        <input type="text" class="form-control" name="description" placeholder="وصف الإعداد">
                                    </div>
                                    <div class="col-md-2">
                                        <button type="submit" class="btn btn-success w-100">
                                            <i class="bi bi-plus-lg"></i>
                                        </button>
                                    </div>
                                </form>
                            </div>
                            
                            <!-- جدول الإعدادات -->
                            <div class="table-responsive">
                                <table class="table">
                                    <thead>
                                        <tr>
                                            <th>مفتاح الإعداد</th>
                                            <th>القيمة</th>
                                            <th>الوصف</th>
                                            <th>تاريخ التحديث</th>
                                            <th>العمليات</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <?php foreach ($all_settings as $setting): ?>
                                        <tr>
                                            <td><code><?php echo htmlspecialchars($setting['setting_key']); ?></code></td>
                                            <td><?php echo htmlspecialchars($setting['setting_value']); ?></td>
                                            <td><?php echo htmlspecialchars($setting['description']); ?></td>
                                            <td><?php echo date('Y/m/d H:i', strtotime($setting['updated_at'])); ?></td>
                                            <td>
                                                <form method="POST" style="display: inline;" onsubmit="return confirm('هل أنت متأكد من حذف هذا الإعداد؟')">
                                                    <input type="hidden" name="action" value="delete_setting">
                                                    <input type="hidden" name="id" value="<?php echo $setting['id']; ?>">
                                                    <button type="submit" class="btn btn-sm btn-danger">
                                                        <i class="bi bi-trash"></i>
                                                    </button>
                                                </form>
                                            </td>
                                        </tr>
                                        <?php endforeach; ?>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    </div>
    
    <!-- Bootstrap JS -->
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>
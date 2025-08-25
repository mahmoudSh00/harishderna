<?php
/**
 * النسخ الاحتياطي - مستشفى الوحدة العلاجي
 * Backup System - Hospital Unity
 */

require_once 'includes/functions.php';

// التحقق من تسجيل الدخول
if (!$hospital->isLoggedIn()) {
    header('Location: index.php');
    exit();
}

// التحقق من صلاحيات المدير
if ($_SESSION['user_role'] !== 'admin') {
    header('Location: dashboard.php?message=' . urlencode('غير مصرح لك بالوصول لهذه الصفحة') . '&type=danger');
    exit();
}

$message = '';
$message_type = '';

// معالجة إنشاء نسخة احتياطية
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['create_backup'])) {
    try {
        $backup_result = $hospital->createBackup();
        if ($backup_result['success']) {
            $message = 'تم إنشاء النسخة الاحتياطية بنجاح: ' . $backup_result['filename'];
            $message_type = 'success';
        } else {
            $message = 'فشل في إنشاء النسخة الاحتياطية: ' . $backup_result['message'];
            $message_type = 'danger';
        }
    } catch (Exception $e) {
        $message = 'حدث خطأ: ' . $e->getMessage();
        $message_type = 'danger';
    }
}

// معالجة استعادة نسخة احتياطية
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['restore_backup'])) {
    try {
        $filename = $_POST['backup_file'];
        $restore_result = $hospital->restoreBackup($filename);
        if ($restore_result['success']) {
            $message = 'تم استعادة النسخة الاحتياطية بنجاح';
            $message_type = 'success';
        } else {
            $message = 'فشل في استعادة النسخة الاحتياطية: ' . $restore_result['message'];
            $message_type = 'danger';
        }
    } catch (Exception $e) {
        $message = 'حدث خطأ: ' . $e->getMessage();
        $message_type = 'danger';
    }
}

// الحصول على قائمة النسخ الاحتياطية
$backups = $hospital->getBackupsList();
?>
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>النسخ الاحتياطي - <?php echo APP_NAME; ?></title>
    
    <!-- Bootstrap CSS -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.0/font/bootstrap-icons.css" rel="stylesheet">
    
    <!-- Custom CSS -->
    <link href="assets/css/style.css" rel="stylesheet">
    
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
                            <a class="nav-link" href="dashboard.php">
                                <i class="bi bi-speedometer2"></i>
                                لوحة التحكم
                            </a>
                        </li>
                        <li class="nav-item">
                            <a class="nav-link" href="inpatients/">
                                <i class="bi bi-person-plus"></i>
                                قسم الإيواء
                            </a>
                        </li>
                        <li class="nav-item">
                            <a class="nav-link" href="outpatients/">
                                <i class="bi bi-clipboard-check"></i>
                                المعاينة والكشف
                            </a>
                        </li>
                        <li class="nav-item">
                            <a class="nav-link" href="departments/">
                                <i class="bi bi-building"></i>
                                الأقسام
                            </a>
                        </li>
                        <li class="nav-item">
                            <a class="nav-link" href="reports/">
                                <i class="bi bi-graph-up"></i>
                                التقارير والإحصائيات
                            </a>
                        </li>
                        <li class="nav-item">
                            <a class="nav-link" href="users/">
                                <i class="bi bi-people"></i>
                                المستخدمين
                            </a>
                        </li>
                        <li class="nav-item">
                            <a class="nav-link" href="settings/">
                                <i class="bi bi-gear"></i>
                                الإعدادات
                            </a>
                        </li>
                    </ul>
                    
                    <hr class="my-3" style="border-color: rgba(255,255,255,0.3);">
                    
                    <!-- قائمة إضافية -->
                    <ul class="nav flex-column">
                        <li class="nav-item">
                            <a class="nav-link active" href="backup.php">
                                <i class="bi bi-cloud-download"></i>
                                النسخ الاحتياطي
                            </a>
                        </li>
                        <li class="nav-item">
                            <a class="nav-link" href="auth/logout.php">
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
                        <h1 class="h2">
                            <i class="bi bi-cloud-download me-2"></i>
                            النسخ الاحتياطي
                        </h1>
                        <p class="text-muted">إدارة النسخ الاحتياطية لقاعدة البيانات</p>
                    </div>
                </div>
                
                <!-- رسائل التنبيه -->
                <?php if (!empty($message)): ?>
                <div class="alert alert-<?php echo $message_type; ?> alert-dismissible fade show" role="alert">
                    <i class="bi bi-<?php echo $message_type === 'success' ? 'check-circle' : 'exclamation-triangle'; ?> me-2"></i>
                    <?php echo $message; ?>
                    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
                </div>
                <?php endif; ?>
                
                <!-- إنشاء نسخة احتياطية جديدة -->
                <div class="row mb-4">
                    <div class="col-12">
                        <div class="card">
                            <div class="card-header">
                                <h5 class="card-title mb-0">
                                    <i class="bi bi-plus-circle me-2"></i>
                                    إنشاء نسخة احتياطية جديدة
                                </h5>
                            </div>
                            <div class="card-body">
                                <div class="row align-items-center">
                                    <div class="col-md-8">
                                        <p class="mb-2">
                                            <i class="bi bi-info-circle text-info me-2"></i>
                                            سيتم إنشاء نسخة احتياطية كاملة من قاعدة البيانات تتضمن جميع البيانات والجداول.
                                        </p>
                                        <small class="text-muted">
                                            آخر نسخة احتياطية: <?php echo !empty($backups) ? date('Y/m/d H:i', strtotime($backups[0]['created_at'])) : 'لا توجد نسخ سابقة'; ?>
                                        </small>
                                    </div>
                                    <div class="col-md-4 text-end">
                                        <form method="POST" style="display: inline;">
                                            <button type="submit" name="create_backup" class="btn btn-primary btn-lg" 
                                                    onclick="return confirm('هل تريد إنشاء نسخة احتياطية جديدة؟')">
                                                <i class="bi bi-cloud-arrow-down me-2"></i>
                                                إنشاء نسخة احتياطية
                                            </button>
                                        </form>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- قائمة النسخ الاحتياطية -->
                <div class="row">
                    <div class="col-12">
                        <div class="card">
                            <div class="card-header">
                                <h5 class="card-title mb-0">
                                    <i class="bi bi-list me-2"></i>
                                    النسخ الاحتياطية المتاحة
                                    <span class="badge bg-primary"><?php echo count($backups); ?></span>
                                </h5>
                            </div>
                            <div class="card-body">
                                <?php if (!empty($backups)): ?>
                                <div class="table-responsive">
                                    <table class="table table-hover">
                                        <thead>
                                            <tr>
                                                <th>اسم الملف</th>
                                                <th>حجم الملف</th>
                                                <th>نوع النسخة</th>
                                                <th>تاريخ الإنشاء</th>
                                                <th>الحالة</th>
                                                <th>الإجراءات</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <?php foreach ($backups as $backup): ?>
                                            <tr>
                                                <td>
                                                    <i class="bi bi-file-zip me-2"></i>
                                                    <?php echo htmlspecialchars($backup['filename']); ?>
                                                </td>
                                                <td>
                                                    <?php echo $hospital->formatFileSize($backup['file_size']); ?>
                                                </td>
                                                <td>
                                                    <?php if ($backup['backup_type'] === 'manual'): ?>
                                                    <span class="badge bg-info">يدوي</span>
                                                    <?php else: ?>
                                                    <span class="badge bg-success">تلقائي</span>
                                                    <?php endif; ?>
                                                </td>
                                                <td>
                                                    <?php echo date('Y/m/d H:i', strtotime($backup['created_at'])); ?>
                                                </td>
                                                <td>
                                                    <?php
                                                    $status_class = '';
                                                    $status_text = '';
                                                    switch ($backup['status']) {
                                                        case 'completed':
                                                            $status_class = 'bg-success';
                                                            $status_text = 'مكتمل';
                                                            break;
                                                        case 'pending':
                                                            $status_class = 'bg-warning';
                                                            $status_text = 'قيد المعالجة';
                                                            break;
                                                        case 'failed':
                                                            $status_class = 'bg-danger';
                                                            $status_text = 'فاشل';
                                                            break;
                                                    }
                                                    ?>
                                                    <span class="badge <?php echo $status_class; ?>">
                                                        <?php echo $status_text; ?>
                                                    </span>
                                                </td>
                                                <td>
                                                    <div class="btn-group btn-group-sm">
                                                        <?php if ($backup['status'] === 'completed'): ?>
                                                        <a href="download_backup.php?file=<?php echo urlencode($backup['filename']); ?>" 
                                                           class="btn btn-outline-primary" title="تحميل">
                                                            <i class="bi bi-download"></i>
                                                        </a>
                                                        
                                                        <button type="button" class="btn btn-outline-warning" 
                                                                onclick="restoreBackup('<?php echo htmlspecialchars($backup['filename']); ?>')" 
                                                                title="استعادة">
                                                            <i class="bi bi-arrow-clockwise"></i>
                                                        </button>
                                                        <?php endif; ?>
                                                        
                                                        <button type="button" class="btn btn-outline-danger" 
                                                                onclick="deleteBackup('<?php echo htmlspecialchars($backup['filename']); ?>')" 
                                                                title="حذف">
                                                            <i class="bi bi-trash"></i>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                            <?php endforeach; ?>
                                        </tbody>
                                    </table>
                                </div>
                                <?php else: ?>
                                <div class="text-center py-5">
                                    <i class="bi bi-cloud-slash display-1 text-muted"></i>
                                    <h4 class="text-muted mt-3">لا توجد نسخ احتياطية</h4>
                                    <p class="text-muted">لم يتم إنشاء أي نسخ احتياطية بعد</p>
                                </div>
                                <?php endif; ?>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- معلومات مهمة -->
                <div class="row mt-4">
                    <div class="col-12">
                        <div class="alert alert-info">
                            <h6 class="alert-heading">
                                <i class="bi bi-info-circle me-2"></i>
                                معلومات مهمة حول النسخ الاحتياطي
                            </h6>
                            <ul class="mb-0">
                                <li>يُنصح بإنشاء نسخة احتياطية يومياً للحفاظ على البيانات</li>
                                <li>يتم حفظ النسخ الاحتياطية في مجلد محمي على الخادم</li>
                                <li>عملية الاستعادة ستحذف البيانات الحالية وتستبدلها بالنسخة المحددة</li>
                                <li>تأكد من تحميل النسخ الاحتياطية المهمة إلى مكان آمن خارج الخادم</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    </div>
    
    <!-- نموذج استعادة النسخة الاحتياطية -->
    <form id="restoreForm" method="POST" style="display: none;">
        <input type="hidden" name="restore_backup" value="1">
        <input type="hidden" name="backup_file" id="restoreFile">
    </form>
    
    <!-- Bootstrap JS -->
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    
    <!-- Custom JS -->
    <script>
        // استعادة نسخة احتياطية
        function restoreBackup(filename) {
            if (confirm('تحذير: ستؤدي هذه العملية إلى حذف جميع البيانات الحالية واستبدالها بالنسخة المحددة.\n\nهل تريد المتابعة؟')) {
                if (confirm('هذا تأكيد أخير. هل أنت متأكد من رغبتك في استعادة النسخة الاحتياطية؟')) {
                    document.getElementById('restoreFile').value = filename;
                    document.getElementById('restoreForm').submit();
                }
            }
        }
        
        // حذف نسخة احتياطية
        function deleteBackup(filename) {
            if (confirm('هل تريد حذف هذه النسخة الاحتياطية؟\n\n' + filename)) {
                window.location.href = 'delete_backup.php?file=' + encodeURIComponent(filename);
            }
        }
        
        // تحديث الصفحة كل 30 ثانية للتحقق من حالة النسخ الاحتياطية
        setInterval(function() {
            // التحقق من وجود نسخ قيد المعالجة
            const pendingBackups = document.querySelectorAll('.badge.bg-warning');
            if (pendingBackups.length > 0) {
                location.reload();
            }
        }, 30000);
    </script>
</body>
</html>
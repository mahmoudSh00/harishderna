<?php
/**
 * إضافة مريض للمعاينة - مستشفى الوحدة العلاجي
 * Add Outpatient - Hospital Unity
 */

require_once '../includes/functions.php';

// التحقق من تسجيل الدخول
if (!$hospital->isLoggedIn()) {
    header('Location: ../index.php');
    exit();
}

$message = '';
$message_type = '';

// معالجة النموذج
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    try {
        $db = (new Database())->getConnection();
        
        // التحقق من البيانات المطلوبة
        $required_fields = ['patient_name', 'disease', 'visit_date'];
        $missing_fields = [];
        
        foreach ($required_fields as $field) {
            if (empty($_POST[$field])) {
                $missing_fields[] = $field;
            }
        }
        
        if (!empty($missing_fields)) {
            throw new Exception('يرجى ملء جميع الحقول المطلوبة');
        }
        
        // تنظيف البيانات
        $patient_name = $hospital->sanitizeInput($_POST['patient_name']);
        $age = !empty($_POST['age']) ? intval($_POST['age']) : null;
        $gender = !empty($_POST['gender']) ? $_POST['gender'] : null;
        $phone = $hospital->sanitizeInput($_POST['phone']);
        $disease = $hospital->sanitizeInput($_POST['disease']);
        $department_id = !empty($_POST['department_id']) ? intval($_POST['department_id']) : null;
        $doctor_name = $hospital->sanitizeInput($_POST['doctor_name']);
        $visit_date = $_POST['visit_date'];
        $visit_time = !empty($_POST['visit_time']) ? $_POST['visit_time'] : null;
        $notes = $hospital->sanitizeInput($_POST['notes']);
        
        // التحقق من صحة البيانات
        if ($age !== null && ($age < 0 || $age > 150)) {
            throw new Exception('العمر غير صحيح');
        }
        
        if ($gender && !in_array($gender, ['male', 'female'])) {
            throw new Exception('الجنس غير صحيح');
        }
        
        if (!empty($phone) && !$hospital->validatePhone($phone)) {
            throw new Exception('رقم الهاتف غير صحيح');
        }
        
        // الحصول على رقم طابور جديد
        $queue_number = $hospital->getNextQueueNumber($visit_date);
        if (!$queue_number) {
            throw new Exception('تم الوصول للحد الأقصى من أرقام الطابور لهذا اليوم');
        }
        
        // بدء المعاملة
        $db->beginTransaction();
        
        // إدراج بيانات المريض
        $insert_query = "INSERT INTO outpatients (
            patient_name, age, gender, phone, queue_number, disease, 
            department_id, doctor_name, visit_date, visit_time, notes, created_by
        ) VALUES (
            :patient_name, :age, :gender, :phone, :queue_number, :disease,
            :department_id, :doctor_name, :visit_date, :visit_time, :notes, :created_by
        )";
        
        $insert_stmt = $db->prepare($insert_query);
        $insert_stmt->bindParam(':patient_name', $patient_name);
        $insert_stmt->bindParam(':age', $age);
        $insert_stmt->bindParam(':gender', $gender);
        $insert_stmt->bindParam(':phone', $phone);
        $insert_stmt->bindParam(':queue_number', $queue_number);
        $insert_stmt->bindParam(':disease', $disease);
        $insert_stmt->bindParam(':department_id', $department_id);
        $insert_stmt->bindParam(':doctor_name', $doctor_name);
        $insert_stmt->bindParam(':visit_date', $visit_date);
        $insert_stmt->bindParam(':visit_time', $visit_time);
        $insert_stmt->bindParam(':notes', $notes);
        $insert_stmt->bindParam(':created_by', $_SESSION['user_id']);
        
        if (!$insert_stmt->execute()) {
            throw new Exception('فشل في إضافة المريض');
        }
        
        $patient_id = $db->lastInsertId();
        
        // تسجيل العملية
        $hospital->logActivity($_SESSION['user_id'], 'إضافة مريض للمعاينة', 'outpatients', $patient_id);
        
        // إرسال رسالة نصية إذا كان رقم الهاتف متوفر
        if (!empty($phone)) {
            $sms_message = "مرحباً {$patient_name}، رقمك في الطابور هو {$queue_number} لتاريخ {$visit_date} في " . APP_NAME;
            $hospital->sendSMS($phone, $sms_message);
        }
        
        // تأكيد المعاملة
        $db->commit();
        
        $message = "تم إضافة المريض بنجاح. رقم الطابور: {$queue_number}";
        $message_type = 'success';
        
        // إعادة توجيه لطباعة التذكرة
        header("refresh:2;url=print_ticket.php?id={$patient_id}");
        
    } catch (Exception $e) {
        if (isset($db) && $db->inTransaction()) {
            $db->rollback();
        }
        $message = $e->getMessage();
        $message_type = 'danger';
    }
}

// الحصول على الأقسام
try {
    $db = (new Database())->getConnection();
    
    $dept_query = "SELECT id, name FROM departments WHERE is_active = 1 ORDER BY name";
    $dept_stmt = $db->prepare($dept_query);
    $dept_stmt->execute();
    $departments = $dept_stmt->fetchAll();
    
} catch (Exception $e) {
    $departments = [];
}
?>
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>إضافة مريض للمعاينة - <?php echo APP_NAME; ?></title>
    
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
                            <a class="nav-link active" href="index.php">
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
                            <a class="nav-link" href="../settings/">
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
                        <h1 class="h2">
                            <i class="bi bi-clipboard-plus me-2"></i>
                            إضافة مريض للمعاينة
                        </h1>
                        <p class="text-muted">تسجيل مريض جديد في طابور المعاينة</p>
                    </div>
                    
                    <div class="btn-toolbar mb-2 mb-md-0">
                        <div class="btn-group me-2">
                            <a href="index.php" class="btn btn-outline-secondary">
                                <i class="bi bi-arrow-right me-1"></i>
                                العودة للطابور
                            </a>
                        </div>
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
                
                <!-- نموذج إضافة المريض -->
                <div class="row">
                    <div class="col-lg-8 mx-auto">
                        <div class="form-container">
                            <form method="POST" id="addPatientForm">
                                <div class="row">
                                    <!-- البيانات الأساسية -->
                                    <div class="col-12">
                                        <h5 class="mb-3 text-primary">
                                            <i class="bi bi-person me-2"></i>
                                            البيانات الأساسية
                                        </h5>
                                    </div>
                                    
                                    <div class="col-md-6">
                                        <div class="mb-3">
                                            <label for="patient_name" class="form-label">
                                                اسم المريض <span class="text-danger">*</span>
                                            </label>
                                            <input type="text" class="form-control" id="patient_name" name="patient_name" 
                                                   value="<?php echo htmlspecialchars($_POST['patient_name'] ?? ''); ?>" required>
                                        </div>
                                    </div>
                                    
                                    <div class="col-md-3">
                                        <div class="mb-3">
                                            <label for="age" class="form-label">العمر</label>
                                            <input type="number" class="form-control" id="age" name="age" 
                                                   min="0" max="150" value="<?php echo htmlspecialchars($_POST['age'] ?? ''); ?>">
                                        </div>
                                    </div>
                                    
                                    <div class="col-md-3">
                                        <div class="mb-3">
                                            <label for="gender" class="form-label">الجنس</label>
                                            <select class="form-select" id="gender" name="gender">
                                                <option value="">اختر الجنس</option>
                                                <option value="male" <?php echo ($_POST['gender'] ?? '') === 'male' ? 'selected' : ''; ?>>ذكر</option>
                                                <option value="female" <?php echo ($_POST['gender'] ?? '') === 'female' ? 'selected' : ''; ?>>أنثى</option>
                                            </select>
                                        </div>
                                    </div>
                                    
                                    <div class="col-md-6">
                                        <div class="mb-3">
                                            <label for="phone" class="form-label">رقم الهاتف</label>
                                            <input type="tel" class="form-control" id="phone" name="phone" 
                                                   value="<?php echo htmlspecialchars($_POST['phone'] ?? ''); ?>">
                                            <div class="form-text">سيتم إرسال رسالة نصية برقم الطابور</div>
                                        </div>
                                    </div>
                                    
                                    <div class="col-md-6">
                                        <div class="mb-3">
                                            <label for="disease" class="form-label">
                                                المرض/سبب الزيارة <span class="text-danger">*</span>
                                            </label>
                                            <input type="text" class="form-control" id="disease" name="disease" 
                                                   value="<?php echo htmlspecialchars($_POST['disease'] ?? ''); ?>" required>
                                        </div>
                                    </div>
                                </div>
                                
                                <hr class="my-4">
                                
                                <div class="row">
                                    <!-- تفاصيل الزيارة -->
                                    <div class="col-12">
                                        <h5 class="mb-3 text-primary">
                                            <i class="bi bi-calendar-check me-2"></i>
                                            تفاصيل الزيارة
                                        </h5>
                                    </div>
                                    
                                    <div class="col-md-4">
                                        <div class="mb-3">
                                            <label for="visit_date" class="form-label">
                                                تاريخ الزيارة <span class="text-danger">*</span>
                                            </label>
                                            <input type="date" class="form-control" id="visit_date" name="visit_date" 
                                                   value="<?php echo $_POST['visit_date'] ?? date('Y-m-d'); ?>" required>
                                        </div>
                                    </div>
                                    
                                    <div class="col-md-4">
                                        <div class="mb-3">
                                            <label for="visit_time" class="form-label">وقت الزيارة المفضل</label>
                                            <input type="time" class="form-control" id="visit_time" name="visit_time" 
                                                   value="<?php echo $_POST['visit_time'] ?? ''; ?>">
                                        </div>
                                    </div>
                                    
                                    <div class="col-md-4">
                                        <div class="mb-3">
                                            <label for="department_id" class="form-label">القسم</label>
                                            <select class="form-select" id="department_id" name="department_id">
                                                <option value="">اختر القسم</option>
                                                <?php foreach ($departments as $dept): ?>
                                                <option value="<?php echo $dept['id']; ?>" 
                                                        <?php echo ($_POST['department_id'] ?? '') == $dept['id'] ? 'selected' : ''; ?>>
                                                    <?php echo htmlspecialchars($dept['name']); ?>
                                                </option>
                                                <?php endforeach; ?>
                                            </select>
                                        </div>
                                    </div>
                                    
                                    <div class="col-md-6">
                                        <div class="mb-3">
                                            <label for="doctor_name" class="form-label">اسم الطبيب المطلوب</label>
                                            <input type="text" class="form-control" id="doctor_name" name="doctor_name" 
                                                   value="<?php echo htmlspecialchars($_POST['doctor_name'] ?? ''); ?>">
                                        </div>
                                    </div>
                                    
                                    <div class="col-md-6">
                                        <div class="mb-3">
                                            <label for="notes" class="form-label">ملاحظات إضافية</label>
                                            <textarea class="form-control" id="notes" name="notes" rows="3"><?php echo htmlspecialchars($_POST['notes'] ?? ''); ?></textarea>
                                        </div>
                                    </div>
                                </div>
                                
                                <!-- معاينة رقم الطابور -->
                                <div class="row">
                                    <div class="col-12">
                                        <div class="alert alert-info">
                                            <i class="bi bi-info-circle me-2"></i>
                                            <strong>رقم الطابور التالي:</strong>
                                            <span id="next-queue-number" class="badge bg-primary fs-6 ms-2">جاري التحميل...</span>
                                        </div>
                                    </div>
                                </div>
                                
                                <hr class="my-4">
                                
                                <!-- أزرار الإجراءات -->
                                <div class="row">
                                    <div class="col-12">
                                        <div class="d-flex justify-content-between">
                                            <div>
                                                <button type="submit" class="btn btn-primary btn-lg">
                                                    <i class="bi bi-check-circle me-2"></i>
                                                    إضافة للطابور
                                                </button>
                                                <button type="reset" class="btn btn-outline-secondary btn-lg ms-2">
                                                    <i class="bi bi-arrow-clockwise me-2"></i>
                                                    إعادة تعيين
                                                </button>
                                            </div>
                                            <div>
                                                <a href="index.php" class="btn btn-outline-danger btn-lg">
                                                    <i class="bi bi-x-circle me-2"></i>
                                                    إلغاء
                                                </a>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    </div>
    
    <!-- Bootstrap JS -->
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    
    <!-- Custom JS -->
    <script>
        // تحديث رقم الطابور عند تغيير التاريخ
        function updateQueueNumber() {
            const visitDate = document.getElementById('visit_date').value;
            const queueSpan = document.getElementById('next-queue-number');
            
            if (visitDate) {
                fetch(`get_next_queue.php?date=${visitDate}`)
                    .then(response => response.json())
                    .then(data => {
                        if (data.success) {
                            queueSpan.textContent = data.queue_number;
                            queueSpan.className = 'badge bg-primary fs-6 ms-2';
                        } else {
                            queueSpan.textContent = 'خطأ';
                            queueSpan.className = 'badge bg-danger fs-6 ms-2';
                        }
                    })
                    .catch(error => {
                        queueSpan.textContent = 'خطأ';
                        queueSpan.className = 'badge bg-danger fs-6 ms-2';
                    });
            }
        }
        
        // تحديث رقم الطابور عند تحميل الصفحة وتغيير التاريخ
        document.addEventListener('DOMContentLoaded', updateQueueNumber);
        document.getElementById('visit_date').addEventListener('change', updateQueueNumber);
        
        // التحقق من صحة النموذج
        document.getElementById('addPatientForm').addEventListener('submit', function(e) {
            const requiredFields = ['patient_name', 'disease', 'visit_date'];
            let isValid = true;
            
            requiredFields.forEach(fieldName => {
                const field = document.getElementById(fieldName);
                if (!field.value.trim()) {
                    field.classList.add('is-invalid');
                    isValid = false;
                } else {
                    field.classList.remove('is-invalid');
                }
            });
            
            // التحقق من صحة العمر
            const age = document.getElementById('age').value;
            if (age && (parseInt(age) < 0 || parseInt(age) > 150)) {
                document.getElementById('age').classList.add('is-invalid');
                isValid = false;
            }
            
            // التحقق من صحة رقم الهاتف
            const phone = document.getElementById('phone').value;
            if (phone && !/^[0-9+\-\s()]+$/.test(phone)) {
                document.getElementById('phone').classList.add('is-invalid');
                isValid = false;
            } else {
                document.getElementById('phone').classList.remove('is-invalid');
            }
            
            // التحقق من التاريخ (لا يمكن أن يكون في الماضي)
            const visitDate = new Date(document.getElementById('visit_date').value);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            if (visitDate < today) {
                document.getElementById('visit_date').classList.add('is-invalid');
                isValid = false;
                alert('لا يمكن تحديد تاريخ في الماضي');
            } else {
                document.getElementById('visit_date').classList.remove('is-invalid');
            }
            
            if (!isValid) {
                e.preventDefault();
                alert('يرجى تصحيح الأخطاء في النموذج');
            }
        });
        
        // إزالة رسالة الخطأ عند الكتابة
        document.querySelectorAll('.form-control, .form-select').forEach(field => {
            field.addEventListener('input', function() {
                this.classList.remove('is-invalid');
            });
        });
        
        // تحديد تاريخ اليوم كافتراضي
        if (!document.getElementById('visit_date').value) {
            document.getElementById('visit_date').value = new Date().toISOString().split('T')[0];
        }
        
        // تحديد الوقت الحالي كافتراضي
        if (!document.getElementById('visit_time').value) {
            const now = new Date();
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            document.getElementById('visit_time').value = `${hours}:${minutes}`;
        }
    </script>
</body>
</html>
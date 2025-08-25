<?php
/**
 * إضافة مريض مقيم - مستشفى الوحدة العلاجي
 * Add Inpatient - Hospital Unity
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
        $required_fields = ['patient_name', 'age', 'gender', 'disease', 'admission_date'];
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
        $age = intval($_POST['age']);
        $gender = $_POST['gender'];
        $phone = $hospital->sanitizeInput($_POST['phone']);
        $address = $hospital->sanitizeInput($_POST['address']);
        $national_id = $hospital->sanitizeInput($_POST['national_id']);
        $disease = $hospital->sanitizeInput($_POST['disease']);
        $room_id = !empty($_POST['room_id']) ? intval($_POST['room_id']) : null;
        $bed_id = !empty($_POST['bed_id']) ? intval($_POST['bed_id']) : null;
        $admission_date = $_POST['admission_date'];
        $doctor_name = $hospital->sanitizeInput($_POST['doctor_name']);
        $notes = $hospital->sanitizeInput($_POST['notes']);
        
        // التحقق من صحة البيانات
        if ($age < 0 || $age > 150) {
            throw new Exception('العمر غير صحيح');
        }
        
        if (!in_array($gender, ['male', 'female'])) {
            throw new Exception('الجنس غير صحيح');
        }
        
        if (!empty($phone) && !$hospital->validatePhone($phone)) {
            throw new Exception('رقم الهاتف غير صحيح');
        }
        
        // التحقق من توفر السرير
        if ($bed_id) {
            $bed_check_query = "SELECT is_occupied FROM beds WHERE id = :bed_id";
            $bed_check_stmt = $db->prepare($bed_check_query);
            $bed_check_stmt->bindParam(':bed_id', $bed_id);
            $bed_check_stmt->execute();
            $bed_info = $bed_check_stmt->fetch();
            
            if (!$bed_info) {
                throw new Exception('السرير المحدد غير موجود');
            }
            
            if ($bed_info['is_occupied']) {
                throw new Exception('السرير المحدد محجوز بالفعل');
            }
        }
        
        // بدء المعاملة
        $db->beginTransaction();
        
        // إدراج بيانات المريض
        $insert_query = "INSERT INTO inpatients (
            patient_name, age, gender, phone, address, national_id, disease, 
            room_id, bed_id, admission_date, doctor_name, notes, created_by
        ) VALUES (
            :patient_name, :age, :gender, :phone, :address, :national_id, :disease,
            :room_id, :bed_id, :admission_date, :doctor_name, :notes, :created_by
        )";
        
        $insert_stmt = $db->prepare($insert_query);
        $insert_stmt->bindParam(':patient_name', $patient_name);
        $insert_stmt->bindParam(':age', $age);
        $insert_stmt->bindParam(':gender', $gender);
        $insert_stmt->bindParam(':phone', $phone);
        $insert_stmt->bindParam(':address', $address);
        $insert_stmt->bindParam(':national_id', $national_id);
        $insert_stmt->bindParam(':disease', $disease);
        $insert_stmt->bindParam(':room_id', $room_id);
        $insert_stmt->bindParam(':bed_id', $bed_id);
        $insert_stmt->bindParam(':admission_date', $admission_date);
        $insert_stmt->bindParam(':doctor_name', $doctor_name);
        $insert_stmt->bindParam(':notes', $notes);
        $insert_stmt->bindParam(':created_by', $_SESSION['user_id']);
        
        if (!$insert_stmt->execute()) {
            throw new Exception('فشل في إضافة المريض');
        }
        
        $patient_id = $db->lastInsertId();
        
        // تحديث حالة السرير إذا تم تحديده
        if ($bed_id) {
            $update_bed_query = "UPDATE beds SET is_occupied = 1 WHERE id = :bed_id";
            $update_bed_stmt = $db->prepare($update_bed_query);
            $update_bed_stmt->bindParam(':bed_id', $bed_id);
            $update_bed_stmt->execute();
        }
        
        // تسجيل العملية
        $hospital->logActivity($_SESSION['user_id'], 'إضافة مريض مقيم', 'inpatients', $patient_id);
        
        // إرسال رسالة نصية إذا كان رقم الهاتف متوفر
        if (!empty($phone)) {
            $sms_message = "مرحباً {$patient_name}، تم تسجيلك في " . APP_NAME . " بتاريخ {$admission_date}. نتمنى لك الشفاء العاجل.";
            $hospital->sendSMS($phone, $sms_message);
        }
        
        // تأكيد المعاملة
        $db->commit();
        
        $message = 'تم إضافة المريض بنجاح';
        $message_type = 'success';
        
        // إعادة توجيه بعد 2 ثانية
        header("refresh:2;url=view.php?id={$patient_id}");
        
    } catch (Exception $e) {
        if (isset($db) && $db->inTransaction()) {
            $db->rollback();
        }
        $message = $e->getMessage();
        $message_type = 'danger';
    }
}

// الحصول على الأقسام والغرف
try {
    $db = (new Database())->getConnection();
    
    // الأقسام
    $dept_query = "SELECT id, name FROM departments WHERE is_active = 1 ORDER BY name";
    $dept_stmt = $db->prepare($dept_query);
    $dept_stmt->execute();
    $departments = $dept_stmt->fetchAll();
    
    // الغرف المتاحة
    $rooms_query = "SELECT r.id, r.room_number, d.name as department_name 
                    FROM rooms r 
                    JOIN departments d ON r.department_id = d.id 
                    WHERE r.is_active = 1 
                    ORDER BY d.name, r.room_number";
    $rooms_stmt = $db->prepare($rooms_query);
    $rooms_stmt->execute();
    $rooms = $rooms_stmt->fetchAll();
    
} catch (Exception $e) {
    $departments = [];
    $rooms = [];
}
?>
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>إضافة مريض مقيم - <?php echo APP_NAME; ?></title>
    
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
                            <a class="nav-link active" href="index.php">
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
                            <i class="bi bi-person-plus me-2"></i>
                            إضافة مريض مقيم جديد
                        </h1>
                        <p class="text-muted">إدخال بيانات مريض جديد لقسم الإيواء</p>
                    </div>
                    
                    <div class="btn-toolbar mb-2 mb-md-0">
                        <div class="btn-group me-2">
                            <a href="index.php" class="btn btn-outline-secondary">
                                <i class="bi bi-arrow-right me-1"></i>
                                العودة للقائمة
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
                    <div class="col-12">
                        <div class="form-container">
                            <form method="POST" id="addPatientForm">
                                <div class="row">
                                    <!-- البيانات الشخصية -->
                                    <div class="col-lg-6">
                                        <h5 class="mb-3 text-primary">
                                            <i class="bi bi-person me-2"></i>
                                            البيانات الشخصية
                                        </h5>
                                        
                                        <div class="mb-3">
                                            <label for="patient_name" class="form-label">
                                                اسم المريض <span class="text-danger">*</span>
                                            </label>
                                            <input type="text" class="form-control" id="patient_name" name="patient_name" 
                                                   value="<?php echo htmlspecialchars($_POST['patient_name'] ?? ''); ?>" required>
                                        </div>
                                        
                                        <div class="row">
                                            <div class="col-md-6">
                                                <div class="mb-3">
                                                    <label for="age" class="form-label">
                                                        العمر <span class="text-danger">*</span>
                                                    </label>
                                                    <input type="number" class="form-control" id="age" name="age" 
                                                           min="0" max="150" value="<?php echo htmlspecialchars($_POST['age'] ?? ''); ?>" required>
                                                </div>
                                            </div>
                                            <div class="col-md-6">
                                                <div class="mb-3">
                                                    <label for="gender" class="form-label">
                                                        الجنس <span class="text-danger">*</span>
                                                    </label>
                                                    <select class="form-select" id="gender" name="gender" required>
                                                        <option value="">اختر الجنس</option>
                                                        <option value="male" <?php echo ($_POST['gender'] ?? '') === 'male' ? 'selected' : ''; ?>>ذكر</option>
                                                        <option value="female" <?php echo ($_POST['gender'] ?? '') === 'female' ? 'selected' : ''; ?>>أنثى</option>
                                                    </select>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div class="mb-3">
                                            <label for="phone" class="form-label">رقم الهاتف</label>
                                            <input type="tel" class="form-control" id="phone" name="phone" 
                                                   value="<?php echo htmlspecialchars($_POST['phone'] ?? ''); ?>">
                                        </div>
                                        
                                        <div class="mb-3">
                                            <label for="national_id" class="form-label">رقم الهوية</label>
                                            <input type="text" class="form-control" id="national_id" name="national_id" 
                                                   value="<?php echo htmlspecialchars($_POST['national_id'] ?? ''); ?>">
                                        </div>
                                        
                                        <div class="mb-3">
                                            <label for="address" class="form-label">العنوان</label>
                                            <textarea class="form-control" id="address" name="address" rows="3"><?php echo htmlspecialchars($_POST['address'] ?? ''); ?></textarea>
                                        </div>
                                    </div>
                                    
                                    <!-- البيانات الطبية والإقامة -->
                                    <div class="col-lg-6">
                                        <h5 class="mb-3 text-primary">
                                            <i class="bi bi-heart-pulse me-2"></i>
                                            البيانات الطبية والإقامة
                                        </h5>
                                        
                                        <div class="mb-3">
                                            <label for="disease" class="form-label">
                                                المرض/التشخيص <span class="text-danger">*</span>
                                            </label>
                                            <input type="text" class="form-control" id="disease" name="disease" 
                                                   value="<?php echo htmlspecialchars($_POST['disease'] ?? ''); ?>" required>
                                        </div>
                                        
                                        <div class="mb-3">
                                            <label for="admission_date" class="form-label">
                                                تاريخ الدخول <span class="text-danger">*</span>
                                            </label>
                                            <input type="date" class="form-control" id="admission_date" name="admission_date" 
                                                   value="<?php echo $_POST['admission_date'] ?? date('Y-m-d'); ?>" required>
                                        </div>
                                        
                                        <div class="mb-3">
                                            <label for="doctor_name" class="form-label">اسم الطبيب المعالج</label>
                                            <input type="text" class="form-control" id="doctor_name" name="doctor_name" 
                                                   value="<?php echo htmlspecialchars($_POST['doctor_name'] ?? ''); ?>">
                                        </div>
                                        
                                        <div class="row">
                                            <div class="col-md-6">
                                                <div class="mb-3">
                                                    <label for="room_id" class="form-label">الغرفة</label>
                                                    <select class="form-select" id="room_id" name="room_id">
                                                        <option value="">اختر الغرفة</option>
                                                        <?php foreach ($rooms as $room): ?>
                                                        <option value="<?php echo $room['id']; ?>" 
                                                                <?php echo ($_POST['room_id'] ?? '') == $room['id'] ? 'selected' : ''; ?>>
                                                            <?php echo $room['room_number'] . ' - ' . $room['department_name']; ?>
                                                        </option>
                                                        <?php endforeach; ?>
                                                    </select>
                                                </div>
                                            </div>
                                            <div class="col-md-6">
                                                <div class="mb-3">
                                                    <label for="bed_id" class="form-label">السرير</label>
                                                    <select class="form-select" id="bed_id" name="bed_id">
                                                        <option value="">اختر السرير</option>
                                                    </select>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div class="mb-3">
                                            <label for="notes" class="form-label">ملاحظات إضافية</label>
                                            <textarea class="form-control" id="notes" name="notes" rows="4"><?php echo htmlspecialchars($_POST['notes'] ?? ''); ?></textarea>
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
                                                    حفظ البيانات
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
        // تحديث قائمة الأسرة عند تغيير الغرفة
        document.getElementById('room_id').addEventListener('change', function() {
            const roomId = this.value;
            const bedSelect = document.getElementById('bed_id');
            
            // مسح الخيارات الحالية
            bedSelect.innerHTML = '<option value="">اختر السرير</option>';
            
            if (roomId) {
                // جلب الأسرة المتاحة للغرفة المحددة
                fetch(`get_beds.php?room_id=${roomId}`)
                    .then(response => response.json())
                    .then(data => {
                        if (data.success) {
                            data.beds.forEach(bed => {
                                const option = document.createElement('option');
                                option.value = bed.id;
                                option.textContent = bed.bed_number;
                                if (bed.is_occupied) {
                                    option.disabled = true;
                                    option.textContent += ' (محجوز)';
                                }
                                bedSelect.appendChild(option);
                            });
                        }
                    })
                    .catch(error => {
                        console.error('خطأ في جلب الأسرة:', error);
                    });
            }
        });
        
        // التحقق من صحة النموذج
        document.getElementById('addPatientForm').addEventListener('submit', function(e) {
            const requiredFields = ['patient_name', 'age', 'gender', 'disease', 'admission_date'];
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
            const age = parseInt(document.getElementById('age').value);
            if (age < 0 || age > 150) {
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
        document.getElementById('admission_date').value = new Date().toISOString().split('T')[0];
    </script>
</body>
</html>
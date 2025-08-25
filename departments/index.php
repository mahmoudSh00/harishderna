<?php
/**
 * إدارة الأقسام - مستشفى الوحدة العلاجي
 * Departments Management - Hospital Unity
 */

require_once '../includes/functions.php';

// التحقق من تسجيل الدخول
if (!$hospital->isLoggedIn()) {
    header('Location: ../index.php');
    exit();
}

$db = (new Database())->getConnection();

// معالجة العمليات
$message = '';
$message_type = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (isset($_POST['action'])) {
        switch ($_POST['action']) {
            case 'add_department':
                $name = $hospital->sanitizeInput($_POST['name']);
                $description = $hospital->sanitizeInput($_POST['description']);
                $head_doctor = $hospital->sanitizeInput($_POST['head_doctor']);
                $phone = $hospital->sanitizeInput($_POST['phone']);
                $location = $hospital->sanitizeInput($_POST['location']);
                
                try {
                    // التحقق من عدم وجود القسم
                    $check_query = "SELECT COUNT(*) FROM departments WHERE name = :name";
                    $check_stmt = $db->prepare($check_query);
                    $check_stmt->bindParam(':name', $name);
                    $check_stmt->execute();
                    
                    if ($check_stmt->fetchColumn() > 0) {
                        $message = "اسم القسم موجود بالفعل";
                        $message_type = 'danger';
                    } else {
                        $query = "INSERT INTO departments (name, description, head_doctor, phone, location, is_active, created_at) VALUES (:name, :description, :head_doctor, :phone, :location, 1, NOW())";
                        $stmt = $db->prepare($query);
                        $stmt->bindParam(':name', $name);
                        $stmt->bindParam(':description', $description);
                        $stmt->bindParam(':head_doctor', $head_doctor);
                        $stmt->bindParam(':phone', $phone);
                        $stmt->bindParam(':location', $location);
                        
                        if ($stmt->execute()) {
                            $dept_id = $db->lastInsertId();
                            $hospital->logActivity($_SESSION['user_id'], 'إضافة قسم جديد', 'departments', $dept_id);
                            $message = "تم إضافة القسم بنجاح";
                            $message_type = 'success';
                        }
                    }
                } catch (Exception $e) {
                    $message = "خطأ في إضافة القسم: " . $e->getMessage();
                    $message_type = 'danger';
                }
                break;
                
            case 'edit_department':
                $dept_id = (int)$_POST['dept_id'];
                $name = $hospital->sanitizeInput($_POST['name']);
                $description = $hospital->sanitizeInput($_POST['description']);
                $head_doctor = $hospital->sanitizeInput($_POST['head_doctor']);
                $phone = $hospital->sanitizeInput($_POST['phone']);
                $location = $hospital->sanitizeInput($_POST['location']);
                $is_active = isset($_POST['is_active']) ? 1 : 0;
                
                try {
                    // التحقق من عدم وجود اسم القسم لقسم آخر
                    $check_query = "SELECT COUNT(*) FROM departments WHERE name = :name AND id != :dept_id";
                    $check_stmt = $db->prepare($check_query);
                    $check_stmt->bindParam(':name', $name);
                    $check_stmt->bindParam(':dept_id', $dept_id);
                    $check_stmt->execute();
                    
                    if ($check_stmt->fetchColumn() > 0) {
                        $message = "اسم القسم موجود بالفعل";
                        $message_type = 'danger';
                    } else {
                        $query = "UPDATE departments SET name = :name, description = :description, head_doctor = :head_doctor, phone = :phone, location = :location, is_active = :is_active, updated_at = NOW() WHERE id = :dept_id";
                        $stmt = $db->prepare($query);
                        $stmt->bindParam(':name', $name);
                        $stmt->bindParam(':description', $description);
                        $stmt->bindParam(':head_doctor', $head_doctor);
                        $stmt->bindParam(':phone', $phone);
                        $stmt->bindParam(':location', $location);
                        $stmt->bindParam(':is_active', $is_active);
                        $stmt->bindParam(':dept_id', $dept_id);
                        
                        if ($stmt->execute()) {
                            $hospital->logActivity($_SESSION['user_id'], 'تعديل بيانات قسم', 'departments', $dept_id);
                            $message = "تم تحديث بيانات القسم بنجاح";
                            $message_type = 'success';
                        }
                    }
                } catch (Exception $e) {
                    $message = "خطأ في تحديث القسم: " . $e->getMessage();
                    $message_type = 'danger';
                }
                break;
                
            case 'delete_department':
                $dept_id = (int)$_POST['dept_id'];
                
                try {
                    // التحقق من وجود مرضى في القسم
                    $check_patients = "SELECT COUNT(*) FROM inpatients WHERE department = (SELECT name FROM departments WHERE id = :dept_id) AND status = 'active'";
                    $check_stmt = $db->prepare($check_patients);
                    $check_stmt->bindParam(':dept_id', $dept_id);
                    $check_stmt->execute();
                    
                    if ($check_stmt->fetchColumn() > 0) {
                        $message = "لا يمكن حذف القسم لوجود مرضى نشطين فيه";
                        $message_type = 'danger';
                    } else {
                        $query = "DELETE FROM departments WHERE id = :dept_id";
                        $stmt = $db->prepare($query);
                        $stmt->bindParam(':dept_id', $dept_id);
                        
                        if ($stmt->execute()) {
                            $hospital->logActivity($_SESSION['user_id'], 'حذف قسم', 'departments', $dept_id);
                            $message = "تم حذف القسم بنجاح";
                            $message_type = 'success';
                        }
                    }
                } catch (Exception $e) {
                    $message = "خطأ في حذف القسم: " . $e->getMessage();
                    $message_type = 'danger';
                }
                break;
                
            case 'toggle_status':
                $dept_id = (int)$_POST['dept_id'];
                
                try {
                    $query = "UPDATE departments SET is_active = NOT is_active, updated_at = NOW() WHERE id = :dept_id";
                    $stmt = $db->prepare($query);
                    $stmt->bindParam(':dept_id', $dept_id);
                    
                    if ($stmt->execute()) {
                        $hospital->logActivity($_SESSION['user_id'], 'تغيير حالة قسم', 'departments', $dept_id);
                        $message = "تم تغيير حالة القسم بنجاح";
                        $message_type = 'success';
                    }
                } catch (Exception $e) {
                    $message = "خطأ في تغيير حالة القسم: " . $e->getMessage();
                    $message_type = 'danger';
                }
                break;
        }
    }
}

// الحصول على الأقسام
try {
    $search = $_GET['search'] ?? '';
    $status_filter = $_GET['status'] ?? '';
    
    $where_conditions = ["1=1"];
    $params = [];
    
    if (!empty($search)) {
        $where_conditions[] = "(name LIKE :search OR head_doctor LIKE :search OR location LIKE :search)";
        $params[':search'] = "%{$search}%";
    }
    
    if ($status_filter !== '') {
        $where_conditions[] = "is_active = :status";
        $params[':status'] = $status_filter;
    }
    
    $where_clause = implode(' AND ', $where_conditions);
    
    // الحصول على الأقسام مع إحصائيات
    $query = "SELECT d.*, 
                     COUNT(DISTINCT i.id) as active_patients,
                     COUNT(DISTINCT o.id) as today_visits
              FROM departments d
              LEFT JOIN inpatients i ON d.name = i.department AND i.status = 'active'
              LEFT JOIN outpatients o ON d.name = o.department AND o.visit_date = CURDATE()
              WHERE {$where_clause}
              GROUP BY d.id
              ORDER BY d.created_at DESC";
    $stmt = $db->prepare($query);
    $stmt->execute($params);
    $departments = $stmt->fetchAll();
    
} catch (Exception $e) {
    $departments = [];
}
?>

<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>إدارة الأقسام - <?php echo APP_NAME; ?></title>
    
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
                            <a class="nav-link active" href="index.php">
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
                        <h1 class="h2">إدارة الأقسام</h1>
                        <p class="text-muted">إضافة وتعديل وحذف أقسام المستشفى</p>
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
                
                <!-- أدوات البحث والتصفية -->
                <div class="form-container mb-4">
                    <div class="row">
                        <div class="col-md-8">
                            <form method="GET" class="row g-3">
                                <div class="col-md-6">
                                    <input type="text" class="form-control" name="search" placeholder="البحث في الأقسام..." value="<?php echo htmlspecialchars($_GET['search'] ?? ''); ?>">
                                </div>
                                <div class="col-md-4">
                                    <select class="form-select" name="status">
                                        <option value="">جميع الحالات</option>
                                        <option value="1" <?php echo ($_GET['status'] ?? '') === '1' ? 'selected' : ''; ?>>نشط</option>
                                        <option value="0" <?php echo ($_GET['status'] ?? '') === '0' ? 'selected' : ''; ?>>غير نشط</option>
                                    </select>
                                </div>
                                <div class="col-md-2">
                                    <button type="submit" class="btn btn-primary w-100">
                                        <i class="bi bi-search"></i>
                                    </button>
                                </div>
                            </form>
                        </div>
                        <div class="col-md-4 text-end">
                            <button type="button" class="btn btn-success" data-bs-toggle="modal" data-bs-target="#addDepartmentModal">
                                <i class="bi bi-building-add me-2"></i>
                                إضافة قسم جديد
                            </button>
                        </div>
                    </div>
                </div>
                
                <!-- بطاقات الأقسام -->
                <div class="row">
                    <?php if (empty($departments)): ?>
                    <div class="col-12">
                        <div class="text-center text-muted py-5">
                            <i class="bi bi-building display-1 d-block mb-3"></i>
                            <h4>لا توجد أقسام</h4>
                            <p>ابدأ بإضافة قسم جديد</p>
                        </div>
                    </div>
                    <?php else: ?>
                    <?php foreach ($departments as $dept): ?>
                    <div class="col-lg-4 col-md-6 mb-4">
                        <div class="stats-card hover-lift h-100">
                            <div class="d-flex justify-content-between align-items-start mb-3">
                                <div class="stats-icon <?php echo $dept['is_active'] ? 'primary' : 'secondary'; ?>">
                                    <i class="bi bi-building"></i>
                                </div>
                                <div class="dropdown">
                                    <button class="btn btn-sm btn-outline-secondary" type="button" data-bs-toggle="dropdown">
                                        <i class="bi bi-three-dots-vertical"></i>
                                    </button>
                                    <ul class="dropdown-menu">
                                        <li>
                                            <button class="dropdown-item" onclick="editDepartment(<?php echo htmlspecialchars(json_encode($dept)); ?>)">
                                                <i class="bi bi-pencil me-2"></i>تعديل
                                            </button>
                                        </li>
                                        <li>
                                            <button class="dropdown-item" onclick="toggleStatus(<?php echo $dept['id']; ?>)">
                                                <i class="bi bi-toggle-<?php echo $dept['is_active'] ? 'on' : 'off'; ?> me-2"></i>
                                                <?php echo $dept['is_active'] ? 'إلغاء التفعيل' : 'تفعيل'; ?>
                                            </button>
                                        </li>
                                        <li><hr class="dropdown-divider"></li>
                                        <li>
                                            <button class="dropdown-item text-danger" onclick="deleteDepartment(<?php echo $dept['id']; ?>, '<?php echo htmlspecialchars($dept['name']); ?>')">
                                                <i class="bi bi-trash me-2"></i>حذف
                                            </button>
                                        </li>
                                    </ul>
                                </div>
                            </div>
                            
                            <h5 class="mb-2"><?php echo htmlspecialchars($dept['name']); ?></h5>
                            <p class="text-muted small mb-3"><?php echo htmlspecialchars($dept['description'] ?? 'لا يوجد وصف'); ?></p>
                            
                            <div class="row text-center mb-3">
                                <div class="col-6">
                                    <div class="stats-number text-primary"><?php echo $dept['active_patients']; ?></div>
                                    <div class="stats-label small">مرضى نشطين</div>
                                </div>
                                <div class="col-6">
                                    <div class="stats-number text-success"><?php echo $dept['today_visits']; ?></div>
                                    <div class="stats-label small">زيارات اليوم</div>
                                </div>
                            </div>
                            
                            <hr>
                            
                            <div class="small">
                                <?php if (!empty($dept['head_doctor'])): ?>
                                <div class="mb-1">
                                    <i class="bi bi-person-badge me-2"></i>
                                    <strong>رئيس القسم:</strong> <?php echo htmlspecialchars($dept['head_doctor']); ?>
                                </div>
                                <?php endif; ?>
                                
                                <?php if (!empty($dept['phone'])): ?>
                                <div class="mb-1">
                                    <i class="bi bi-telephone me-2"></i>
                                    <strong>الهاتف:</strong> <?php echo htmlspecialchars($dept['phone']); ?>
                                </div>
                                <?php endif; ?>
                                
                                <?php if (!empty($dept['location'])): ?>
                                <div class="mb-1">
                                    <i class="bi bi-geo-alt me-2"></i>
                                    <strong>الموقع:</strong> <?php echo htmlspecialchars($dept['location']); ?>
                                </div>
                                <?php endif; ?>
                                
                                <div class="mt-2">
                                    <span class="badge bg-<?php echo $dept['is_active'] ? 'success' : 'secondary'; ?>">
                                        <?php echo $dept['is_active'] ? 'نشط' : 'غير نشط'; ?>
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <?php endforeach; ?>
                    <?php endif; ?>
                </div>
            </main>
        </div>
    </div>
    
    <!-- مودال إضافة قسم -->
    <div class="modal fade" id="addDepartmentModal" tabindex="-1">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">إضافة قسم جديد</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <form method="POST">
                    <input type="hidden" name="action" value="add_department">
                    <div class="modal-body">
                        <div class="row">
                            <div class="col-md-6 mb-3">
                                <label for="name" class="form-label">اسم القسم</label>
                                <input type="text" class="form-control" id="name" name="name" required>
                            </div>
                            <div class="col-md-6 mb-3">
                                <label for="head_doctor" class="form-label">رئيس القسم</label>
                                <input type="text" class="form-control" id="head_doctor" name="head_doctor">
                            </div>
                        </div>
                        <div class="row">
                            <div class="col-md-6 mb-3">
                                <label for="phone" class="form-label">رقم الهاتف</label>
                                <input type="tel" class="form-control" id="phone" name="phone">
                            </div>
                            <div class="col-md-6 mb-3">
                                <label for="location" class="form-label">الموقع</label>
                                <input type="text" class="form-control" id="location" name="location">
                            </div>
                        </div>
                        <div class="mb-3">
                            <label for="description" class="form-label">الوصف</label>
                            <textarea class="form-control" id="description" name="description" rows="3"></textarea>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">إلغاء</button>
                        <button type="submit" class="btn btn-success">إضافة القسم</button>
                    </div>
                </form>
            </div>
        </div>
    </div>
    
    <!-- مودال تعديل قسم -->
    <div class="modal fade" id="editDepartmentModal" tabindex="-1">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">تعديل القسم</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <form method="POST">
                    <input type="hidden" name="action" value="edit_department">
                    <input type="hidden" name="dept_id" id="edit_dept_id">
                    <div class="modal-body">
                        <div class="row">
                            <div class="col-md-6 mb-3">
                                <label for="edit_name" class="form-label">اسم القسم</label>
                                <input type="text" class="form-control" id="edit_name" name="name" required>
                            </div>
                            <div class="col-md-6 mb-3">
                                <label for="edit_head_doctor" class="form-label">رئيس القسم</label>
                                <input type="text" class="form-control" id="edit_head_doctor" name="head_doctor">
                            </div>
                        </div>
                        <div class="row">
                            <div class="col-md-6 mb-3">
                                <label for="edit_phone" class="form-label">رقم الهاتف</label>
                                <input type="tel" class="form-control" id="edit_phone" name="phone">
                            </div>
                            <div class="col-md-6 mb-3">
                                <label for="edit_location" class="form-label">الموقع</label>
                                <input type="text" class="form-control" id="edit_location" name="location">
                            </div>
                        </div>
                        <div class="mb-3">
                            <label for="edit_description" class="form-label">الوصف</label>
                            <textarea class="form-control" id="edit_description" name="description" rows="3"></textarea>
                        </div>
                        <div class="mb-3">
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" id="edit_is_active" name="is_active">
                                <label class="form-check-label" for="edit_is_active">
                                    القسم نشط
                                </label>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">إلغاء</button>
                        <button type="submit" class="btn btn-warning">تحديث القسم</button>
                    </div>
                </form>
            </div>
        </div>
    </div>
    
    <!-- Bootstrap JS -->
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    
    <script>
        function editDepartment(dept) {
            document.getElementById('edit_dept_id').value = dept.id;
            document.getElementById('edit_name').value = dept.name;
            document.getElementById('edit_description').value = dept.description || '';
            document.getElementById('edit_head_doctor').value = dept.head_doctor || '';
            document.getElementById('edit_phone').value = dept.phone || '';
            document.getElementById('edit_location').value = dept.location || '';
            document.getElementById('edit_is_active').checked = dept.is_active == 1;
            
            new bootstrap.Modal(document.getElementById('editDepartmentModal')).show();
        }
        
        function deleteDepartment(deptId, deptName) {
            if (confirm('هل أنت متأكد من حذف القسم "' + deptName + '"؟\nهذا الإجراء لا يمكن التراجع عنه.')) {
                const form = document.createElement('form');
                form.method = 'POST';
                form.innerHTML = `
                    <input type="hidden" name="action" value="delete_department">
                    <input type="hidden" name="dept_id" value="${deptId}">
                `;
                document.body.appendChild(form);
                form.submit();
            }
        }
        
        function toggleStatus(deptId) {
            const form = document.createElement('form');
            form.method = 'POST';
            form.innerHTML = `
                <input type="hidden" name="action" value="toggle_status">
                <input type="hidden" name="dept_id" value="${deptId}">
            `;
            document.body.appendChild(form);
            form.submit();
        }
    </script>
</body>
</html>
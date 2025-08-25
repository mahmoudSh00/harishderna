<?php
/**
 * إدارة المرضى المقيمين - مستشفى الوحدة العلاجي
 * Inpatients Management - Hospital Unity
 */

require_once '../includes/functions.php';

// التحقق من تسجيل الدخول
if (!$hospital->isLoggedIn()) {
    header('Location: ../index.php');
    exit();
}

// الحصول على المرضى المقيمين
try {
    $db = (new Database())->getConnection();
    
    // إعدادات البحث والتصفية
    $search = $_GET['search'] ?? '';
    $status_filter = $_GET['status'] ?? '';
    $department_filter = $_GET['department'] ?? '';
    $page = max(1, intval($_GET['page'] ?? 1));
    $per_page = 20;
    $offset = ($page - 1) * $per_page;
    
    // بناء استعلام البحث
    $where_conditions = ["1=1"];
    $params = [];
    
    if (!empty($search)) {
        $where_conditions[] = "(patient_name LIKE :search OR disease LIKE :search OR national_id LIKE :search)";
        $params[':search'] = "%{$search}%";
    }
    
    if (!empty($status_filter)) {
        $where_conditions[] = "status = :status";
        $params[':status'] = $status_filter;
    }
    
    if (!empty($department_filter)) {
        $where_conditions[] = "r.department_id = :department";
        $params[':department'] = $department_filter;
    }
    
    $where_clause = implode(' AND ', $where_conditions);
    
    // الحصول على العدد الإجمالي
    $count_query = "SELECT COUNT(*) as total FROM inpatients i 
                    LEFT JOIN rooms r ON i.room_id = r.id 
                    WHERE {$where_clause}";
    $count_stmt = $db->prepare($count_query);
    $count_stmt->execute($params);
    $total_records = $count_stmt->fetch()['total'];
    $total_pages = ceil($total_records / $per_page);
    
    // الحصول على البيانات
    $query = "SELECT i.*, r.room_number, b.bed_number, d.name as department_name
              FROM inpatients i 
              LEFT JOIN rooms r ON i.room_id = r.id 
              LEFT JOIN beds b ON i.bed_id = b.id 
              LEFT JOIN departments d ON r.department_id = d.id 
              WHERE {$where_clause}
              ORDER BY i.created_at DESC 
              LIMIT :limit OFFSET :offset";
    
    $stmt = $db->prepare($query);
    foreach ($params as $key => $value) {
        $stmt->bindValue($key, $value);
    }
    $stmt->bindValue(':limit', $per_page, PDO::PARAM_INT);
    $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
    $stmt->execute();
    $inpatients = $stmt->fetchAll();
    
    // الحصول على الأقسام للتصفية
    $dept_query = "SELECT id, name FROM departments WHERE is_active = 1 ORDER BY name";
    $dept_stmt = $db->prepare($dept_query);
    $dept_stmt->execute();
    $departments = $dept_stmt->fetchAll();
    
} catch (Exception $e) {
    $inpatients = [];
    $departments = [];
    $total_records = 0;
    $total_pages = 0;
}
?>
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>إدارة المرضى المقيمين - <?php echo APP_NAME; ?></title>
    
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
                            إدارة المرضى المقيمين
                        </h1>
                        <p class="text-muted">إدارة وتتبع المرضى المقيمين في المستشفى</p>
                    </div>
                    
                    <div class="btn-toolbar mb-2 mb-md-0">
                        <div class="btn-group me-2">
                            <a href="add.php" class="btn btn-primary">
                                <i class="bi bi-plus-circle me-1"></i>
                                إضافة مريض جديد
                            </a>
                        </div>
                    </div>
                </div>
                
                <!-- أدوات البحث والتصفية -->
                <div class="row mb-4">
                    <div class="col-12">
                        <div class="table-container">
                            <form method="GET" class="row g-3">
                                <div class="col-md-4">
                                    <label for="search" class="form-label">البحث</label>
                                    <input type="text" class="form-control" id="search" name="search" 
                                           value="<?php echo htmlspecialchars($search); ?>" 
                                           placeholder="اسم المريض، المرض، أو رقم الهوية">
                                </div>
                                
                                <div class="col-md-3">
                                    <label for="status" class="form-label">الحالة</label>
                                    <select class="form-select" id="status" name="status">
                                        <option value="">جميع الحالات</option>
                                        <option value="active" <?php echo $status_filter === 'active' ? 'selected' : ''; ?>>نشط</option>
                                        <option value="discharged" <?php echo $status_filter === 'discharged' ? 'selected' : ''; ?>>مخرج</option>
                                        <option value="transferred" <?php echo $status_filter === 'transferred' ? 'selected' : ''; ?>>محول</option>
                                    </select>
                                </div>
                                
                                <div class="col-md-3">
                                    <label for="department" class="form-label">القسم</label>
                                    <select class="form-select" id="department" name="department">
                                        <option value="">جميع الأقسام</option>
                                        <?php foreach ($departments as $dept): ?>
                                        <option value="<?php echo $dept['id']; ?>" 
                                                <?php echo $department_filter == $dept['id'] ? 'selected' : ''; ?>>
                                            <?php echo htmlspecialchars($dept['name']); ?>
                                        </option>
                                        <?php endforeach; ?>
                                    </select>
                                </div>
                                
                                <div class="col-md-2">
                                    <label class="form-label">&nbsp;</label>
                                    <div class="d-grid">
                                        <button type="submit" class="btn btn-primary">
                                            <i class="bi bi-search me-1"></i>
                                            بحث
                                        </button>
                                    </div>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
                
                <!-- جدول المرضى -->
                <div class="row">
                    <div class="col-12">
                        <div class="table-container">
                            <div class="d-flex justify-content-between align-items-center mb-3">
                                <h5 class="mb-0">
                                    <i class="bi bi-list me-2"></i>
                                    قائمة المرضى المقيمين
                                    <span class="badge bg-primary"><?php echo $total_records; ?></span>
                                </h5>
                                
                                <div class="btn-group btn-group-sm">
                                    <button type="button" class="btn btn-outline-primary" onclick="printTable()">
                                        <i class="bi bi-printer me-1"></i>
                                        طباعة
                                    </button>
                                    <button type="button" class="btn btn-outline-success" onclick="exportToExcel()">
                                        <i class="bi bi-file-earmark-excel me-1"></i>
                                        تصدير
                                    </button>
                                </div>
                            </div>
                            
                            <?php if (!empty($inpatients)): ?>
                            <div class="table-responsive">
                                <table class="table" id="patientsTable">
                                    <thead>
                                        <tr>
                                            <th>اسم المريض</th>
                                            <th>العمر</th>
                                            <th>الجنس</th>
                                            <th>المرض</th>
                                            <th>الغرفة/السرير</th>
                                            <th>القسم</th>
                                            <th>تاريخ الدخول</th>
                                            <th>الحالة</th>
                                            <th>الإجراءات</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <?php foreach ($inpatients as $patient): ?>
                                        <tr>
                                            <td>
                                                <div class="fw-bold"><?php echo htmlspecialchars($patient['patient_name']); ?></div>
                                                <?php if ($patient['phone']): ?>
                                                <small class="text-muted">
                                                    <i class="bi bi-telephone me-1"></i>
                                                    <?php echo htmlspecialchars($patient['phone']); ?>
                                                </small>
                                                <?php endif; ?>
                                            </td>
                                            <td><?php echo $patient['age']; ?> سنة</td>
                                            <td>
                                                <i class="bi bi-<?php echo $patient['gender'] === 'male' ? 'person' : 'person-dress'; ?> me-1"></i>
                                                <?php echo $patient['gender'] === 'male' ? 'ذكر' : 'أنثى'; ?>
                                            </td>
                                            <td>
                                                <span class="badge bg-info">
                                                    <?php echo htmlspecialchars($patient['disease']); ?>
                                                </span>
                                            </td>
                                            <td>
                                                <?php if ($patient['room_number'] && $patient['bed_number']): ?>
                                                <span class="badge bg-secondary">
                                                    <?php echo $patient['room_number'] . ' - ' . $patient['bed_number']; ?>
                                                </span>
                                                <?php else: ?>
                                                <span class="text-muted">غير محدد</span>
                                                <?php endif; ?>
                                            </td>
                                            <td><?php echo htmlspecialchars($patient['department_name'] ?? 'غير محدد'); ?></td>
                                            <td><?php echo date('Y/m/d', strtotime($patient['admission_date'])); ?></td>
                                            <td>
                                                <?php
                                                $status_class = '';
                                                $status_text = '';
                                                switch ($patient['status']) {
                                                    case 'active':
                                                        $status_class = 'bg-success';
                                                        $status_text = 'نشط';
                                                        break;
                                                    case 'discharged':
                                                        $status_class = 'bg-warning';
                                                        $status_text = 'مخرج';
                                                        break;
                                                    case 'transferred':
                                                        $status_class = 'bg-info';
                                                        $status_text = 'محول';
                                                        break;
                                                    default:
                                                        $status_class = 'bg-secondary';
                                                        $status_text = 'غير محدد';
                                                }
                                                ?>
                                                <span class="badge <?php echo $status_class; ?>">
                                                    <?php echo $status_text; ?>
                                                </span>
                                            </td>
                                            <td>
                                                <div class="btn-group btn-group-sm">
                                                    <a href="view.php?id=<?php echo $patient['id']; ?>" 
                                                       class="btn btn-outline-primary" title="عرض">
                                                        <i class="bi bi-eye"></i>
                                                    </a>
                                                    <a href="edit.php?id=<?php echo $patient['id']; ?>" 
                                                       class="btn btn-outline-warning" title="تعديل">
                                                        <i class="bi bi-pencil"></i>
                                                    </a>
                                                    <a href="print.php?id=<?php echo $patient['id']; ?>" 
                                                       class="btn btn-outline-success" title="طباعة" target="_blank">
                                                        <i class="bi bi-printer"></i>
                                                    </a>
                                                    <?php if ($patient['status'] === 'active'): ?>
                                                    <button type="button" class="btn btn-outline-danger" 
                                                            onclick="dischargePatient(<?php echo $patient['id']; ?>)" title="خروج">
                                                        <i class="bi bi-box-arrow-right"></i>
                                                    </button>
                                                    <?php endif; ?>
                                                </div>
                                            </td>
                                        </tr>
                                        <?php endforeach; ?>
                                    </tbody>
                                </table>
                            </div>
                            
                            <!-- التصفح -->
                            <?php if ($total_pages > 1): ?>
                            <nav aria-label="تصفح الصفحات" class="mt-4">
                                <ul class="pagination justify-content-center">
                                    <?php if ($page > 1): ?>
                                    <li class="page-item">
                                        <a class="page-link" href="?page=<?php echo $page - 1; ?>&search=<?php echo urlencode($search); ?>&status=<?php echo urlencode($status_filter); ?>&department=<?php echo urlencode($department_filter); ?>">
                                            السابق
                                        </a>
                                    </li>
                                    <?php endif; ?>
                                    
                                    <?php for ($i = max(1, $page - 2); $i <= min($total_pages, $page + 2); $i++): ?>
                                    <li class="page-item <?php echo $i === $page ? 'active' : ''; ?>">
                                        <a class="page-link" href="?page=<?php echo $i; ?>&search=<?php echo urlencode($search); ?>&status=<?php echo urlencode($status_filter); ?>&department=<?php echo urlencode($department_filter); ?>">
                                            <?php echo $i; ?>
                                        </a>
                                    </li>
                                    <?php endfor; ?>
                                    
                                    <?php if ($page < $total_pages): ?>
                                    <li class="page-item">
                                        <a class="page-link" href="?page=<?php echo $page + 1; ?>&search=<?php echo urlencode($search); ?>&status=<?php echo urlencode($status_filter); ?>&department=<?php echo urlencode($department_filter); ?>">
                                            التالي
                                        </a>
                                    </li>
                                    <?php endif; ?>
                                </ul>
                            </nav>
                            <?php endif; ?>
                            
                            <?php else: ?>
                            <div class="text-center py-5">
                                <i class="bi bi-inbox display-1 text-muted"></i>
                                <h4 class="text-muted mt-3">لا توجد بيانات لعرضها</h4>
                                <p class="text-muted">لم يتم العثور على مرضى مقيمين بالمعايير المحددة</p>
                                <a href="add.php" class="btn btn-primary">
                                    <i class="bi bi-plus-circle me-1"></i>
                                    إضافة مريض جديد
                                </a>
                            </div>
                            <?php endif; ?>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    </div>
    
    <!-- Modal تأكيد الخروج -->
    <div class="modal fade" id="dischargeModal" tabindex="-1">
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">تأكيد خروج المريض</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <p>هل أنت متأكد من رغبتك في تسجيل خروج هذا المريض؟</p>
                    <div class="mb-3">
                        <label for="discharge_date" class="form-label">تاريخ الخروج</label>
                        <input type="date" class="form-control" id="discharge_date" value="<?php echo date('Y-m-d'); ?>">
                    </div>
                    <div class="mb-3">
                        <label for="discharge_notes" class="form-label">ملاحظات الخروج</label>
                        <textarea class="form-control" id="discharge_notes" rows="3"></textarea>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">إلغاء</button>
                    <button type="button" class="btn btn-danger" id="confirmDischarge">تأكيد الخروج</button>
                </div>
            </div>
        </div>
    </div>
    
    <!-- Bootstrap JS -->
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    
    <!-- Custom JS -->
    <script>
        let patientToDischarge = null;
        
        // تسجيل خروج المريض
        function dischargePatient(patientId) {
            patientToDischarge = patientId;
            const modal = new bootstrap.Modal(document.getElementById('dischargeModal'));
            modal.show();
        }
        
        // تأكيد خروج المريض
        document.getElementById('confirmDischarge').addEventListener('click', function() {
            if (!patientToDischarge) return;
            
            const dischargeDate = document.getElementById('discharge_date').value;
            const dischargeNotes = document.getElementById('discharge_notes').value;
            
            const formData = new FormData();
            formData.append('patient_id', patientToDischarge);
            formData.append('discharge_date', dischargeDate);
            formData.append('discharge_notes', dischargeNotes);
            
            fetch('discharge.php', {
                method: 'POST',
                body: formData
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    location.reload();
                } else {
                    alert('حدث خطأ: ' + data.message);
                }
            })
            .catch(error => {
                alert('حدث خطأ في الاتصال');
            });
            
            bootstrap.Modal.getInstance(document.getElementById('dischargeModal')).hide();
        });
        
        // طباعة الجدول
        function printTable() {
            window.print();
        }
        
        // تصدير إلى Excel
        function exportToExcel() {
            const table = document.getElementById('patientsTable');
            const wb = XLSX.utils.table_to_book(table);
            XLSX.writeFile(wb, 'inpatients_' + new Date().toISOString().split('T')[0] + '.xlsx');
        }
        
        // تحديث تلقائي كل 5 دقائق
        setInterval(function() {
            location.reload();
        }, 300000);
    </script>
    
    <!-- SheetJS for Excel export -->
    <script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>
</body>
</html>
<?php
/**
 * إدارة المرضى للمعاينة والكشف - مستشفى الوحدة العلاجي
 * Outpatients Management - Hospital Unity
 */

require_once '../includes/functions.php';

// التحقق من تسجيل الدخول
if (!$hospital->isLoggedIn()) {
    header('Location: ../index.php');
    exit();
}

// الحصول على المرضى للمعاينة
try {
    $db = (new Database())->getConnection();
    
    // إعدادات البحث والتصفية
    $search = $_GET['search'] ?? '';
    $status_filter = $_GET['status'] ?? '';
    $department_filter = $_GET['department'] ?? '';
    $date_filter = $_GET['date'] ?? date('Y-m-d');
    $page = max(1, intval($_GET['page'] ?? 1));
    $per_page = 20;
    $offset = ($page - 1) * $per_page;
    
    // بناء استعلام البحث
    $where_conditions = ["1=1"];
    $params = [];
    
    if (!empty($search)) {
        $where_conditions[] = "(patient_name LIKE :search OR disease LIKE :search OR queue_number LIKE :search)";
        $params[':search'] = "%{$search}%";
    }
    
    if (!empty($status_filter)) {
        $where_conditions[] = "status = :status";
        $params[':status'] = $status_filter;
    }
    
    if (!empty($department_filter)) {
        $where_conditions[] = "department_id = :department";
        $params[':department'] = $department_filter;
    }
    
    if (!empty($date_filter)) {
        $where_conditions[] = "visit_date = :date";
        $params[':date'] = $date_filter;
    }
    
    $where_clause = implode(' AND ', $where_conditions);
    
    // الحصول على العدد الإجمالي
    $count_query = "SELECT COUNT(*) as total FROM outpatients WHERE {$where_clause}";
    $count_stmt = $db->prepare($count_query);
    $count_stmt->execute($params);
    $total_records = $count_stmt->fetch()['total'];
    $total_pages = ceil($total_records / $per_page);
    
    // الحصول على البيانات
    $query = "SELECT o.*, d.name as department_name
              FROM outpatients o 
              LEFT JOIN departments d ON o.department_id = d.id 
              WHERE {$where_clause}
              ORDER BY o.queue_number ASC 
              LIMIT :limit OFFSET :offset";
    
    $stmt = $db->prepare($query);
    foreach ($params as $key => $value) {
        $stmt->bindValue($key, $value);
    }
    $stmt->bindValue(':limit', $per_page, PDO::PARAM_INT);
    $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
    $stmt->execute();
    $outpatients = $stmt->fetchAll();
    
    // الحصول على الأقسام للتصفية
    $dept_query = "SELECT id, name FROM departments WHERE is_active = 1 ORDER BY name";
    $dept_stmt = $db->prepare($dept_query);
    $dept_stmt->execute();
    $departments = $dept_stmt->fetchAll();
    
    // إحصائيات سريعة لليوم
    $stats_query = "SELECT 
                        COUNT(*) as total,
                        SUM(CASE WHEN status = 'waiting' THEN 1 ELSE 0 END) as waiting,
                        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
                        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
                    FROM outpatients WHERE visit_date = :date";
    $stats_stmt = $db->prepare($stats_query);
    $stats_stmt->bindParam(':date', $date_filter);
    $stats_stmt->execute();
    $daily_stats = $stats_stmt->fetch();
    
} catch (Exception $e) {
    $outpatients = [];
    $departments = [];
    $total_records = 0;
    $total_pages = 0;
    $daily_stats = ['total' => 0, 'waiting' => 0, 'in_progress' => 0, 'completed' => 0];
}
?>
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>إدارة المعاينة والكشف - <?php echo APP_NAME; ?></title>
    
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
                            <i class="bi bi-clipboard-check me-2"></i>
                            إدارة المعاينة والكشف
                        </h1>
                        <p class="text-muted">إدارة طوابير المرضى والمعاينات اليومية</p>
                    </div>
                    
                    <div class="btn-toolbar mb-2 mb-md-0">
                        <div class="btn-group me-2">
                            <a href="add.php" class="btn btn-primary">
                                <i class="bi bi-plus-circle me-1"></i>
                                إضافة مريض للطابور
                            </a>
                        </div>
                    </div>
                </div>
                
                <!-- الإحصائيات السريعة -->
                <div class="row mb-4">
                    <div class="col-xl-3 col-md-6 mb-3">
                        <div class="stats-card hover-lift">
                            <div class="stats-icon primary">
                                <i class="bi bi-people"></i>
                            </div>
                            <div class="stats-number"><?php echo $daily_stats['total']; ?></div>
                            <div class="stats-label">إجمالي المرضى اليوم</div>
                        </div>
                    </div>
                    
                    <div class="col-xl-3 col-md-6 mb-3">
                        <div class="stats-card hover-lift">
                            <div class="stats-icon warning">
                                <i class="bi bi-clock"></i>
                            </div>
                            <div class="stats-number"><?php echo $daily_stats['waiting']; ?></div>
                            <div class="stats-label">في الانتظار</div>
                        </div>
                    </div>
                    
                    <div class="col-xl-3 col-md-6 mb-3">
                        <div class="stats-card hover-lift">
                            <div class="stats-icon info">
                                <i class="bi bi-activity"></i>
                            </div>
                            <div class="stats-number"><?php echo $daily_stats['in_progress']; ?></div>
                            <div class="stats-label">قيد الفحص</div>
                        </div>
                    </div>
                    
                    <div class="col-xl-3 col-md-6 mb-3">
                        <div class="stats-card hover-lift">
                            <div class="stats-icon success">
                                <i class="bi bi-check-circle"></i>
                            </div>
                            <div class="stats-number"><?php echo $daily_stats['completed']; ?></div>
                            <div class="stats-label">مكتمل</div>
                        </div>
                    </div>
                </div>
                
                <!-- أدوات البحث والتصفية -->
                <div class="row mb-4">
                    <div class="col-12">
                        <div class="table-container">
                            <form method="GET" class="row g-3">
                                <div class="col-md-3">
                                    <label for="date" class="form-label">التاريخ</label>
                                    <input type="date" class="form-control" id="date" name="date" 
                                           value="<?php echo htmlspecialchars($date_filter); ?>">
                                </div>
                                
                                <div class="col-md-3">
                                    <label for="search" class="form-label">البحث</label>
                                    <input type="text" class="form-control" id="search" name="search" 
                                           value="<?php echo htmlspecialchars($search); ?>" 
                                           placeholder="اسم المريض، المرض، أو رقم الطابور">
                                </div>
                                
                                <div class="col-md-2">
                                    <label for="status" class="form-label">الحالة</label>
                                    <select class="form-select" id="status" name="status">
                                        <option value="">جميع الحالات</option>
                                        <option value="waiting" <?php echo $status_filter === 'waiting' ? 'selected' : ''; ?>>في الانتظار</option>
                                        <option value="in_progress" <?php echo $status_filter === 'in_progress' ? 'selected' : ''; ?>>قيد الفحص</option>
                                        <option value="completed" <?php echo $status_filter === 'completed' ? 'selected' : ''; ?>>مكتمل</option>
                                        <option value="cancelled" <?php echo $status_filter === 'cancelled' ? 'selected' : ''; ?>>ملغي</option>
                                    </select>
                                </div>
                                
                                <div class="col-md-2">
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
                                    <i class="bi bi-list-ol me-2"></i>
                                    طابور المرضى - <?php echo date('Y/m/d', strtotime($date_filter)); ?>
                                    <span class="badge bg-primary"><?php echo $total_records; ?></span>
                                </h5>
                                
                                <div class="btn-group btn-group-sm">
                                    <button type="button" class="btn btn-outline-primary" onclick="printQueue()">
                                        <i class="bi bi-printer me-1"></i>
                                        طباعة الطابور
                                    </button>
                                    <button type="button" class="btn btn-outline-success" onclick="exportToExcel()">
                                        <i class="bi bi-file-earmark-excel me-1"></i>
                                        تصدير
                                    </button>
                                    <button type="button" class="btn btn-outline-info" onclick="refreshQueue()">
                                        <i class="bi bi-arrow-clockwise me-1"></i>
                                        تحديث
                                    </button>
                                </div>
                            </div>
                            
                            <?php if (!empty($outpatients)): ?>
                            <div class="table-responsive">
                                <table class="table" id="queueTable">
                                    <thead>
                                        <tr>
                                            <th>رقم الطابور</th>
                                            <th>اسم المريض</th>
                                            <th>العمر</th>
                                            <th>الجنس</th>
                                            <th>المرض</th>
                                            <th>القسم</th>
                                            <th>الطبيب</th>
                                            <th>وقت الزيارة</th>
                                            <th>الحالة</th>
                                            <th>الإجراءات</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <?php foreach ($outpatients as $patient): ?>
                                        <tr class="<?php echo $patient['status'] === 'in_progress' ? 'table-info' : ''; ?>">
                                            <td>
                                                <span class="badge bg-primary fs-6">
                                                    <?php echo $patient['queue_number']; ?>
                                                </span>
                                            </td>
                                            <td>
                                                <div class="fw-bold"><?php echo htmlspecialchars($patient['patient_name']); ?></div>
                                                <?php if ($patient['phone']): ?>
                                                <small class="text-muted">
                                                    <i class="bi bi-telephone me-1"></i>
                                                    <?php echo htmlspecialchars($patient['phone']); ?>
                                                </small>
                                                <?php endif; ?>
                                            </td>
                                            <td><?php echo $patient['age'] ? $patient['age'] . ' سنة' : '-'; ?></td>
                                            <td>
                                                <?php if ($patient['gender']): ?>
                                                <i class="bi bi-<?php echo $patient['gender'] === 'male' ? 'person' : 'person-dress'; ?> me-1"></i>
                                                <?php echo $patient['gender'] === 'male' ? 'ذكر' : 'أنثى'; ?>
                                                <?php else: ?>
                                                -
                                                <?php endif; ?>
                                            </td>
                                            <td>
                                                <span class="badge bg-info">
                                                    <?php echo htmlspecialchars($patient['disease']); ?>
                                                </span>
                                            </td>
                                            <td><?php echo htmlspecialchars($patient['department_name'] ?? 'غير محدد'); ?></td>
                                            <td><?php echo htmlspecialchars($patient['doctor_name'] ?? '-'); ?></td>
                                            <td><?php echo $patient['visit_time'] ? date('H:i', strtotime($patient['visit_time'])) : '-'; ?></td>
                                            <td>
                                                <?php
                                                $status_class = '';
                                                $status_text = '';
                                                switch ($patient['status']) {
                                                    case 'waiting':
                                                        $status_class = 'bg-warning';
                                                        $status_text = 'في الانتظار';
                                                        break;
                                                    case 'in_progress':
                                                        $status_class = 'bg-info';
                                                        $status_text = 'قيد الفحص';
                                                        break;
                                                    case 'completed':
                                                        $status_class = 'bg-success';
                                                        $status_text = 'مكتمل';
                                                        break;
                                                    case 'cancelled':
                                                        $status_class = 'bg-danger';
                                                        $status_text = 'ملغي';
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
                                                    <a href="print_ticket.php?id=<?php echo $patient['id']; ?>" 
                                                       class="btn btn-outline-success" title="طباعة تذكرة" target="_blank">
                                                        <i class="bi bi-printer"></i>
                                                    </a>
                                                    
                                                    <?php if ($patient['status'] === 'waiting'): ?>
                                                    <button type="button" class="btn btn-outline-info" 
                                                            onclick="startExamination(<?php echo $patient['id']; ?>)" title="بدء الفحص">
                                                        <i class="bi bi-play-circle"></i>
                                                    </button>
                                                    <?php endif; ?>
                                                    
                                                    <?php if ($patient['status'] === 'in_progress'): ?>
                                                    <button type="button" class="btn btn-outline-success" 
                                                            onclick="completeExamination(<?php echo $patient['id']; ?>)" title="إنهاء الفحص">
                                                        <i class="bi bi-check-circle"></i>
                                                    </button>
                                                    <?php endif; ?>
                                                    
                                                    <a href="edit.php?id=<?php echo $patient['id']; ?>" 
                                                       class="btn btn-outline-warning" title="تعديل">
                                                        <i class="bi bi-pencil"></i>
                                                    </a>
                                                    
                                                    <?php if (in_array($patient['status'], ['waiting', 'in_progress'])): ?>
                                                    <button type="button" class="btn btn-outline-danger" 
                                                            onclick="cancelVisit(<?php echo $patient['id']; ?>)" title="إلغاء">
                                                        <i class="bi bi-x-circle"></i>
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
                                        <a class="page-link" href="?page=<?php echo $page - 1; ?>&date=<?php echo urlencode($date_filter); ?>&search=<?php echo urlencode($search); ?>&status=<?php echo urlencode($status_filter); ?>&department=<?php echo urlencode($department_filter); ?>">
                                            السابق
                                        </a>
                                    </li>
                                    <?php endif; ?>
                                    
                                    <?php for ($i = max(1, $page - 2); $i <= min($total_pages, $page + 2); $i++): ?>
                                    <li class="page-item <?php echo $i === $page ? 'active' : ''; ?>">
                                        <a class="page-link" href="?page=<?php echo $i; ?>&date=<?php echo urlencode($date_filter); ?>&search=<?php echo urlencode($search); ?>&status=<?php echo urlencode($status_filter); ?>&department=<?php echo urlencode($department_filter); ?>">
                                            <?php echo $i; ?>
                                        </a>
                                    </li>
                                    <?php endfor; ?>
                                    
                                    <?php if ($page < $total_pages): ?>
                                    <li class="page-item">
                                        <a class="page-link" href="?page=<?php echo $page + 1; ?>&date=<?php echo urlencode($date_filter); ?>&search=<?php echo urlencode($search); ?>&status=<?php echo urlencode($status_filter); ?>&department=<?php echo urlencode($department_filter); ?>">
                                            التالي
                                        </a>
                                    </li>
                                    <?php endif; ?>
                                </ul>
                            </nav>
                            <?php endif; ?>
                            
                            <?php else: ?>
                            <div class="text-center py-5">
                                <i class="bi bi-calendar-x display-1 text-muted"></i>
                                <h4 class="text-muted mt-3">لا توجد مواعيد لهذا اليوم</h4>
                                <p class="text-muted">لم يتم تسجيل أي مرضى للمعاينة في التاريخ المحدد</p>
                                <a href="add.php" class="btn btn-primary">
                                    <i class="bi bi-plus-circle me-1"></i>
                                    إضافة مريض للطابور
                                </a>
                            </div>
                            <?php endif; ?>
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
        // بدء الفحص
        function startExamination(patientId) {
            if (confirm('هل تريد بدء فحص هذا المريض؟')) {
                updatePatientStatus(patientId, 'in_progress');
            }
        }
        
        // إنهاء الفحص
        function completeExamination(patientId) {
            if (confirm('هل تم الانتهاء من فحص هذا المريض؟')) {
                updatePatientStatus(patientId, 'completed');
            }
        }
        
        // إلغاء الزيارة
        function cancelVisit(patientId) {
            if (confirm('هل تريد إلغاء زيارة هذا المريض؟')) {
                updatePatientStatus(patientId, 'cancelled');
            }
        }
        
        // تحديث حالة المريض
        function updatePatientStatus(patientId, status) {
            const formData = new FormData();
            formData.append('patient_id', patientId);
            formData.append('status', status);
            
            fetch('update_status.php', {
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
        }
        
        // طباعة الطابور
        function printQueue() {
            window.open('print_queue.php?date=' + document.getElementById('date').value, '_blank');
        }
        
        // تصدير إلى Excel
        function exportToExcel() {
            const table = document.getElementById('queueTable');
            const wb = XLSX.utils.table_to_book(table);
            XLSX.writeFile(wb, 'queue_' + document.getElementById('date').value + '.xlsx');
        }
        
        // تحديث الطابور
        function refreshQueue() {
            location.reload();
        }
        
        // تحديث تلقائي كل دقيقة
        setInterval(function() {
            // تحديث الإحصائيات فقط بدون إعادة تحميل الصفحة
            fetch('get_stats.php?date=' + document.getElementById('date').value)
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        document.querySelector('.stats-card:nth-child(1) .stats-number').textContent = data.stats.total;
                        document.querySelector('.stats-card:nth-child(2) .stats-number').textContent = data.stats.waiting;
                        document.querySelector('.stats-card:nth-child(3) .stats-number').textContent = data.stats.in_progress;
                        document.querySelector('.stats-card:nth-child(4) .stats-number').textContent = data.stats.completed;
                    }
                })
                .catch(error => {
                    console.error('خطأ في تحديث الإحصائيات:', error);
                });
        }, 60000);
        
        // تحديد تاريخ اليوم كافتراضي
        if (!document.getElementById('date').value) {
            document.getElementById('date').value = new Date().toISOString().split('T')[0];
        }
    </script>
    
    <!-- SheetJS for Excel export -->
    <script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>
</body>
</html>
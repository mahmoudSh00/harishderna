<?php
/**
 * التقارير والإحصائيات - مستشفى الوحدة العلاجي
 * Reports and Statistics - Hospital Unity
 */

require_once '../includes/functions.php';

// التحقق من تسجيل الدخول
if (!$hospital->isLoggedIn()) {
    header('Location: ../index.php');
    exit();
}

$db = (new Database())->getConnection();

// تحديد الفترة الزمنية
$date_from = $_GET['date_from'] ?? date('Y-m-01'); // بداية الشهر الحالي
$date_to = $_GET['date_to'] ?? date('Y-m-d'); // اليوم الحالي
$report_type = $_GET['report_type'] ?? 'overview';

// الحصول على الإحصائيات
try {
    // إحصائيات عامة
    $stats = [];
    
    // المرضى المقيمين
    $query = "SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN gender = 'male' THEN 1 ELSE 0 END) as male,
                SUM(CASE WHEN gender = 'female' THEN 1 ELSE 0 END) as female,
                SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
                SUM(CASE WHEN status = 'discharged' THEN 1 ELSE 0 END) as discharged
              FROM inpatients 
              WHERE admission_date BETWEEN :date_from AND :date_to";
    $stmt = $db->prepare($query);
    $stmt->bindParam(':date_from', $date_from);
    $stmt->bindParam(':date_to', $date_to);
    $stmt->execute();
    $stats['inpatients'] = $stmt->fetch();
    
    // المرضى المراجعين
    $query = "SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN gender = 'male' THEN 1 ELSE 0 END) as male,
                SUM(CASE WHEN gender = 'female' THEN 1 ELSE 0 END) as female,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
                SUM(CASE WHEN status = 'waiting' THEN 1 ELSE 0 END) as waiting
              FROM outpatients 
              WHERE visit_date BETWEEN :date_from AND :date_to";
    $stmt = $db->prepare($query);
    $stmt->bindParam(':date_from', $date_from);
    $stmt->bindParam(':date_to', $date_to);
    $stmt->execute();
    $stats['outpatients'] = $stmt->fetch();
    
    // إحصائيات الأقسام
    $query = "SELECT 
                d.name,
                COUNT(DISTINCT i.id) as inpatients_count,
                COUNT(DISTINCT o.id) as outpatients_count
              FROM departments d
              LEFT JOIN inpatients i ON d.name = i.department AND i.admission_date BETWEEN :date_from AND :date_to
              LEFT JOIN outpatients o ON d.name = o.department AND o.visit_date BETWEEN :date_from AND :date_to
              WHERE d.is_active = 1
              GROUP BY d.id, d.name
              ORDER BY (COUNT(DISTINCT i.id) + COUNT(DISTINCT o.id)) DESC";
    $stmt = $db->prepare($query);
    $stmt->bindParam(':date_from', $date_from);
    $stmt->bindParam(':date_to', $date_to);
    $stmt->execute();
    $departments_stats = $stmt->fetchAll();
    
    // إحصائيات يومية للشهر الحالي
    $query = "SELECT 
                DATE(admission_date) as date,
                COUNT(*) as inpatients_count
              FROM inpatients 
              WHERE admission_date BETWEEN :date_from AND :date_to
              GROUP BY DATE(admission_date)
              ORDER BY date";
    $stmt = $db->prepare($query);
    $stmt->bindParam(':date_from', $date_from);
    $stmt->bindParam(':date_to', $date_to);
    $stmt->execute();
    $daily_inpatients = $stmt->fetchAll();
    
    $query = "SELECT 
                visit_date as date,
                COUNT(*) as outpatients_count
              FROM outpatients 
              WHERE visit_date BETWEEN :date_from AND :date_to
              GROUP BY visit_date
              ORDER BY date";
    $stmt = $db->prepare($query);
    $stmt->bindParam(':date_from', $date_from);
    $stmt->bindParam(':date_to', $date_to);
    $stmt->execute();
    $daily_outpatients = $stmt->fetchAll();
    
    // دمج البيانات اليومية
    $daily_stats = [];
    foreach ($daily_inpatients as $day) {
        $daily_stats[$day['date']]['inpatients'] = $day['inpatients_count'];
    }
    foreach ($daily_outpatients as $day) {
        $daily_stats[$day['date']]['outpatients'] = $day['outpatients_count'];
    }
    
} catch (Exception $e) {
    $stats = ['inpatients' => [], 'outpatients' => []];
    $departments_stats = [];
    $daily_stats = [];
}
?>

<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>التقارير والإحصائيات - <?php echo APP_NAME; ?></title>
    
    <!-- Bootstrap CSS -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.0/font/bootstrap-icons.css" rel="stylesheet">
    
    <!-- Chart.js -->
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    
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
                            <a class="nav-link active" href="index.php">
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
                        <h1 class="h2">التقارير والإحصائيات</h1>
                        <p class="text-muted">تقارير شاملة عن أداء المستشفى</p>
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
                
                <!-- فلاتر التقارير -->
                <div class="form-container mb-4">
                    <form method="GET" class="row g-3">
                        <div class="col-md-3">
                            <label for="date_from" class="form-label">من تاريخ</label>
                            <input type="date" class="form-control" id="date_from" name="date_from" value="<?php echo $date_from; ?>">
                        </div>
                        <div class="col-md-3">
                            <label for="date_to" class="form-label">إلى تاريخ</label>
                            <input type="date" class="form-control" id="date_to" name="date_to" value="<?php echo $date_to; ?>">
                        </div>
                        <div class="col-md-3">
                            <label for="report_type" class="form-label">نوع التقرير</label>
                            <select class="form-select" id="report_type" name="report_type">
                                <option value="overview" <?php echo $report_type == 'overview' ? 'selected' : ''; ?>>نظرة عامة</option>
                                <option value="inpatients" <?php echo $report_type == 'inpatients' ? 'selected' : ''; ?>>المرضى المقيمين</option>
                                <option value="outpatients" <?php echo $report_type == 'outpatients' ? 'selected' : ''; ?>>المرضى المراجعين</option>
                                <option value="departments" <?php echo $report_type == 'departments' ? 'selected' : ''; ?>>الأقسام</option>
                            </select>
                        </div>
                        <div class="col-md-3">
                            <label class="form-label">&nbsp;</label>
                            <div class="d-grid">
                                <button type="submit" class="btn btn-primary">
                                    <i class="bi bi-search me-2"></i>
                                    عرض التقرير
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
                
                <!-- الإحصائيات السريعة -->
                <div class="row mb-4">
                    <div class="col-xl-3 col-md-6 mb-4">
                        <div class="stats-card hover-lift">
                            <div class="stats-icon primary">
                                <i class="bi bi-person-plus"></i>
                            </div>
                            <div class="stats-number"><?php echo $stats['inpatients']['total'] ?? 0; ?></div>
                            <div class="stats-label">إجمالي المرضى المقيمين</div>
                            <div class="small text-muted mt-2">
                                ذكور: <?php echo $stats['inpatients']['male'] ?? 0; ?> | 
                                إناث: <?php echo $stats['inpatients']['female'] ?? 0; ?>
                            </div>
                        </div>
                    </div>
                    
                    <div class="col-xl-3 col-md-6 mb-4">
                        <div class="stats-card hover-lift">
                            <div class="stats-icon success">
                                <i class="bi bi-clipboard-check"></i>
                            </div>
                            <div class="stats-number"><?php echo $stats['outpatients']['total'] ?? 0; ?></div>
                            <div class="stats-label">إجمالي المراجعين</div>
                            <div class="small text-muted mt-2">
                                مكتملة: <?php echo $stats['outpatients']['completed'] ?? 0; ?> | 
                                في الانتظار: <?php echo $stats['outpatients']['waiting'] ?? 0; ?>
                            </div>
                        </div>
                    </div>
                    
                    <div class="col-xl-3 col-md-6 mb-4">
                        <div class="stats-card hover-lift">
                            <div class="stats-icon warning">
                                <i class="bi bi-bed"></i>
                            </div>
                            <div class="stats-number"><?php echo $stats['inpatients']['active'] ?? 0; ?></div>
                            <div class="stats-label">مرضى نشطين حالياً</div>
                            <div class="small text-muted mt-2">
                                تم الخروج: <?php echo $stats['inpatients']['discharged'] ?? 0; ?>
                            </div>
                        </div>
                    </div>
                    
                    <div class="col-xl-3 col-md-6 mb-4">
                        <div class="stats-card hover-lift">
                            <div class="stats-icon info">
                                <i class="bi bi-calendar-range"></i>
                            </div>
                            <div class="stats-number"><?php echo count($daily_stats); ?></div>
                            <div class="stats-label">أيام النشاط</div>
                            <div class="small text-muted mt-2">
                                الفترة: <?php echo date('d/m', strtotime($date_from)) . ' - ' . date('d/m', strtotime($date_to)); ?>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- الرسوم البيانية -->
                <div class="row mb-4">
                    <!-- الرسم البياني اليومي -->
                    <div class="col-lg-8 mb-4">
                        <div class="chart-container">
                            <h5 class="mb-3">
                                <i class="bi bi-bar-chart me-2"></i>
                                الإحصائيات اليومية
                            </h5>
                            <canvas id="dailyChart" height="100"></canvas>
                        </div>
                    </div>
                    
                    <!-- توزيع المرضى حسب الجنس -->
                    <div class="col-lg-4 mb-4">
                        <div class="chart-container">
                            <h5 class="mb-3">
                                <i class="bi bi-pie-chart me-2"></i>
                                توزيع المرضى حسب الجنس
                            </h5>
                            <canvas id="genderChart" height="200"></canvas>
                        </div>
                    </div>
                </div>
                
                <!-- إحصائيات الأقسام -->
                <div class="row mb-4">
                    <div class="col-12">
                        <div class="table-container">
                            <h5 class="mb-3">
                                <i class="bi bi-building me-2"></i>
                                إحصائيات الأقسام
                            </h5>
                            
                            <div class="table-responsive">
                                <table class="table">
                                    <thead>
                                        <tr>
                                            <th>اسم القسم</th>
                                            <th>المرضى المقيمين</th>
                                            <th>المراجعين</th>
                                            <th>الإجمالي</th>
                                            <th>النسبة المئوية</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <?php 
                                        $total_patients = array_sum(array_column($departments_stats, 'inpatients_count')) + 
                                                         array_sum(array_column($departments_stats, 'outpatients_count'));
                                        
                                        foreach ($departments_stats as $dept): 
                                            $dept_total = $dept['inpatients_count'] + $dept['outpatients_count'];
                                            $percentage = $total_patients > 0 ? round(($dept_total / $total_patients) * 100, 1) : 0;
                                        ?>
                                        <tr>
                                            <td><strong><?php echo htmlspecialchars($dept['name']); ?></strong></td>
                                            <td>
                                                <span class="badge bg-primary"><?php echo $dept['inpatients_count']; ?></span>
                                            </td>
                                            <td>
                                                <span class="badge bg-success"><?php echo $dept['outpatients_count']; ?></span>
                                            </td>
                                            <td>
                                                <strong><?php echo $dept_total; ?></strong>
                                            </td>
                                            <td>
                                                <div class="progress" style="height: 20px;">
                                                    <div class="progress-bar" role="progressbar" style="width: <?php echo $percentage; ?>%">
                                                        <?php echo $percentage; ?>%
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                        <?php endforeach; ?>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- أزرار الطباعة والتصدير -->
                <div class="row">
                    <div class="col-12 text-center">
                        <button type="button" class="btn btn-primary me-2" onclick="window.print()">
                            <i class="bi bi-printer me-2"></i>
                            طباعة التقرير
                        </button>
                        <button type="button" class="btn btn-success" onclick="exportToExcel()">
                            <i class="bi bi-file-earmark-excel me-2"></i>
                            تصدير إلى Excel
                        </button>
                    </div>
                </div>
            </main>
        </div>
    </div>
    
    <!-- Bootstrap JS -->
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    
    <script>
        // بيانات الرسوم البيانية
        const dailyData = <?php echo json_encode($daily_stats); ?>;
        const genderData = {
            male: <?php echo ($stats['inpatients']['male'] ?? 0) + ($stats['outpatients']['male'] ?? 0); ?>,
            female: <?php echo ($stats['inpatients']['female'] ?? 0) + ($stats['outpatients']['female'] ?? 0); ?>
        };
        
        // الرسم البياني اليومي
        const dailyCtx = document.getElementById('dailyChart').getContext('2d');
        const dates = Object.keys(dailyData);
        const inpatientsData = dates.map(date => dailyData[date].inpatients || 0);
        const outpatientsData = dates.map(date => dailyData[date].outpatients || 0);
        
        new Chart(dailyCtx, {
            type: 'line',
            data: {
                labels: dates.map(date => new Date(date).toLocaleDateString('ar-EG')),
                datasets: [{
                    label: 'المرضى المقيمين',
                    data: inpatientsData,
                    borderColor: 'rgb(102, 126, 234)',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    tension: 0.4
                }, {
                    label: 'المراجعين',
                    data: outpatientsData,
                    borderColor: 'rgb(86, 171, 47)',
                    backgroundColor: 'rgba(86, 171, 47, 0.1)',
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
        
        // الرسم البياني للجنس
        const genderCtx = document.getElementById('genderChart').getContext('2d');
        new Chart(genderCtx, {
            type: 'doughnut',
            data: {
                labels: ['ذكور', 'إناث'],
                datasets: [{
                    data: [genderData.male, genderData.female],
                    backgroundColor: [
                        'rgba(102, 126, 234, 0.8)',
                        'rgba(240, 147, 251, 0.8)'
                    ],
                    borderColor: [
                        'rgb(102, 126, 234)',
                        'rgb(240, 147, 251)'
                    ],
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                    }
                }
            }
        });
        
        // تصدير إلى Excel (مبسط)
        function exportToExcel() {
            alert('ميزة التصدير إلى Excel ستكون متاحة قريباً');
        }
    </script>
</body>
</html>
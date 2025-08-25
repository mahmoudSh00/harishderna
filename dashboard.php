<?php
/**
 * لوحة التحكم الرئيسية - مستشفى الوحدة العلاجي
 * Main Dashboard - Hospital Unity
 */

require_once 'includes/functions.php';

// التحقق من تسجيل الدخول
if (!$hospital->isLoggedIn()) {
    header('Location: index.php');
    exit();
}

// الحصول على الإحصائيات
$stats = $hospital->getPatientStatistics();
$today = date('Y-m-d');

// الحصول على المرضى الجدد اليوم
try {
    $db = (new Database())->getConnection();
    
    // المرضى المقيمين الجدد اليوم
    $query = "SELECT COUNT(*) as count FROM inpatients WHERE DATE(admission_date) = :today";
    $stmt = $db->prepare($query);
    $stmt->bindParam(':today', $today);
    $stmt->execute();
    $new_inpatients_today = $stmt->fetch()['count'];
    
    // المرضى المراجعين اليوم
    $query = "SELECT COUNT(*) as count FROM outpatients WHERE DATE(visit_date) = :today";
    $stmt = $db->prepare($query);
    $stmt->bindParam(':today', $today);
    $stmt->execute();
    $outpatients_today = $stmt->fetch()['count'];
    
    // الأسرة المتاحة
    $query = "SELECT COUNT(*) as count FROM beds WHERE is_occupied = 0";
    $stmt = $db->prepare($query);
    $stmt->execute();
    $available_beds = $stmt->fetch()['count'];
    
    // آخر المرضى المسجلين
    $query = "SELECT patient_name, admission_date, disease FROM inpatients 
              WHERE status = 'active' ORDER BY created_at DESC LIMIT 5";
    $stmt = $db->prepare($query);
    $stmt->execute();
    $recent_inpatients = $stmt->fetchAll();
    
    // طابور اليوم
    $query = "SELECT patient_name, queue_number, status FROM outpatients 
              WHERE visit_date = :today ORDER BY queue_number ASC LIMIT 10";
    $stmt = $db->prepare($query);
    $stmt->bindParam(':today', $today);
    $stmt->execute();
    $today_queue = $stmt->fetchAll();
    
} catch (Exception $e) {
    $new_inpatients_today = 0;
    $outpatients_today = 0;
    $available_beds = 0;
    $recent_inpatients = [];
    $today_queue = [];
}
?>
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>لوحة التحكم - <?php echo APP_NAME; ?></title>
    
    <!-- Bootstrap CSS -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.0/font/bootstrap-icons.css" rel="stylesheet">
    
    <!-- Chart.js -->
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    
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
                            <a class="nav-link active" href="dashboard.php">
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
                            <a class="nav-link" href="backup.php">
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
                        <h1 class="h2">لوحة التحكم</h1>
                        <p class="text-muted">مرحباً بك في نظام إدارة <?php echo APP_NAME; ?></p>
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
                
                <!-- الإحصائيات السريعة -->
                <div class="row mb-4">
                    <div class="col-xl-3 col-md-6 mb-4">
                        <div class="stats-card hover-lift">
                            <div class="stats-icon primary">
                                <i class="bi bi-person-plus"></i>
                            </div>
                            <div class="stats-number"><?php echo $new_inpatients_today; ?></div>
                            <div class="stats-label">مرضى جدد اليوم</div>
                        </div>
                    </div>
                    
                    <div class="col-xl-3 col-md-6 mb-4">
                        <div class="stats-card hover-lift">
                            <div class="stats-icon success">
                                <i class="bi bi-clipboard-check"></i>
                            </div>
                            <div class="stats-number"><?php echo $outpatients_today; ?></div>
                            <div class="stats-label">مراجعين اليوم</div>
                        </div>
                    </div>
                    
                    <div class="col-xl-3 col-md-6 mb-4">
                        <div class="stats-card hover-lift">
                            <div class="stats-icon warning">
                                <i class="bi bi-bed"></i>
                            </div>
                            <div class="stats-number"><?php echo $available_beds; ?></div>
                            <div class="stats-label">أسرة متاحة</div>
                        </div>
                    </div>
                    
                    <div class="col-xl-3 col-md-6 mb-4">
                        <div class="stats-card hover-lift">
                            <div class="stats-icon info">
                                <i class="bi bi-people"></i>
                            </div>
                            <div class="stats-number"><?php echo ($stats['inpatients']['active_inpatients'] ?? 0); ?></div>
                            <div class="stats-label">مرضى مقيمين</div>
                        </div>
                    </div>
                </div>
                
                <!-- الرسوم البيانية والجداول -->
                <div class="row">
                    <!-- الرسم البياني للإحصائيات -->
                    <div class="col-lg-8 mb-4">
                        <div class="chart-container">
                            <h5 class="mb-3">
                                <i class="bi bi-bar-chart me-2"></i>
                                إحصائيات المرضى الشهرية
                            </h5>
                            <canvas id="monthlyChart" height="100"></canvas>
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
                
                <div class="row">
                    <!-- آخر المرضى المسجلين -->
                    <div class="col-lg-6 mb-4">
                        <div class="table-container">
                            <h5 class="mb-3">
                                <i class="bi bi-clock-history me-2"></i>
                                آخر المرضى المسجلين
                            </h5>
                            
                            <?php if (!empty($recent_inpatients)): ?>
                            <div class="table-responsive">
                                <table class="table">
                                    <thead>
                                        <tr>
                                            <th>اسم المريض</th>
                                            <th>تاريخ الدخول</th>
                                            <th>المرض</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <?php foreach ($recent_inpatients as $patient): ?>
                                        <tr>
                                            <td><?php echo htmlspecialchars($patient['patient_name']); ?></td>
                                            <td><?php echo date('Y/m/d', strtotime($patient['admission_date'])); ?></td>
                                            <td>
                                                <span class="badge bg-info">
                                                    <?php echo htmlspecialchars($patient['disease']); ?>
                                                </span>
                                            </td>
                                        </tr>
                                        <?php endforeach; ?>
                                    </tbody>
                                </table>
                            </div>
                            <?php else: ?>
                            <div class="text-center py-4">
                                <i class="bi bi-inbox display-4 text-muted"></i>
                                <p class="text-muted mt-2">لا توجد بيانات لعرضها</p>
                            </div>
                            <?php endif; ?>
                            
                            <div class="text-center mt-3">
                                <a href="inpatients/" class="btn btn-primary btn-sm">
                                    <i class="bi bi-eye me-1"></i>
                                    عرض الكل
                                </a>
                            </div>
                        </div>
                    </div>
                    
                    <!-- طابور اليوم -->
                    <div class="col-lg-6 mb-4">
                        <div class="table-container">
                            <h5 class="mb-3">
                                <i class="bi bi-list-ol me-2"></i>
                                طابور اليوم
                            </h5>
                            
                            <?php if (!empty($today_queue)): ?>
                            <div class="table-responsive">
                                <table class="table">
                                    <thead>
                                        <tr>
                                            <th>رقم الطابور</th>
                                            <th>اسم المريض</th>
                                            <th>الحالة</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <?php foreach ($today_queue as $patient): ?>
                                        <tr>
                                            <td>
                                                <span class="badge bg-primary">
                                                    <?php echo $patient['queue_number']; ?>
                                                </span>
                                            </td>
                                            <td><?php echo htmlspecialchars($patient['patient_name']); ?></td>
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
                                                    default:
                                                        $status_class = 'bg-secondary';
                                                        $status_text = 'غير محدد';
                                                }
                                                ?>
                                                <span class="badge <?php echo $status_class; ?>">
                                                    <?php echo $status_text; ?>
                                                </span>
                                            </td>
                                        </tr>
                                        <?php endforeach; ?>
                                    </tbody>
                                </table>
                            </div>
                            <?php else: ?>
                            <div class="text-center py-4">
                                <i class="bi bi-calendar-x display-4 text-muted"></i>
                                <p class="text-muted mt-2">لا يوجد مرضى في الطابور اليوم</p>
                            </div>
                            <?php endif; ?>
                            
                            <div class="text-center mt-3">
                                <a href="outpatients/" class="btn btn-success btn-sm">
                                    <i class="bi bi-plus-circle me-1"></i>
                                    إضافة مريض جديد
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- روابط سريعة -->
                <div class="row mb-4">
                    <div class="col-12">
                        <div class="table-container">
                            <h5 class="mb-3">
                                <i class="bi bi-lightning me-2"></i>
                                روابط سريعة
                            </h5>
                            
                            <div class="row">
                                <div class="col-md-3 mb-3">
                                    <a href="inpatients/add.php" class="btn btn-primary w-100 hover-lift">
                                        <i class="bi bi-person-plus-fill d-block mb-2" style="font-size: 2rem;"></i>
                                        إضافة مريض مقيم
                                    </a>
                                </div>
                                <div class="col-md-3 mb-3">
                                    <a href="outpatients/add.php" class="btn btn-success w-100 hover-lift">
                                        <i class="bi bi-clipboard-plus d-block mb-2" style="font-size: 2rem;"></i>
                                        إضافة مريض للمعاينة
                                    </a>
                                </div>
                                <div class="col-md-3 mb-3">
                                    <a href="reports/" class="btn btn-info w-100 hover-lift">
                                        <i class="bi bi-graph-up d-block mb-2" style="font-size: 2rem;"></i>
                                        عرض التقارير
                                    </a>
                                </div>
                                <div class="col-md-3 mb-3">
                                    <a href="settings/" class="btn btn-warning w-100 hover-lift">
                                        <i class="bi bi-gear-fill d-block mb-2" style="font-size: 2rem;"></i>
                                        إعدادات النظام
                                    </a>
                                </div>
                            </div>
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
        // الرسم البياني الشهري
        const monthlyCtx = document.getElementById('monthlyChart').getContext('2d');
        const monthlyChart = new Chart(monthlyCtx, {
            type: 'line',
            data: {
                labels: ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو'],
                datasets: [{
                    label: 'مرضى مقيمين',
                    data: [12, 19, 15, 25, 22, 30],
                    borderColor: 'rgb(102, 126, 234)',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    tension: 0.4
                }, {
                    label: 'مرضى مراجعين',
                    data: [45, 52, 48, 61, 58, 67],
                    borderColor: 'rgb(86, 171, 47)',
                    backgroundColor: 'rgba(86, 171, 47, 0.1)',
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
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
        const genderChart = new Chart(genderCtx, {
            type: 'doughnut',
            data: {
                labels: ['ذكور', 'إناث'],
                datasets: [{
                    data: [
                        <?php echo ($stats['inpatients']['male_inpatients'] ?? 0) + ($stats['outpatients']['male_outpatients'] ?? 0); ?>,
                        <?php echo ($stats['inpatients']['female_inpatients'] ?? 0) + ($stats['outpatients']['female_outpatients'] ?? 0); ?>
                    ],
                    backgroundColor: [
                        'rgba(102, 126, 234, 0.8)',
                        'rgba(240, 147, 251, 0.8)'
                    ],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                    }
                }
            }
        });
        
        // تحديث الوقت كل ثانية
        function updateTime() {
            const now = new Date();
            const timeString = now.toLocaleString('ar-IQ', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
            
            // يمكن إضافة عنصر لعرض الوقت إذا لزم الأمر
        }
        
        setInterval(updateTime, 1000);
        updateTime();
        
        // تأثيرات الحركة عند التحميل
        document.addEventListener('DOMContentLoaded', function() {
            const cards = document.querySelectorAll('.stats-card, .table-container, .chart-container');
            cards.forEach((card, index) => {
                card.style.opacity = '0';
                card.style.transform = 'translateY(20px)';
                
                setTimeout(() => {
                    card.style.transition = 'all 0.5s ease';
                    card.style.opacity = '1';
                    card.style.transform = 'translateY(0)';
                }, index * 100);
            });
        });
    </script>
</body>
</html>
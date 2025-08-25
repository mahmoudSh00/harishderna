<?php
/**
 * طباعة تذكرة المريض - مستشفى الوحدة العلاجي
 * Print Patient Ticket - Hospital Unity
 */

require_once '../includes/functions.php';

// التحقق من تسجيل الدخول
if (!$hospital->isLoggedIn()) {
    header('Location: ../index.php');
    exit();
}

// التحقق من وجود معرف المريض
if (empty($_GET['id'])) {
    header('Location: index.php');
    exit();
}

$patient_id = intval($_GET['id']);

try {
    $db = (new Database())->getConnection();
    
    // الحصول على بيانات المريض
    $query = "SELECT o.*, d.name as department_name, u.full_name as created_by_name
              FROM outpatients o 
              LEFT JOIN departments d ON o.department_id = d.id 
              LEFT JOIN users u ON o.created_by = u.id
              WHERE o.id = :id";
    
    $stmt = $db->prepare($query);
    $stmt->bindParam(':id', $patient_id);
    $stmt->execute();
    
    $patient = $stmt->fetch();
    
    if (!$patient) {
        header('Location: index.php?message=' . urlencode('المريض غير موجود') . '&type=danger');
        exit();
    }
    
} catch (Exception $e) {
    header('Location: index.php?message=' . urlencode('حدث خطأ في جلب البيانات') . '&type=danger');
    exit();
}

// تحويل التاريخ إلى العربية
$arabic_date = date('Y/m/d', strtotime($patient['visit_date']));
$arabic_time = $patient['visit_time'] ? date('H:i', strtotime($patient['visit_time'])) : '';

// تحويل الجنس إلى العربية
$gender_arabic = '';
if ($patient['gender'] === 'male') {
    $gender_arabic = 'ذكر';
} elseif ($patient['gender'] === 'female') {
    $gender_arabic = 'أنثى';
}
?>
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>تذكرة المريض - <?php echo APP_NAME; ?></title>
    
    <!-- Bootstrap CSS -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.0/font/bootstrap-icons.css" rel="stylesheet">
    
    <!-- Google Fonts -->
    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700&display=swap" rel="stylesheet">
    
    <style>
        body {
            font-family: 'Cairo', sans-serif;
            background: #f8f9fa;
        }
        
        .ticket {
            background: white;
            border-radius: 15px;
            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
            max-width: 400px;
            margin: 20px auto;
            overflow: hidden;
        }
        
        .ticket-header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            text-align: center;
        }
        
        .ticket-body {
            padding: 25px;
        }
        
        .queue-number {
            font-size: 4rem;
            font-weight: bold;
            color: #667eea;
            text-align: center;
            margin: 20px 0;
            text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.1);
        }
        
        .patient-info {
            border-top: 2px dashed #e9ecef;
            padding-top: 20px;
            margin-top: 20px;
        }
        
        .info-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
            padding: 8px 0;
            border-bottom: 1px solid #f1f3f4;
        }
        
        .info-label {
            font-weight: 600;
            color: #666;
        }
        
        .info-value {
            color: #333;
        }
        
        .ticket-footer {
            background: #f8f9fa;
            padding: 15px 25px;
            text-align: center;
            font-size: 0.9rem;
            color: #666;
        }
        
        .print-btn {
            position: fixed;
            top: 20px;
            left: 20px;
            z-index: 1000;
        }
        
        @media print {
            body {
                background: white !important;
                margin: 0;
                padding: 0;
            }
            
            .ticket {
                box-shadow: none;
                margin: 0;
                max-width: none;
                width: 100%;
            }
            
            .print-btn {
                display: none !important;
            }
            
            .no-print {
                display: none !important;
            }
        }
        
        @media (max-width: 576px) {
            .ticket {
                margin: 10px;
                max-width: none;
            }
            
            .queue-number {
                font-size: 3rem;
            }
        }
    </style>
</head>
<body>
    <!-- زر الطباعة -->
    <button class="btn btn-primary print-btn no-print" onclick="window.print()">
        <i class="bi bi-printer me-2"></i>
        طباعة
    </button>
    
    <!-- التذكرة -->
    <div class="ticket">
        <!-- رأس التذكرة -->
        <div class="ticket-header">
            <i class="bi bi-hospital display-4 mb-2"></i>
            <h3 class="mb-1"><?php echo APP_NAME; ?></h3>
            <p class="mb-0">تذكرة المعاينة</p>
        </div>
        
        <!-- جسم التذكرة -->
        <div class="ticket-body">
            <!-- رقم الطابور -->
            <div class="text-center">
                <div class="queue-number"><?php echo $patient['queue_number']; ?></div>
                <h5 class="text-primary mb-3">رقم الطابور</h5>
            </div>
            
            <!-- معلومات المريض -->
            <div class="patient-info">
                <div class="info-row">
                    <span class="info-label">
                        <i class="bi bi-person me-1"></i>
                        اسم المريض:
                    </span>
                    <span class="info-value"><?php echo htmlspecialchars($patient['patient_name']); ?></span>
                </div>
                
                <?php if ($patient['age']): ?>
                <div class="info-row">
                    <span class="info-label">
                        <i class="bi bi-calendar me-1"></i>
                        العمر:
                    </span>
                    <span class="info-value"><?php echo $patient['age']; ?> سنة</span>
                </div>
                <?php endif; ?>
                
                <?php if ($gender_arabic): ?>
                <div class="info-row">
                    <span class="info-label">
                        <i class="bi bi-<?php echo $patient['gender'] === 'male' ? 'person' : 'person-dress'; ?> me-1"></i>
                        الجنس:
                    </span>
                    <span class="info-value"><?php echo $gender_arabic; ?></span>
                </div>
                <?php endif; ?>
                
                <div class="info-row">
                    <span class="info-label">
                        <i class="bi bi-heart-pulse me-1"></i>
                        سبب الزيارة:
                    </span>
                    <span class="info-value"><?php echo htmlspecialchars($patient['disease']); ?></span>
                </div>
                
                <div class="info-row">
                    <span class="info-label">
                        <i class="bi bi-calendar-check me-1"></i>
                        تاريخ الزيارة:
                    </span>
                    <span class="info-value"><?php echo $arabic_date; ?></span>
                </div>
                
                <?php if ($arabic_time): ?>
                <div class="info-row">
                    <span class="info-label">
                        <i class="bi bi-clock me-1"></i>
                        الوقت المفضل:
                    </span>
                    <span class="info-value"><?php echo $arabic_time; ?></span>
                </div>
                <?php endif; ?>
                
                <?php if ($patient['department_name']): ?>
                <div class="info-row">
                    <span class="info-label">
                        <i class="bi bi-building me-1"></i>
                        القسم:
                    </span>
                    <span class="info-value"><?php echo htmlspecialchars($patient['department_name']); ?></span>
                </div>
                <?php endif; ?>
                
                <?php if ($patient['doctor_name']): ?>
                <div class="info-row">
                    <span class="info-label">
                        <i class="bi bi-person-badge me-1"></i>
                        الطبيب:
                    </span>
                    <span class="info-value"><?php echo htmlspecialchars($patient['doctor_name']); ?></span>
                </div>
                <?php endif; ?>
            </div>
        </div>
        
        <!-- تذييل التذكرة -->
        <div class="ticket-footer">
            <p class="mb-1">
                <i class="bi bi-info-circle me-1"></i>
                يرجى الاحتفاظ بهذه التذكرة حتى انتهاء المعاينة
            </p>
            <small class="text-muted">
                تم الإصدار: <?php echo date('Y/m/d H:i'); ?> - 
                بواسطة: <?php echo htmlspecialchars($patient['created_by_name'] ?? 'النظام'); ?>
            </small>
        </div>
    </div>
    
    <!-- معلومات إضافية للطباعة -->
    <div class="text-center mt-4 no-print">
        <div class="btn-group">
            <a href="index.php" class="btn btn-outline-secondary">
                <i class="bi bi-arrow-right me-1"></i>
                العودة للطابور
            </a>
            <a href="add.php" class="btn btn-outline-primary">
                <i class="bi bi-plus-circle me-1"></i>
                إضافة مريض آخر
            </a>
            <button class="btn btn-primary" onclick="window.print()">
                <i class="bi bi-printer me-1"></i>
                طباعة مرة أخرى
            </button>
        </div>
    </div>
    
    <!-- معلومات المستشفى للطباعة -->
    <div class="text-center mt-4 d-none d-print-block">
        <hr>
        <p class="mb-1">
            <strong><?php echo PRINT_HEADER; ?></strong>
        </p>
        <p class="mb-1"><?php echo PRINT_ADDRESS; ?></p>
        <p class="mb-0"><?php echo PRINT_PHONE; ?></p>
    </div>
    
    <!-- Bootstrap JS -->
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    
    <script>
        // طباعة تلقائية عند تحميل الصفحة (اختياري)
        // window.addEventListener('load', function() {
        //     setTimeout(function() {
        //         window.print();
        //     }, 1000);
        // });
        
        // إغلاق النافذة بعد الطباعة
        window.addEventListener('afterprint', function() {
            // يمكن إضافة إجراءات إضافية هنا
        });
    </script>
</body>
</html>
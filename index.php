<?php
/**
 * الصفحة الرئيسية - مستشفى الوحدة العلاجي
 * Main Page - Hospital Unity
 */

require_once 'includes/functions.php';

// إعادة توجيه إلى لوحة التحكم إذا كان المستخدم مسجل دخول
if ($hospital->isLoggedIn()) {
    header('Location: dashboard.php');
    exit();
}
?>
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?php echo APP_NAME; ?> - نظام إدارة المستشفى</title>
    
    <!-- Bootstrap CSS -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.0/font/bootstrap-icons.css" rel="stylesheet">
    
    <!-- Custom CSS -->
    <link href="assets/css/style.css" rel="stylesheet">
    
    <!-- Google Fonts -->
    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700&display=swap" rel="stylesheet">
</head>
<body class="login-page">
    <!-- خلفية متحركة -->
    <div class="animated-background">
        <div class="floating-shapes">
            <div class="shape shape-1"></div>
            <div class="shape shape-2"></div>
            <div class="shape shape-3"></div>
            <div class="shape shape-4"></div>
            <div class="shape shape-5"></div>
        </div>
    </div>

    <div class="container-fluid h-100">
        <div class="row h-100">
            <!-- القسم الأيسر - معلومات المستشفى -->
            <div class="col-lg-6 d-none d-lg-flex align-items-center justify-content-center hospital-info-section">
                <div class="text-center text-white">
                    <div class="hospital-logo mb-4">
                        <i class="bi bi-hospital display-1"></i>
                    </div>
                    <h1 class="display-4 fw-bold mb-3"><?php echo APP_NAME; ?></h1>
                    <p class="lead mb-4">نظام إدارة متطور وشامل لإدارة المرضى والخدمات الطبية</p>
                    
                    <div class="features-list">
                        <div class="feature-item mb-3">
                            <i class="bi bi-check-circle-fill text-success me-2"></i>
                            <span>إدارة المرضى المقيمين والمراجعين</span>
                        </div>
                        <div class="feature-item mb-3">
                            <i class="bi bi-check-circle-fill text-success me-2"></i>
                            <span>نظام طوابير ذكي ومتطور</span>
                        </div>
                        <div class="feature-item mb-3">
                            <i class="bi bi-check-circle-fill text-success me-2"></i>
                            <span>تقارير وإحصائيات شاملة</span>
                        </div>
                        <div class="feature-item mb-3">
                            <i class="bi bi-check-circle-fill text-success me-2"></i>
                            <span>واجهة عصرية ومتجاوبة</span>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- القسم الأيمن - نموذج تسجيل الدخول -->
            <div class="col-lg-6 d-flex align-items-center justify-content-center login-form-section">
                <div class="login-container">
                    <div class="card shadow-lg border-0">
                        <div class="card-body p-5">
                            <!-- شعار المستشفى للشاشات الصغيرة -->
                            <div class="text-center d-lg-none mb-4">
                                <i class="bi bi-hospital display-4 text-primary"></i>
                                <h2 class="mt-2"><?php echo APP_NAME; ?></h2>
                            </div>
                            
                            <div class="text-center mb-4">
                                <h3 class="fw-bold text-primary">تسجيل الدخول</h3>
                                <p class="text-muted">أدخل بيانات الدخول للوصول إلى النظام</p>
                            </div>
                            
                            <!-- رسائل التنبيه -->
                            <div id="alert-container"></div>
                            
                            <form id="loginForm" method="POST" action="auth/login.php">
                                <div class="mb-3">
                                    <label for="username" class="form-label">
                                        <i class="bi bi-person-fill me-2"></i>اسم المستخدم
                                    </label>
                                    <input type="text" class="form-control form-control-lg" id="username" name="username" required>
                                </div>
                                
                                <div class="mb-4">
                                    <label for="password" class="form-label">
                                        <i class="bi bi-lock-fill me-2"></i>كلمة المرور
                                    </label>
                                    <div class="input-group">
                                        <input type="password" class="form-control form-control-lg" id="password" name="password" required>
                                        <button class="btn btn-outline-secondary" type="button" id="togglePassword">
                                            <i class="bi bi-eye"></i>
                                        </button>
                                    </div>
                                </div>
                                
                                <div class="d-grid">
                                    <button type="submit" class="btn btn-primary btn-lg">
                                        <i class="bi bi-box-arrow-in-right me-2"></i>دخول
                                    </button>
                                </div>
                            </form>
                            
                            <hr class="my-4">
                            
                            <div class="text-center">
                                <small class="text-muted">
                                    المستخدم الافتراضي: <strong>amod</strong><br>
                                    كلمة المرور: <strong>1997200455</strong>
                                </small>
                            </div>
                        </div>
                    </div>
                    
                    <!-- معلومات إضافية -->
                    <div class="text-center mt-4">
                        <p class="text-muted small">
                            <i class="bi bi-shield-check me-1"></i>
                            نظام آمن ومحمي بأحدث تقنيات الأمان
                        </p>
                    </div>
                </div>
            </div>
        </div>
    </div>
    
    <!-- Footer -->
    <footer class="login-footer">
        <div class="container">
            <div class="row">
                <div class="col-12 text-center">
                    <p class="mb-0 text-white-50">
                        &copy; <?php echo date('Y'); ?> <?php echo APP_NAME; ?>. جميع الحقوق محفوظة.
                        <span class="mx-2">|</span>
                        الإصدار <?php echo APP_VERSION; ?>
                    </p>
                </div>
            </div>
        </div>
    </footer>

    <!-- Bootstrap JS -->
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    
    <!-- Custom JS -->
    <script>
        // تبديل إظهار/إخفاء كلمة المرور
        document.getElementById('togglePassword').addEventListener('click', function() {
            const password = document.getElementById('password');
            const icon = this.querySelector('i');
            
            if (password.type === 'password') {
                password.type = 'text';
                icon.classList.remove('bi-eye');
                icon.classList.add('bi-eye-slash');
            } else {
                password.type = 'password';
                icon.classList.remove('bi-eye-slash');
                icon.classList.add('bi-eye');
            }
        });
        
        // معالجة نموذج تسجيل الدخول
        document.getElementById('loginForm').addEventListener('submit', function(e) {
            e.preventDefault();
            
            const formData = new FormData(this);
            const submitBtn = this.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerHTML;
            
            // تعطيل الزر وإظهار مؤشر التحميل
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="bi bi-hourglass-split me-2"></i>جاري التحقق...';
            
            fetch('auth/login.php', {
                method: 'POST',
                body: formData
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    showAlert('تم تسجيل الدخول بنجاح!', 'success');
                    setTimeout(() => {
                        window.location.href = 'dashboard.php';
                    }, 1000);
                } else {
                    showAlert(data.message || 'خطأ في بيانات الدخول', 'danger');
                }
            })
            .catch(error => {
                showAlert('حدث خطأ في الاتصال', 'danger');
            })
            .finally(() => {
                // إعادة تفعيل الزر
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
            });
        });
        
        // عرض رسائل التنبيه
        function showAlert(message, type) {
            const alertContainer = document.getElementById('alert-container');
            const alert = document.createElement('div');
            alert.className = `alert alert-${type} alert-dismissible fade show`;
            alert.innerHTML = `
                ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            `;
            
            alertContainer.innerHTML = '';
            alertContainer.appendChild(alert);
            
            // إزالة التنبيه تلقائياً بعد 5 ثوان
            setTimeout(() => {
                if (alert.parentNode) {
                    alert.remove();
                }
            }, 5000);
        }
        
        // تحقق من وجود رسالة في URL
        const urlParams = new URLSearchParams(window.location.search);
        const message = urlParams.get('message');
        const type = urlParams.get('type');
        
        if (message) {
            showAlert(decodeURIComponent(message), type || 'info');
            // إزالة المعاملات من URL
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    </script>
</body>
</html>
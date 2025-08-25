<?php
/**
 * إدارة المستخدمين - مستشفى الوحدة العلاجي
 * Users Management - Hospital Unity
 */

require_once '../includes/functions.php';

// التحقق من تسجيل الدخول
if (!$hospital->isLoggedIn()) {
    header('Location: ../index.php');
    exit();
}

// التحقق من صلاحيات الإدارة
if ($_SESSION['role'] !== 'admin') {
    header('Location: ../dashboard.php');
    exit();
}

$db = (new Database())->getConnection();

// معالجة العمليات
$message = '';
$message_type = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (isset($_POST['action'])) {
        switch ($_POST['action']) {
            case 'add_user':
                $username = $hospital->sanitizeInput($_POST['username']);
                $full_name = $hospital->sanitizeInput($_POST['full_name']);
                $role = $hospital->sanitizeInput($_POST['role']);
                $phone = $hospital->sanitizeInput($_POST['phone']);
                $password = $hospital->generateRandomPassword();
                $hashed_password = password_hash($password, PASSWORD_DEFAULT);
                
                try {
                    // التحقق من عدم وجود اسم المستخدم
                    $check_query = "SELECT COUNT(*) FROM users WHERE username = :username";
                    $check_stmt = $db->prepare($check_query);
                    $check_stmt->bindParam(':username', $username);
                    $check_stmt->execute();
                    
                    if ($check_stmt->fetchColumn() > 0) {
                        $message = "اسم المستخدم موجود بالفعل";
                        $message_type = 'danger';
                    } else {
                        $query = "INSERT INTO users (username, password, full_name, role, phone, created_at) VALUES (:username, :password, :full_name, :role, :phone, NOW())";
                        $stmt = $db->prepare($query);
                        $stmt->bindParam(':username', $username);
                        $stmt->bindParam(':password', $hashed_password);
                        $stmt->bindParam(':full_name', $full_name);
                        $stmt->bindParam(':role', $role);
                        $stmt->bindParam(':phone', $phone);
                        
                        if ($stmt->execute()) {
                            $user_id = $db->lastInsertId();
                            $hospital->logActivity($_SESSION['user_id'], 'إضافة مستخدم جديد', 'users', $user_id);
                            
                            // إرسال كلمة المرور عبر SMS إذا كان الهاتف متوفر
                            if (!empty($phone)) {
                                $sms_message = "مرحباً {$full_name}، تم إنشاء حساب لك في " . APP_NAME . "\nاسم المستخدم: {$username}\nكلمة المرور: {$password}\nيرجى تغيير كلمة المرور عند أول تسجيل دخول.";
                                
                                if ($hospital->sendSMS($phone, $sms_message)) {
                                    $message = "تم إضافة المستخدم بنجاح وإرسال كلمة المرور عبر SMS";
                                    $message_type = 'success';
                                } else {
                                    $message = "تم إضافة المستخدم بنجاح ولكن فشل إرسال SMS. كلمة المرور: " . $password;
                                    $message_type = 'warning';
                                }
                            } else {
                                $message = "تم إضافة المستخدم بنجاح. كلمة المرور: " . $password;
                                $message_type = 'success';
                            }
                        }
                    }
                } catch (Exception $e) {
                    $message = "خطأ في إضافة المستخدم: " . $e->getMessage();
                    $message_type = 'danger';
                }
                break;
                
            case 'edit_user':
                $user_id = (int)$_POST['user_id'];
                $username = $hospital->sanitizeInput($_POST['username']);
                $full_name = $hospital->sanitizeInput($_POST['full_name']);
                $role = $hospital->sanitizeInput($_POST['role']);
                $phone = $hospital->sanitizeInput($_POST['phone']);
                
                try {
                    // التحقق من عدم وجود اسم المستخدم لمستخدم آخر
                    $check_query = "SELECT COUNT(*) FROM users WHERE username = :username AND id != :user_id";
                    $check_stmt = $db->prepare($check_query);
                    $check_stmt->bindParam(':username', $username);
                    $check_stmt->bindParam(':user_id', $user_id);
                    $check_stmt->execute();
                    
                    if ($check_stmt->fetchColumn() > 0) {
                        $message = "اسم المستخدم موجود بالفعل";
                        $message_type = 'danger';
                    } else {
                        $query = "UPDATE users SET username = :username, full_name = :full_name, role = :role, phone = :phone WHERE id = :user_id";
                        $stmt = $db->prepare($query);
                        $stmt->bindParam(':username', $username);
                        $stmt->bindParam(':full_name', $full_name);
                        $stmt->bindParam(':role', $role);
                        $stmt->bindParam(':phone', $phone);
                        $stmt->bindParam(':user_id', $user_id);
                        
                        if ($stmt->execute()) {
                            $hospital->logActivity($_SESSION['user_id'], 'تعديل بيانات مستخدم', 'users', $user_id);
                            $message = "تم تحديث بيانات المستخدم بنجاح";
                            $message_type = 'success';
                        }
                    }
                } catch (Exception $e) {
                    $message = "خطأ في تحديث المستخدم: " . $e->getMessage();
                    $message_type = 'danger';
                }
                break;
                
            case 'delete_user':
                $user_id = (int)$_POST['user_id'];
                
                // منع حذف المستخدم الحالي
                if ($user_id == $_SESSION['user_id']) {
                    $message = "لا يمكن حذف حسابك الشخصي";
                    $message_type = 'danger';
                } else {
                    try {
                        $query = "DELETE FROM users WHERE id = :user_id";
                        $stmt = $db->prepare($query);
                        $stmt->bindParam(':user_id', $user_id);
                        
                        if ($stmt->execute()) {
                            $hospital->logActivity($_SESSION['user_id'], 'حذف مستخدم', 'users', $user_id);
                            $message = "تم حذف المستخدم بنجاح";
                            $message_type = 'success';
                        }
                    } catch (Exception $e) {
                        $message = "خطأ في حذف المستخدم: " . $e->getMessage();
                        $message_type = 'danger';
                    }
                }
                break;
                
            case 'reset_password':
                $user_id = (int)$_POST['user_id'];
                $new_password = $hospital->generateRandomPassword();
                $hashed_password = password_hash($new_password, PASSWORD_DEFAULT);
                
                try {
                    // الحصول على بيانات المستخدم
                    $user_query = "SELECT full_name, phone FROM users WHERE id = :user_id";
                    $user_stmt = $db->prepare($user_query);
                    $user_stmt->bindParam(':user_id', $user_id);
                    $user_stmt->execute();
                    $user_data = $user_stmt->fetch();
                    
                    if ($user_data) {
                        $query = "UPDATE users SET password = :password WHERE id = :user_id";
                        $stmt = $db->prepare($query);
                        $stmt->bindParam(':password', $hashed_password);
                        $stmt->bindParam(':user_id', $user_id);
                        
                        if ($stmt->execute()) {
                            $hospital->logActivity($_SESSION['user_id'], 'إعادة تعيين كلمة مرور', 'users', $user_id);
                            
                            // إرسال كلمة المرور الجديدة عبر SMS
                            if (!empty($user_data['phone'])) {
                                $sms_message = "مرحباً {$user_data['full_name']}، تم إعادة تعيين كلمة المرور الخاصة بك في " . APP_NAME . "\nكلمة المرور الجديدة: {$new_password}\nيرجى تغيير كلمة المرور عند تسجيل الدخول.";
                                
                                if ($hospital->sendSMS($user_data['phone'], $sms_message)) {
                                    $message = "تم إعادة تعيين كلمة المرور وإرسالها عبر SMS";
                                    $message_type = 'success';
                                } else {
                                    $message = "تم إعادة تعيين كلمة المرور ولكن فشل إرسال SMS. كلمة المرور الجديدة: " . $new_password;
                                    $message_type = 'warning';
                                }
                            } else {
                                $message = "تم إعادة تعيين كلمة المرور. كلمة المرور الجديدة: " . $new_password;
                                $message_type = 'success';
                            }
                        }
                    }
                } catch (Exception $e) {
                    $message = "خطأ في إعادة تعيين كلمة المرور: " . $e->getMessage();
                    $message_type = 'danger';
                }
                break;
        }
    }
}

// الحصول على المستخدمين
try {
    $search = $_GET['search'] ?? '';
    $role_filter = $_GET['role'] ?? '';
    
    $where_conditions = ["1=1"];
    $params = [];
    
    if (!empty($search)) {
        $where_conditions[] = "(username LIKE :search OR full_name LIKE :search)";
        $params[':search'] = "%{$search}%";
    }
    
    if (!empty($role_filter)) {
        $where_conditions[] = "role = :role";
        $params[':role'] = $role_filter;
    }
    
    $where_clause = implode(' AND ', $where_conditions);
    
    $query = "SELECT * FROM users WHERE {$where_clause} ORDER BY created_at DESC";
    $stmt = $db->prepare($query);
    $stmt->execute($params);
    $users = $stmt->fetchAll();
    
} catch (Exception $e) {
    $users = [];
}
?>

<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>إدارة المستخدمين - <?php echo APP_NAME; ?></title>
    
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
                            <a class="nav-link active" href="index.php">
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
                        <h1 class="h2">إدارة المستخدمين</h1>
                        <p class="text-muted">إضافة وتعديل وحذف المستخدمين</p>
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
                                    <input type="text" class="form-control" name="search" placeholder="البحث في المستخدمين..." value="<?php echo htmlspecialchars($_GET['search'] ?? ''); ?>">
                                </div>
                                <div class="col-md-4">
                                    <select class="form-select" name="role">
                                        <option value="">جميع الأدوار</option>
                                        <option value="admin" <?php echo ($_GET['role'] ?? '') == 'admin' ? 'selected' : ''; ?>>مدير</option>
                                        <option value="doctor" <?php echo ($_GET['role'] ?? '') == 'doctor' ? 'selected' : ''; ?>>طبيب</option>
                                        <option value="nurse" <?php echo ($_GET['role'] ?? '') == 'nurse' ? 'selected' : ''; ?>>ممرض</option>
                                        <option value="receptionist" <?php echo ($_GET['role'] ?? '') == 'receptionist' ? 'selected' : ''; ?>>موظف استقبال</option>
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
                            <button type="button" class="btn btn-success" data-bs-toggle="modal" data-bs-target="#addUserModal">
                                <i class="bi bi-person-plus me-2"></i>
                                إضافة مستخدم جديد
                            </button>
                        </div>
                    </div>
                </div>
                
                <!-- جدول المستخدمين -->
                <div class="table-container">
                    <div class="table-responsive">
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>اسم المستخدم</th>
                                    <th>الاسم الكامل</th>
                                    <th>الدور</th>
                                    <th>الهاتف</th>
                                    <th>كلمة المرور المؤقتة</th>
                                    <th>تاريخ الإنشاء</th>
                                    <th>العمليات</th>
                                </tr>
                            </thead>
                            <tbody>
                                <?php if (empty($users)): ?>
                                <tr>
                                    <td colspan="7" class="text-center text-muted py-4">
                                        <i class="bi bi-people display-4 d-block mb-3"></i>
                                        لا توجد مستخدمين
                                    </td>
                                </tr>
                                <?php else: ?>
                                <?php foreach ($users as $user): ?>
                                <tr>
                                    <td>
                                        <strong><?php echo htmlspecialchars($user['username']); ?></strong>
                                        <?php if ($user['id'] == $_SESSION['user_id']): ?>
                                        <span class="badge bg-primary ms-2">أنت</span>
                                        <?php endif; ?>
                                    </td>
                                    <td><?php echo htmlspecialchars($user['full_name']); ?></td>
                                    <td>
                                        <?php
                                        $role_labels = [
                                            'admin' => 'مدير',
                                            'doctor' => 'طبيب',
                                            'nurse' => 'ممرض',
                                            'receptionist' => 'موظف استقبال'
                                        ];
                                        $role_colors = [
                                            'admin' => 'danger',
                                            'doctor' => 'primary',
                                            'nurse' => 'success',
                                            'receptionist' => 'info'
                                        ];
                                        ?>
                                        <span class="badge bg-<?php echo $role_colors[$user['role']] ?? 'secondary'; ?>">
                                            <?php echo $role_labels[$user['role']] ?? $user['role']; ?>
                                        </span>
                                    </td>
                                    <td><?php echo htmlspecialchars($user['phone'] ?? 'غير محدد'); ?></td>
                                    <td>
                                        <span class="badge bg-secondary" id="temp-password-<?php echo $user['id']; ?>" style="display: none;"></span>
                                        <small class="text-muted">يظهر عند إعادة التعيين</small>
                                    </td>
                                    <td><?php echo date('Y/m/d H:i', strtotime($user['created_at'])); ?></td>
                                    <td>
                                        <div class="btn-group" role="group">
                                            <button type="button" class="btn btn-sm btn-warning" onclick="editUser(<?php echo htmlspecialchars(json_encode($user)); ?>)">
                                                <i class="bi bi-pencil"></i>
                                            </button>
                                            <button type="button" class="btn btn-sm btn-info" onclick="resetPassword(<?php echo $user['id']; ?>, '<?php echo htmlspecialchars($user['full_name']); ?>')">
                                                <i class="bi bi-key"></i>
                                            </button>
                                            <?php if ($user['id'] != $_SESSION['user_id']): ?>
                                            <button type="button" class="btn btn-sm btn-danger" onclick="deleteUser(<?php echo $user['id']; ?>, '<?php echo htmlspecialchars($user['full_name']); ?>')">
                                                <i class="bi bi-trash"></i>
                                            </button>
                                            <?php endif; ?>
                                        </div>
                                    </td>
                                </tr>
                                <?php endforeach; ?>
                                <?php endif; ?>
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>
        </div>
    </div>
    
    <!-- مودال إضافة مستخدم -->
    <div class="modal fade" id="addUserModal" tabindex="-1">
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">إضافة مستخدم جديد</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <form method="POST">
                    <input type="hidden" name="action" value="add_user">
                    <div class="modal-body">
                        <div class="mb-3">
                            <label for="username" class="form-label">اسم المستخدم</label>
                            <input type="text" class="form-control" id="username" name="username" required>
                        </div>
                        <div class="mb-3">
                            <label for="full_name" class="form-label">الاسم الكامل</label>
                            <input type="text" class="form-control" id="full_name" name="full_name" required>
                        </div>
                        <div class="mb-3">
                            <label for="role" class="form-label">الدور</label>
                            <select class="form-select" id="role" name="role" required>
                                <option value="">اختر الدور</option>
                                <option value="admin">مدير</option>
                                <option value="doctor">طبيب</option>
                                <option value="nurse">ممرض</option>
                                <option value="receptionist">موظف استقبال</option>
                            </select>
                        </div>
                        <div class="mb-3">
                            <label for="phone" class="form-label">رقم الهاتف</label>
                            <input type="tel" class="form-control" id="phone" name="phone" placeholder="07XXXXXXXX">
                            <div class="form-text">سيتم إرسال كلمة المرور عبر SMS إذا تم إدخال رقم الهاتف</div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">إلغاء</button>
                        <button type="submit" class="btn btn-success">إضافة المستخدم</button>
                    </div>
                </form>
            </div>
        </div>
    </div>
    
    <!-- مودال تعديل مستخدم -->
    <div class="modal fade" id="editUserModal" tabindex="-1">
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">تعديل المستخدم</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <form method="POST">
                    <input type="hidden" name="action" value="edit_user">
                    <input type="hidden" name="user_id" id="edit_user_id">
                    <div class="modal-body">
                        <div class="mb-3">
                            <label for="edit_username" class="form-label">اسم المستخدم</label>
                            <input type="text" class="form-control" id="edit_username" name="username" required>
                        </div>
                        <div class="mb-3">
                            <label for="edit_full_name" class="form-label">الاسم الكامل</label>
                            <input type="text" class="form-control" id="edit_full_name" name="full_name" required>
                        </div>
                        <div class="mb-3">
                            <label for="edit_role" class="form-label">الدور</label>
                            <select class="form-select" id="edit_role" name="role" required>
                                <option value="admin">مدير</option>
                                <option value="doctor">طبيب</option>
                                <option value="nurse">ممرض</option>
                                <option value="receptionist">موظف استقبال</option>
                            </select>
                        </div>
                        <div class="mb-3">
                            <label for="edit_phone" class="form-label">رقم الهاتف</label>
                            <input type="tel" class="form-control" id="edit_phone" name="phone" placeholder="07XXXXXXXX">
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">إلغاء</button>
                        <button type="submit" class="btn btn-warning">تحديث المستخدم</button>
                    </div>
                </form>
            </div>
        </div>
    </div>
    
    <!-- Bootstrap JS -->
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    
    <script>
        function editUser(user) {
            document.getElementById('edit_user_id').value = user.id;
            document.getElementById('edit_username').value = user.username;
            document.getElementById('edit_full_name').value = user.full_name;
            document.getElementById('edit_role').value = user.role;
            document.getElementById('edit_phone').value = user.phone || '';
            
            new bootstrap.Modal(document.getElementById('editUserModal')).show();
        }
        
        function deleteUser(userId, userName) {
            if (confirm('هل أنت متأكد من حذف المستخدم "' + userName + '"؟\nهذا الإجراء لا يمكن التراجع عنه.')) {
                const form = document.createElement('form');
                form.method = 'POST';
                form.innerHTML = `
                    <input type="hidden" name="action" value="delete_user">
                    <input type="hidden" name="user_id" value="${userId}">
                `;
                document.body.appendChild(form);
                form.submit();
            }
        }
        
        function resetPassword(userId, userName) {
            if (confirm('هل أنت متأكد من إعادة تعيين كلمة مرور المستخدم "' + userName + '"؟\nسيتم إنشاء كلمة مرور جديدة وإرسالها عبر SMS إذا كان رقم الهاتف متوفر.')) {
                const form = document.createElement('form');
                form.method = 'POST';
                form.innerHTML = `
                    <input type="hidden" name="action" value="reset_password">
                    <input type="hidden" name="user_id" value="${userId}">
                `;
                document.body.appendChild(form);
                form.submit();
            }
        }
    </script>
</body>
</html>
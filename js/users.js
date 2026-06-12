let editingUserId = null;

function loadUsers() {
    const users = db.get('users');
    const table = document.getElementById('usersTable');
    if (table) {
        table.innerHTML = '';
        users.forEach(user => {
            const row = document.createElement('tr');
            const roleLabels = { admin: 'مدير', cashier: 'كاشير', manager: 'مدير فرع' };
            row.innerHTML = `
                <td>${user.username}</td>
                <td><span class="badge bg-gold text-dark">${roleLabels[user.role] || user.role}</span></td>
                <td>
                    <button class="btn btn-sm btn-gold me-1" onclick="editUser(${user.id})">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-sm btn-secondary me-1" onclick="openChangePasswordModal(${user.id})">
                        <i class="bi bi-key"></i>
                    </button>
                    ${user.username !== 'admin' ? `
                        <button class="btn btn-sm btn-danger" onclick="deleteUser(${user.id})">
                            <i class="bi bi-trash"></i>
                        </button>
                    ` : ''}
                </td>
            `;
            table.appendChild(row);
        });
    }
}

function editUser(id) {
    const users = db.get('users');
    const user = users.find(u => u.id === id);
    if (user) {
        editingUserId = id;
        document.getElementById('userModalTitle').textContent = 'تعديل المستخدم';
        document.getElementById('userId').value = id;
        document.getElementById('userName').value = user.username;
        document.getElementById('userPassword').value = '';
        document.getElementById('userPassword').removeAttribute('required');
        document.getElementById('userRole').value = user.role;
        
        const modal = new bootstrap.Modal(document.getElementById('userModal'));
        modal.show();
    }
}

function deleteUser(id) {
    if (confirm('هل أنت متأكد من حذف هذا المستخدم؟')) {
        let users = db.get('users');
        users = users.filter(u => u.id !== id);
        db.set('users', users);
        loadUsers();
    }
}

function openChangePasswordModal(id) {
    document.getElementById('changePasswordUserId').value = id;
    document.getElementById('newPassword').value = '';
    document.getElementById('confirmPassword').value = '';
    const modal = new bootstrap.Modal(document.getElementById('changePasswordModal'));
    modal.show();
}

document.addEventListener('DOMContentLoaded', () => {
    const currentUser = getCurrentUser();
    if (currentUser) {
        const welcomeEl = document.getElementById('welcomeUser');
        if (welcomeEl) {
            const roleLabels = { admin: 'مدير', cashier: 'كاشير', manager: 'مدير فرع' };
            welcomeEl.innerHTML = `<i class="bi bi-person-circle me-2"></i>مرحباً، ${currentUser.username} (${roleLabels[currentUser.role] || currentUser.role})`;
        }
    }
    
    // Initialize default user with role if not exists
    let users = db.get('users');
    if (users.length > 0 && !users[0].role) {
        users[0].role = 'admin';
        db.set('users', users);
    }

    loadUsers();

    // User form submit
    document.getElementById('userForm').addEventListener('submit', (e) => {
        e.preventDefault();
        
        let users = db.get('users');
        const username = document.getElementById('userName').value;
        const password = document.getElementById('userPassword').value;
        const role = document.getElementById('userRole').value;

        if (editingUserId) {
            // Edit existing user
            users = users.map(u => {
                if (u.id === editingUserId) {
                    const updatedUser = { ...u, username, role };
                    if (password) {
                        updatedUser.password = password;
                    }
                    return updatedUser;
                }
                return u;
            });
        } else {
            // Add new user
            // Check if username already exists
            const existingUser = users.find(u => u.username === username);
            if (existingUser) {
                alert('اسم المستخدم موجود بالفعل');
                return;
            }
            if (!password) {
                alert('يرجى إدخال كلمة المرور');
                return;
            }
            const newUser = {
                id: db.generateId('users'),
                username,
                password,
                role
            };
            users.push(newUser);
        }
        
        db.set('users', users);
        loadUsers();
        bootstrap.Modal.getInstance(document.getElementById('userModal')).hide();
    });

    // User modal hidden
    document.getElementById('userModal').addEventListener('hidden.bs.modal', () => {
        editingUserId = null;
        document.getElementById('userModalTitle').textContent = 'إضافة مستخدم جديد';
        document.getElementById('userForm').reset();
        document.getElementById('userPassword').setAttribute('required', 'required');
    });

    // Change password form
    document.getElementById('changePasswordForm').addEventListener('submit', (e) => {
        e.preventDefault();
        
        const userId = parseInt(document.getElementById('changePasswordUserId').value);
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        if (newPassword !== confirmPassword) {
            alert('كلمات المرور غير متطابقة');
            return;
        }

        let users = db.get('users');
        users = users.map(u => {
            if (u.id === userId) {
                return { ...u, password: newPassword };
            }
            return u;
        });
        db.set('users', users);

        alert('تم تغيير كلمة المرور بنجاح');
        bootstrap.Modal.getInstance(document.getElementById('changePasswordModal')).hide();
    });
});

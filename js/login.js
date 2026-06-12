document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            
            const users = db.get('users');
            const user = users.find(u => u.username === username && u.password === password);
            
            if (user) {
                sessionStorage.setItem('user', JSON.stringify(user));
                window.location.href = 'dashboard.html';
            } else {
                alert('اسم المستخدم أو كلمة المرور غير صحيحة');
            }
        });
    }
});

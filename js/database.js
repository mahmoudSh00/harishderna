class Database {
    constructor() {
        this.init();
    }

    init() {
        if (!localStorage.getItem('users')) {
            localStorage.setItem('users', JSON.stringify([
                { id: 1, username: 'admin', password: 'admin123', role: 'admin' }
            ]));
        }
        if (!localStorage.getItem('categories')) {
            localStorage.setItem('categories', JSON.stringify([
                { id: 1, name: 'ملابس رجالية' },
                { id: 2, name: 'ملابس نسائية' },
                { id: 3, name: 'أحذية' },
                { id: 4, name: 'إكسسوارات' }
            ]));
        }
        if (!localStorage.getItem('suppliers')) {
            localStorage.setItem('suppliers', JSON.stringify([
                { id: 1, name: 'مورد 1', phone: '0911234567' },
                { id: 2, name: 'مورد 2', phone: '0921234567' }
            ]));
        }
        if (!localStorage.getItem('products')) {
            localStorage.setItem('products', JSON.stringify([]));
        }
        if (!localStorage.getItem('purchases')) {
            localStorage.setItem('purchases', JSON.stringify([]));
        }
        if (!localStorage.getItem('sales')) {
            localStorage.setItem('sales', JSON.stringify([]));
        }
        if (!localStorage.getItem('stockMovements')) {
            localStorage.setItem('stockMovements', JSON.stringify([]));
        }
    }

    get(key) {
        return JSON.parse(localStorage.getItem(key) || '[]');
    }

    set(key, data) {
        localStorage.setItem(key, JSON.stringify(data));
    }

    generateId(key) {
        const items = this.get(key);
        return items.length > 0 ? Math.max(...items.map(i => i.id)) + 1 : 1;
    }

    generateBarcode() {
        return Date.now().toString() + Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    }

    addStockMovement(productId, type, quantity, notes = '') {
        const movements = this.get('stockMovements');
        movements.push({
            id: this.generateId('stockMovements'),
            productId,
            type,
            quantity,
            notes,
            date: new Date().toISOString()
        });
        this.set('stockMovements', movements);
    }
}

const db = new Database();

function getCurrentUser() {
    const userStr = sessionStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
}

function checkAuth() {
    const user = sessionStorage.getItem('user');
    if (!user && window.location.pathname !== '/index.html' && !window.location.pathname.endsWith('index.html')) {
        window.location.href = 'index.html';
    } else if (user) {
        // Check if user page is accessed and user is not admin
        if (window.location.pathname.includes('users.html')) {
            const currentUser = getCurrentUser();
            if (currentUser.role !== 'admin') {
                alert('غير مسموح لك بالوصول إلى هذه الصفحة');
                window.location.href = 'dashboard.html';
            }
        }
    }
}

function logout() {
    sessionStorage.removeItem('user');
    window.location.href = 'index.html';
}

document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            logout();
        });
    }
    
    // Sidebar Toggle Functionality
    const sidebarToggle = document.querySelector('.sidebar-toggle');
    const sidebar = document.querySelector('.sidebar');
    const sidebarOverlay = document.querySelector('.sidebar-overlay');
    const mainContent = document.querySelector('.main-content');
    
    function toggleSidebar() {
        if (window.innerWidth < 992) {
            // Mobile toggle
            if (sidebar && sidebarOverlay) {
                sidebar.classList.toggle('show');
                sidebarOverlay.classList.toggle('show');
            }
        } else {
            // Desktop toggle
            if (sidebar && mainContent) {
                sidebar.classList.toggle('hidden');
                mainContent.classList.toggle('expanded');
            }
        }
    }
    
    function closeSidebar() {
        if (window.innerWidth < 992) {
            if (sidebar && sidebarOverlay) {
                sidebar.classList.remove('show');
                sidebarOverlay.classList.remove('show');
            }
        } else {
            if (sidebar && mainContent) {
                sidebar.classList.remove('hidden');
                mainContent.classList.remove('expanded');
            }
        }
    }
    
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', toggleSidebar);
    }
    
    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', closeSidebar);
    }
    
    // Close sidebar when clicking a nav link on mobile
    const navLinks = document.querySelectorAll('.sidebar .nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            if (window.innerWidth < 992) { // Only on mobile
                closeSidebar();
            }
        });
    });
});

function formatCurrency(amount) {
    return parseFloat(amount).toFixed(2) + ' د.ل';
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('ar-LY') + ' ' + date.toLocaleTimeString('ar-LY');
}

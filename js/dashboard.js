function updateCurrentTime() {
    const timeEl = document.getElementById('currentTime');
    if (timeEl) {
        timeEl.textContent = new Date().toLocaleString('ar-LY');
    }
}

function loadDashboardStats() {
    const products = db.get('products');
    const sales = db.get('sales');
    const purchases = db.get('purchases');

    document.getElementById('totalProducts').textContent = products.length;
    
    const totalSales = sales.reduce((sum, s) => sum + s.total, 0);
    document.getElementById('totalSales').textContent = formatCurrency(totalSales);
    
    const totalPurchases = purchases.reduce((sum, p) => sum + p.total, 0);
    document.getElementById('totalPurchases').textContent = formatCurrency(totalPurchases);
    
    const stockValue = products.reduce((sum, p) => sum + (p.quantity * p.costPrice), 0);
    document.getElementById('stockValue').textContent = formatCurrency(stockValue);

    const lowStockTable = document.getElementById('lowStockTable');
    if (lowStockTable) {
        lowStockTable.innerHTML = '';
        const lowStockProducts = products.filter(p => p.quantity < 10);
        lowStockProducts.forEach(product => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${product.name}</td>
                <td><span class="badge bg-danger">${product.quantity}</span></td>
                <td>${product.barcode}</td>
                <td>${formatCurrency(product.sellPrice)}</td>
            `;
            lowStockTable.appendChild(row);
        });
    }
}

function backupData() {
    const data = {
        users: db.get('users'),
        categories: db.get('categories'),
        suppliers: db.get('suppliers'),
        products: db.get('products'),
        purchases: db.get('purchases'),
        sales: db.get('sales'),
        stockMovements: db.get('stockMovements'),
        backupDate: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `derna-elite-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function restoreData(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            
            // Validate data has required keys
            const requiredKeys = ['users', 'categories', 'suppliers', 'products', 'purchases', 'sales', 'stockMovements'];
            const hasAllKeys = requiredKeys.every(key => data.hasOwnProperty(key));
            
            if (!hasAllKeys) {
                alert('الملف غير صالح، يرجى التأكد من أن هذا ملف نسخة احتياطية صحيح');
                return;
            }

            if (confirm('سيتم استبدال جميع البيانات الحالية بالبيانات من النسخة الاحتياطية. هل أنت متأكد؟')) {
                db.set('users', data.users);
                db.set('categories', data.categories);
                db.set('suppliers', data.suppliers);
                db.set('products', data.products);
                db.set('purchases', data.purchases);
                db.set('sales', data.sales);
                db.set('stockMovements', data.stockMovements);
                
                alert('تم استعادة البيانات بنجاح');
                loadDashboardStats();
            }
        } catch (err) {
            alert('خطأ في قراءة الملف، يرجى التأكد من أن هذا ملف JSON صالح');
            console.error(err);
        }
    };
    reader.readAsText(file);
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
    
    updateCurrentTime();
    setInterval(updateCurrentTime, 1000);
    loadDashboardStats();

    // Backup button
    document.getElementById('backupBtn').addEventListener('click', backupData);

    // Restore button
    document.getElementById('restoreBtn').addEventListener('click', () => {
        document.getElementById('restoreFile').click();
    });

    document.getElementById('restoreFile').addEventListener('change', (e) => {
        if (e.target.files[0]) {
            restoreData(e.target.files[0]);
            e.target.value = ''; // Clear input
        }
    });
});

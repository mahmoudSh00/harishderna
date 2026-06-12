function loadStockMovements() {
    const movements = db.get('stockMovements').reverse();
    const products = db.get('products');
    const table = document.getElementById('stockMovementsTable');
    if (!table) return;
    
    table.innerHTML = '';
    movements.forEach(movement => {
        const product = products.find(p => p.id === movement.productId);
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${formatDate(movement.date)}</td>
            <td><span class="badge ${movement.type === 'بيع' ? 'bg-danger' : 'bg-success'}">${movement.type}</span></td>
            <td>${product ? product.name : ''}</td>
            <td>${movement.quantity}</td>
            <td>${movement.notes}</td>
        `;
        table.appendChild(row);
    });
}

function loadStockStatus() {
    const products = db.get('products');
    const table = document.getElementById('stockStatusTable');
    if (!table) return;
    
    table.innerHTML = '';
    products.forEach(product => {
        const stockValue = product.quantity * product.costPrice;
        let statusBadge = '<span class="badge bg-success">متوفر</span>';
        if (product.quantity < 10) {
            statusBadge = '<span class="badge bg-warning">منخفض</span>';
        }
        if (product.quantity === 0) {
            statusBadge = '<span class="badge bg-danger">نفد</span>';
        }
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${product.name}</td>
            <td>${product.quantity}</td>
            <td>${formatCurrency(product.costPrice)}</td>
            <td>${formatCurrency(stockValue)}</td>
            <td>${statusBadge}</td>
        `;
        table.appendChild(row);
    });
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
    
    loadStockMovements();
    loadStockStatus();
});

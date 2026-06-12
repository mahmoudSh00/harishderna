function generateReport(dateFrom, dateTo) {
    let sales = db.get('sales');
    let purchases = db.get('purchases');
    
    if (dateFrom) {
        sales = sales.filter(s => new Date(s.date) >= new Date(dateFrom));
        purchases = purchases.filter(p => new Date(p.date) >= new Date(dateFrom));
    }
    
    if (dateTo) {
        const toDate = new Date(dateTo);
        toDate.setHours(23,59,59,999);
        sales = sales.filter(s => new Date(s.date) <= toDate);
        purchases = purchases.filter(p => new Date(p.date) <= toDate);
    }
    
    const totalSales = sales.reduce((sum, s) => sum + s.total, 0);
    const totalPurchases = purchases.reduce((sum, p) => sum + p.total, 0);
    const profit = totalSales - totalPurchases;
    
    document.getElementById('reportTotalSales').textContent = formatCurrency(totalSales);
    document.getElementById('reportTotalPurchases').textContent = formatCurrency(totalPurchases);
    document.getElementById('reportProfit').textContent = formatCurrency(profit);
    document.getElementById('reportInvoiceCount').textContent = sales.length;
    
    const productSales = {};
    sales.forEach(sale => {
        sale.items.forEach(item => {
            if (!productSales[item.productId]) {
                productSales[item.productId] = { name: item.name, quantity: 0, revenue: 0 };
            }
            productSales[item.productId].quantity += item.quantity;
            productSales[item.productId].revenue += item.quantity * item.price;
        });
    });
    
    const sortedProducts = Object.values(productSales).sort((a, b) => b.quantity - a.quantity);
    const table = document.getElementById('topProductsTable');
    if (table) {
        table.innerHTML = '';
        sortedProducts.forEach(p => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${p.name}</td>
                <td>${p.quantity}</td>
                <td>${formatCurrency(p.revenue)}</td>
            `;
            table.appendChild(row);
        });
    }
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
    
    document.getElementById('generateReportBtn').addEventListener('click', () => {
        const dateFrom = document.getElementById('dateFrom').value;
        const dateTo = document.getElementById('dateTo').value;
        generateReport(dateFrom, dateTo);
    });
    
    generateReport();
});

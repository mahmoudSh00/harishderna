let purchaseItems = [];

function loadPurchaseSuppliers() {
    const suppliers = db.get('suppliers');
    const select = document.getElementById('purchaseSupplier');
    if (select) {
        select.innerHTML = '';
        suppliers.forEach(sup => {
            const opt = document.createElement('option');
            opt.value = sup.id;
            opt.textContent = sup.name;
            select.appendChild(opt);
        });
    }
}

function loadPurchaseProducts() {
    const products = db.get('products');
    const select = document.getElementById('purchaseProduct');
    if (select) {
        select.innerHTML = '';
        products.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = p.name;
            select.appendChild(opt);
        });
    }
}

function addPurchaseItem() {
    const productId = parseInt(document.getElementById('purchaseProduct').value);
    const quantity = parseInt(document.getElementById('purchaseQty').value);
    const price = parseFloat(document.getElementById('purchasePrice').value);
    
    if (!productId || !quantity || !price) {
        alert('يرجى ملء جميع الحقول');
        return;
    }
    
    const products = db.get('products');
    const product = products.find(p => p.id === productId);
    
    const existing = purchaseItems.find(i => i.productId === productId);
    if (existing) {
        existing.quantity += quantity;
    } else {
        purchaseItems.push({
            productId,
            name: product.name,
            quantity,
            price
        });
    }
    
    renderPurchaseItems();
    document.getElementById('purchaseQty').value = '';
    document.getElementById('purchasePrice').value = '';
}

function removePurchaseItem(index) {
    purchaseItems.splice(index, 1);
    renderPurchaseItems();
}

function renderPurchaseItems() {
    const tableBody = document.getElementById('purchaseItemsTable');
    if (!tableBody) return;
    tableBody.innerHTML = '';
    let total = 0;
    
    purchaseItems.forEach((item, index) => {
        const itemTotal = item.quantity * item.price;
        total += itemTotal;
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${item.name}</td>
            <td>${item.quantity}</td>
            <td>${formatCurrency(item.price)}</td>
            <td>${formatCurrency(itemTotal)}</td>
            <td><button class="btn btn-sm btn-danger" onclick="removePurchaseItem(${index})"><i class="bi bi-x"></i></button></td>
        `;
        tableBody.appendChild(row);
    });
    
    document.getElementById('purchaseTotal').textContent = formatCurrency(total);
}

function loadPurchasesTable() {
    const purchases = db.get('purchases').reverse();
    const suppliers = db.get('suppliers');
    const table = document.getElementById('purchasesTable');
    if (!table) return;
    table.innerHTML = '';
    
    purchases.forEach(purchase => {
        const supplier = suppliers.find(s => s.id === purchase.supplierId);
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>#${purchase.id}</td>
            <td>${formatDate(purchase.date)}</td>
            <td>${supplier ? supplier.name : ''}</td>
            <td>${formatCurrency(purchase.total)}</td>
            <td></td>
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
    
    loadPurchaseSuppliers();
    loadPurchaseProducts();
    loadPurchasesTable();
    
    document.getElementById('addPurchaseItem').addEventListener('click', addPurchaseItem);
    
    document.getElementById('savePurchaseBtn').addEventListener('click', () => {
        if (purchaseItems.length === 0) {
            alert('يرجى إضافة منتجات');
            return;
        }
        
        const supplierId = parseInt(document.getElementById('purchaseSupplier').value);
        const date = document.getElementById('purchaseDate').value || new Date().toISOString();
        const total = purchaseItems.reduce((sum, i) => sum + (i.quantity * i.price), 0);
        
        const purchases = db.get('purchases');
        const newPurchase = {
            id: db.generateId('purchases'),
            supplierId,
            date,
            items: [...purchaseItems],
            total
        };
        purchases.push(newPurchase);
        db.set('purchases', purchases);
        
        let products = db.get('products');
        purchaseItems.forEach(item => {
            products = products.map(p => {
                if (p.id === item.productId) {
                    db.addStockMovement(p.id, 'شراء', item.quantity, `فاتورة شراء #${newPurchase.id}`);
                    return { ...p, quantity: p.quantity + item.quantity };
                }
                return p;
            });
        });
        db.set('products', products);
        
        purchaseItems = [];
        renderPurchaseItems();
        loadPurchasesTable();
        bootstrap.Modal.getInstance(document.getElementById('purchaseModal')).hide();
    });
    
    document.getElementById('purchaseModal').addEventListener('hidden.bs.modal', () => {
        purchaseItems = [];
        renderPurchaseItems();
    });
});

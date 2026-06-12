let cart = [];

function loadProductsGrid(search = '') {
    let products = db.get('products');
    if (search) {
        products = products.filter(p => 
            p.name.toLowerCase().includes(search.toLowerCase()) || 
            p.barcode.includes(search)
        );
    }
    
    const grid = document.getElementById('productsGrid');
    if (grid) {
        grid.innerHTML = '';
        products.forEach(product => {
            if (product.quantity > 0) {
                const col = document.createElement('div');
                col.className = 'col-md-3 col-sm-4 col-6';
                col.innerHTML = `
                    <div class="card product-card h-100" onclick="addToCart(${product.id})">
                        <img src="${product.image || 'https://via.placeholder.com/150'}" class="card-img-top" style="height:120px; object-fit:cover;">
                        <div class="card-body">
                            <h6 class="card-title">${product.name}</h6>
                            <p class="card-text text-gold fw-bold">${formatCurrency(product.sellPrice)}</p>
                            <small class="text-muted">المتوفر: ${product.quantity}</small>
                        </div>
                    </div>
                `;
                grid.appendChild(col);
            }
        });
    }
}

function addToCart(productId) {
    const products = db.get('products');
    const product = products.find(p => p.id === productId);
    if (!product) return;
    
    const existingItem = cart.find(item => item.productId === productId);
    if (existingItem) {
        if (existingItem.quantity < product.quantity) {
            existingItem.quantity++;
        }
    } else {
        cart.push({
            productId,
            name: product.name,
            price: product.sellPrice,
            quantity: 1
        });
    }
    renderCart();
}

function removeFromCart(productId) {
    cart = cart.filter(item => item.productId !== productId);
    renderCart();
}

function updateQuantity(productId, newQty) {
    const products = db.get('products');
    const product = products.find(p => p.id === productId);
    const item = cart.find(i => i.productId === productId);
    if (item && newQty > 0 && newQty <= product.quantity) {
        item.quantity = newQty;
    } else if (newQty <=0) {
        removeFromCart(productId);
    }
    renderCart();
}

function renderCart() {
    const cartItemsEl = document.getElementById('cartItems');
    if (!cartItemsEl) return;
    
    cartItemsEl.innerHTML = '';
    let subtotal = 0;
    
    cart.forEach(item => {
        const total = item.price * item.quantity;
        subtotal += total;
        const div = document.createElement('div');
        div.className = 'border-bottom pb-2 mb-2';
        div.innerHTML = `
            <div class="d-flex justify-content-between">
                <div>
                    <strong>${item.name}</strong><br>
                    <small>${formatCurrency(item.price)} × 
                    <input type="number" value="${item.quantity}" min="1" style="width:60px;" onchange="updateQuantity(${item.productId}, parseInt(this.value))">
                    </small>
                </div>
                <div class="text-start">
                    <div>${formatCurrency(total)}</div>
                    <button class="btn btn-sm btn-danger" onclick="removeFromCart(${item.productId})"><i class="bi bi-x"></i></button>
                </div>
            </div>
        `;
        cartItemsEl.appendChild(div);
    });
    
    const discount = parseFloat(document.getElementById('discount').value) || 0;
    const tax = parseFloat(document.getElementById('tax').value) || 0;
    
    const discountAmount = subtotal * (discount / 100);
    const afterDiscount = subtotal - discountAmount;
    const taxAmount = afterDiscount * (tax / 100);
    const total = afterDiscount + taxAmount;
    
    document.getElementById('subtotal').textContent = formatCurrency(subtotal);
    document.getElementById('total').textContent = formatCurrency(total);
}

function loadSalesHistory() {
    const sales = db.get('sales').reverse();
    const table = document.getElementById('salesHistory');
    if (table) {
        table.innerHTML = '';
        sales.forEach(sale => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>#${sale.id}</td>
                <td>${formatDate(sale.date)}</td>
                <td>${formatCurrency(sale.total)}</td>
                <td>
                    <button class="btn btn-sm btn-gold" onclick="showInvoice(${sale.id})">
                        <i class="bi bi-receipt"></i>
                    </button>
                </td>
            `;
            table.appendChild(row);
        });
    }
}

function showInvoice(saleId) {
    const sales = db.get('sales');
    const sale = sales.find(s => s.id === saleId);
    if (!sale) return;
    
    const invoiceContent = document.getElementById('invoiceContent');
    let itemsHtml = '';
    sale.items.forEach(item => {
        itemsHtml += `
            <tr>
                <td>${item.name}</td>
                <td>${item.quantity}</td>
                <td>${formatCurrency(item.price)}</td>
                <td>${formatCurrency(item.price * item.quantity)}</td>
            </tr>
        `;
    });
    
    invoiceContent.innerHTML = `
        <div class="text-center mb-4">
            <h2 class="text-gold">Derna Elite</h2>
            <p>فاتورة مبيعات</p>
        </div>
        <div class="mb-3">
            <p><strong>رقم الفاتورة:</strong> #${sale.id}</p>
            <p><strong>التاريخ:</strong> ${formatDate(sale.date)}</p>
        </div>
        <table class="table">
            <thead><tr><th>المنتج</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead>
            <tbody>${itemsHtml}</tbody>
        </table>
        <div class="text-end">
            <h4 class="text-gold">الإجمالي: ${formatCurrency(sale.total)}</h4>
            <p>المدفوع: ${formatCurrency(sale.paid)}</p>
            <p>الباقي: ${formatCurrency(sale.change)}</p>
        </div>
    `;
    
    const modal = new bootstrap.Modal(document.getElementById('invoiceModal'));
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
    
    loadProductsGrid();
    loadSalesHistory();
    renderCart();
    
    document.getElementById('scanBarcode').addEventListener('input', (e) => {
        const barcode = e.target.value.trim();
        loadProductsGrid(barcode);
        
        const products = db.get('products');
        const product = products.find(p => p.barcode === barcode);
        if (product) {
            addToCart(product.id);
            e.target.value = '';
        }
    });
    
    document.getElementById('discount').addEventListener('change', renderCart);
    document.getElementById('tax').addEventListener('change', renderCart);
    
    document.getElementById('clearCartBtn').addEventListener('click', () => {
        cart = [];
        renderCart();
    });
    
    document.getElementById('checkoutBtn').addEventListener('click', () => {
        if (cart.length === 0) {
            alert('السلة فارغة');
            return;
        }
        new bootstrap.Modal(document.getElementById('paymentModal')).show();
    });
    
    document.getElementById('paidAmount').addEventListener('input', (e) => {
        const total = parseFloat(document.getElementById('total').textContent);
        const paid = parseFloat(e.target.value) || 0;
        document.getElementById('changeAmount').value = formatCurrency(paid - total);
    });
    
    document.getElementById('confirmSaleBtn').addEventListener('click', () => {
        const totalText = document.getElementById('total').textContent;
        const total = parseFloat(totalText);
        const paid = parseFloat(document.getElementById('paidAmount').value);
        
        if (paid < total) {
            alert('المبلغ المدفوع غير كافٍ');
            return;
        }
        
        const sales = db.get('sales');
        const newSale = {
            id: db.generateId('sales'),
            items: [...cart],
            total,
            paid,
            change: paid - total,
            date: new Date().toISOString()
        };
        sales.push(newSale);
        db.set('sales', sales);
        
        let products = db.get('products');
        cart.forEach(item => {
            products = products.map(p => {
                if (p.id === item.productId) {
                    const newQty = p.quantity - item.quantity;
                    db.addStockMovement(p.id, 'بيع', item.quantity, `فاتورة #${newSale.id}`);
                    return { ...p, quantity: newQty };
                }
                return p;
            });
        });
        db.set('products', products);
        
        cart = [];
        renderCart();
        loadProductsGrid();
        loadSalesHistory();
        bootstrap.Modal.getInstance(document.getElementById('paymentModal')).hide();
        showInvoice(newSale.id);
    });
    
    document.getElementById('printInvoiceBtn').addEventListener('click', () => {
        window.print();
    });
});

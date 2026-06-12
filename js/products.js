let editingProductId = null;

function loadCategories() {
    const categories = db.get('categories');
    const selects = document.querySelectorAll('#productCategory, #filterCategory');
    selects.forEach(select => {
        if (select) {
            select.innerHTML = select.id === 'filterCategory' ? '<option value="">جميع التصنيفات</option>' : '';
            categories.forEach(cat => {
                const option = document.createElement('option');
                option.value = cat.id;
                option.textContent = cat.name;
                select.appendChild(option);
            });
        }
    });

    // Load categories table
    const table = document.getElementById('categoriesTable');
    if (table) {
        table.innerHTML = '';
        categories.forEach(cat => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${cat.name}</td>
                <td>
                    <button class="btn btn-sm btn-danger" onclick="deleteCategory(${cat.id})">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            `;
            table.appendChild(row);
        });
    }
}

function addCategory() {
    const name = document.getElementById('newCategoryName').value.trim();
    if (!name) {
        alert('يرجى إدخال اسم التصنيف');
        return;
    }

    const categories = db.get('categories');
    categories.push({
        id: db.generateId('categories'),
        name
    });
    db.set('categories', categories);
    
    document.getElementById('newCategoryName').value = '';
    loadCategories();
}

function deleteCategory(id) {
    const products = db.get('products');
    const hasProducts = products.some(p => p.categoryId === id);
    
    if (hasProducts) {
        alert('لا يمكن حذف التصنيف لأن هناك منتجات مرتبطة به');
        return;
    }
    
    if (confirm('هل أنت متأكد من حذف هذا التصنيف؟')) {
        let categories = db.get('categories');
        categories = categories.filter(c => c.id !== id);
        db.set('categories', categories);
        loadCategories();
    }
}

function loadSuppliers() {
    const suppliers = db.get('suppliers');
    const select = document.getElementById('productSupplier');
    if (select) {
        select.innerHTML = '';
        suppliers.forEach(sup => {
            const option = document.createElement('option');
            option.value = sup.id;
            option.textContent = sup.name;
            select.appendChild(option);
        });
    }
}

function loadProducts(search = '', categoryId = '') {
    let products = db.get('products');
    const categories = db.get('categories');
    const suppliers = db.get('suppliers');

    if (search) {
        products = products.filter(p => 
            p.name.toLowerCase().includes(search.toLowerCase()) || 
            p.barcode.includes(search) ||
            p.code.includes(search)
        );
    }

    if (categoryId) {
        products = products.filter(p => p.categoryId === parseInt(categoryId));
    }

    const table = document.getElementById('productsTable');
    if (table) {
        table.innerHTML = '';
        products.forEach(product => {
            const category = categories.find(c => c.id === product.categoryId);
            const supplier = suppliers.find(s => s.id === product.supplierId);
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><img src="${product.image || 'https://via.placeholder.com/50'}" class="img-thumbnail" style="width: 50px; height:50px; object-fit:cover;"></td>
                <td>${product.code}</td>
                <td>${product.name}</td>
                <td>${category ? category.name : ''}</td>
                <td><svg id="barcode-${product.id}"></svg></td>
                <td>${formatCurrency(product.costPrice)}</td>
                <td>${formatCurrency(product.sellPrice)}</td>
                <td>${product.quantity}</td>
                <td>${supplier ? supplier.name : ''}</td>
                <td>
                    <button class="btn btn-sm btn-gold me-1" onclick="editProduct(${product.id})">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deleteProduct(${product.id})">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            `;
            table.appendChild(row);
            
            setTimeout(() => {
                try {
                    JsBarcode(`#barcode-${product.id}`, product.barcode, {
                        width: 1,
                        height: 30,
                        displayValue: false
                    });
                } catch(e) {}
            }, 100);
        });
    }
}

function editProduct(id) {
    const products = db.get('products');
    const product = products.find(p => p.id === id);
    if (product) {
        editingProductId = id;
        document.getElementById('productModalTitle').textContent = 'تعديل المنتج';
        document.getElementById('productId').value = id;
        document.getElementById('productName').value = product.name;
        document.getElementById('productCode').value = product.code;
        document.getElementById('productCategory').value = product.categoryId;
        document.getElementById('productSupplier').value = product.supplierId;
        document.getElementById('productCostPrice').value = product.costPrice;
        document.getElementById('productSellPrice').value = product.sellPrice;
        document.getElementById('productQuantity').value = product.quantity;
        
        const modal = new bootstrap.Modal(document.getElementById('productModal'));
        modal.show();
    }
}

function deleteProduct(id) {
    if (confirm('هل أنت متأكد من حذف هذا المنتج؟')) {
        let products = db.get('products');
        products = products.filter(p => p.id !== id);
        db.set('products', products);
        loadProducts();
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
    
    loadCategories();
    loadSuppliers();
    loadProducts();

    document.getElementById('searchProduct').addEventListener('input', (e) => {
        loadProducts(e.target.value, document.getElementById('filterCategory').value);
    });

    document.getElementById('filterCategory').addEventListener('change', (e) => {
        loadProducts(document.getElementById('searchProduct').value, e.target.value);
    });

    document.getElementById('productModal').addEventListener('hidden.bs.modal', () => {
        editingProductId = null;
        document.getElementById('productModalTitle').textContent = 'إضافة منتج جديد';
        document.getElementById('productForm').reset();
    });

    document.getElementById('productForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        let products = db.get('products');
        let imageData = null;
        
        const imageInput = document.getElementById('productImage');
        if (imageInput.files[0]) {
            imageData = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = (ev) => resolve(ev.target.result);
                reader.readAsDataURL(imageInput.files[0]);
            });
        }

        if (editingProductId) {
            products = products.map(p => {
                if (p.id === editingProductId) {
                    return {
                        ...p,
                        name: document.getElementById('productName').value,
                        code: document.getElementById('productCode').value,
                        categoryId: parseInt(document.getElementById('productCategory').value),
                        supplierId: parseInt(document.getElementById('productSupplier').value),
                        costPrice: parseFloat(document.getElementById('productCostPrice').value),
                        sellPrice: parseFloat(document.getElementById('productSellPrice').value),
                        quantity: parseInt(document.getElementById('productQuantity').value),
                        image: imageData || p.image
                    };
                }
                return p;
            });
        } else {
            const newProduct = {
                id: db.generateId('products'),
                name: document.getElementById('productName').value,
                code: document.getElementById('productCode').value,
                barcode: db.generateBarcode(),
                categoryId: parseInt(document.getElementById('productCategory').value),
                supplierId: parseInt(document.getElementById('productSupplier').value),
                costPrice: parseFloat(document.getElementById('productCostPrice').value),
                sellPrice: parseFloat(document.getElementById('productSellPrice').value),
                quantity: parseInt(document.getElementById('productQuantity').value),
                image: imageData,
                createdAt: new Date().toISOString()
            };
            products.push(newProduct);
            db.addStockMovement(newProduct.id, 'إضافة', newProduct.quantity, 'إضافة منتج جديد');
        }
        
        db.set('products', products);
        loadProducts();
        bootstrap.Modal.getInstance(document.getElementById('productModal')).hide();
    });

    document.getElementById('addCategoryBtn').addEventListener('click', addCategory);
    document.getElementById('newCategoryName').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addCategory();
    });
});

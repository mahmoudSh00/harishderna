function loadBarcodeProducts() {
    const products = db.get('products');
    const select = document.getElementById('barcodeProduct');
    if (select) {
        select.innerHTML = '';
        products.forEach(p => {
            const option = document.createElement('option');
            option.value = p.id;
            option.textContent = `${p.name} - ${p.barcode}`;
            select.appendChild(option);
        });
    }
}

function generateBarcodes() {
    const selectedOptions = document.getElementById('barcodeProduct').selectedOptions;
    const copies = parseInt(document.getElementById('barcodeCopies').value) || 1;
    const container = document.getElementById('barcodesPreview');
    container.innerHTML = '';
    
    const products = db.get('products');
    
    Array.from(selectedOptions).forEach(opt => {
        const product = products.find(p => p.id === parseInt(opt.value));
        for (let i = 0; i < copies; i++) {
            const col = document.createElement('div');
            col.className = 'col-md-3 col-sm-4 col-6';
            col.innerHTML = `
                <div class="card text-center p-2 mb-2">
                    <h6 class="mb-1">${product.name}</h6>
                    <svg id="barcode-gen-${product.id}-${i}"></svg>
                    <small>${product.barcode}</small>
                </div>
            `;
            container.appendChild(col);
            
            setTimeout(() => {
                try {
                    JsBarcode(`#barcode-gen-${product.id}-${i}`, product.barcode, {
                        width: 2,
                        height: 60,
                        fontSize: 14,
                        textMargin: 2
                    });
                } catch(e) {}
            }, 50);
        }
    });
    
    document.getElementById('printBarcodesDiv').classList.remove('d-none');
}

function loadBarcodesTable() {
    const products = db.get('products');
    const table = document.getElementById('barcodesTable');
    if (!table) return;
    table.innerHTML = '';
    
    products.forEach(p => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${p.name}</td>
            <td><svg id="barcode-table-${p.id}"></svg></td>
            <td>
                <button class="btn btn-sm btn-gold" onclick="printSingleBarcode(${p.id})">
                    <i class="bi bi-printer"></i>
                </button>
            </td>
        `;
        table.appendChild(row);
        
        setTimeout(() => {
            try {
                JsBarcode(`#barcode-table-${p.id}`, p.barcode, {
                    width: 1,
                    height: 40,
                    displayValue: false
                });
            } catch(e) {}
        }, 50);
    });
}

function printSingleBarcode(productId) {
    const products = db.get('products');
    const product = products.find(p => p.id === productId);
    if (!product) return;
    
    const printWindow = window.open('', '', 'width=400,height=300');
    printWindow.document.write(`
        <html>
            <head><title>طباعة باركود</title></head>
            <body style="text-align:center; padding:20px;">
                <h3>${product.name}</h3>
                <svg id="print-barcode"></svg>
                <p>${product.barcode}</p>
            </body>
            <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"><\/script>
            <script>
                window.onload = function() {
                    JsBarcode("#print-barcode", "${product.barcode}", {
                        width: 2,
                        height: 80,
                        fontSize: 16
                    });
                    window.print();
                    window.onafterprint = function() { window.close(); };
                }
            <\/script>
        </html>
    `);
    printWindow.document.close();
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
    
    loadBarcodeProducts();
    loadBarcodesTable();
    
    document.getElementById('generateBarcodesBtn').addEventListener('click', generateBarcodes);
    document.getElementById('printBarcodesBtn').addEventListener('click', () => {
        window.print();
    });
});

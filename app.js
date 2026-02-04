/* 
  مخازن النرجس – درنة
  تطبيق إدارة مخازن (HTML/CSS/JS فقط) مع تخزين البيانات في LocalStorage.
*/

(async () => {
  "use strict";

  /* =========================
     أدوات DOM بسيطة
  ========================= */

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const fmtDateTime = (iso) => {
    try {
      const d = new Date(iso);
      return new Intl.DateTimeFormat("ar-LY", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }).format(d);
    } catch {
      return iso || "";
    }
  };

  const fmtMoney = (n) => {
    const x = Number(n || 0);
    return x.toLocaleString("ar-LY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const escapeHtml = (s) =>
    String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  const clampNumber = (value, { min = 0, max = Number.POSITIVE_INFINITY } = {}) => {
    const n = Number(value);
    if (Number.isNaN(n)) return min;
    return Math.min(max, Math.max(min, n));
  };

  const genToken = () => {
    const buf = new Uint32Array(4);
    crypto.getRandomValues(buf);
    return Array.from(buf, (x) => x.toString(16).padStart(8, "0")).join("");
  };

  /* =========================
     Theme Management
  ========================= */
  
  const THEME_KEY = "nargisStore.theme";
  
  const applyTheme = (theme) => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(THEME_KEY, theme);
  };
  
  const loadTheme = () => {
    const savedTheme = localStorage.getItem(THEME_KEY) || "default";
    applyTheme(savedTheme);
    const themeSelector = $("#themeSelector");
    if (themeSelector) {
      themeSelector.value = savedTheme;
    }
  };
  
  /* =========================
     التخزين (LocalStorage + IndexedDB)
  ========================= */

  const DB_KEY = "nargisStore.v1";
  const DB_META_KEY = `${DB_KEY}.meta`;
  const IDB_NAME = "nargisStore";
  const IDB_STORE = "kv";
  const IDB_KEY = "db.v1";

  const defaultDb = () => {
    const now = new Date().toISOString();
    return {
      meta: {
        name: "مخازن النرجس – درنة",
        createdAt: now,
        counters: {
          product: 1,
          invoice: 1,
          issue: 1,
          return: 1,
          user: 2,
          driver: 1,
          audit: 1,
        },
      },
      session: {
        userId: null,
        token: null,
        loginAt: null,
      },
      users: [
        {
          id: "u1",
          username: "مالك",
          password: "1234554321",
          role: "owner",
          createdAt: now,
          lastLoginAt: null,
        },
      ],
      products: [],
      drivers: [],
      invoices: [],
      issues: [],
      audits: [],
      returns: [],
    };
  };

  const openIdb = () =>
    new Promise((resolve, reject) => {
      if (!("indexedDB" in window)) return reject(new Error("IndexedDB not supported"));
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const dbx = req.result;
        if (!dbx.objectStoreNames.contains(IDB_STORE)) dbx.createObjectStore(IDB_STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error("IndexedDB open failed"));
    });

  const idbGet = async (key) => {
    try {
      const dbx = await openIdb();
      return await new Promise((resolve, reject) => {
        const tx = dbx.transaction(IDB_STORE, "readonly");
        const store = tx.objectStore(IDB_STORE);
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result ?? null);
        req.onerror = () => reject(req.error || new Error("IndexedDB get failed"));
        tx.oncomplete = () => dbx.close();
        tx.onerror = () => dbx.close();
      });
    } catch {
      return null;
    }
  };

  const idbSet = async (key, value) => {
    try {
      const dbx = await openIdb();
      return await new Promise((resolve, reject) => {
        const tx = dbx.transaction(IDB_STORE, "readwrite");
        const store = tx.objectStore(IDB_STORE);
        const req = store.put(value, key);
        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error || new Error("IndexedDB put failed"));
        tx.oncomplete = () => dbx.close();
        tx.onerror = () => dbx.close();
      });
    } catch {
      return false;
    }
  };

  const idbDel = async (key) => {
    try {
      const dbx = await openIdb();
      return await new Promise((resolve, reject) => {
        const tx = dbx.transaction(IDB_STORE, "readwrite");
        const store = tx.objectStore(IDB_STORE);
        const req = store.delete(key);
        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error || new Error("IndexedDB delete failed"));
        tx.oncomplete = () => dbx.close();
        tx.onerror = () => dbx.close();
      });
    } catch {
      return false;
    }
  };

  const isDbShapeValid = (parsed) => {
    if (!parsed || typeof parsed !== "object") return false;
    if (!parsed.meta || typeof parsed.meta !== "object") return false;
    if (!parsed.meta.counters || typeof parsed.meta.counters !== "object") return false;
    if (!parsed.session || typeof parsed.session !== "object") return false;
    if (!Array.isArray(parsed.users)) return false;
    if (!Array.isArray(parsed.products)) return false;
    if (!Array.isArray(parsed.drivers)) return false;
    if (!Array.isArray(parsed.invoices)) return false;
    if (!Array.isArray(parsed.issues)) return false;
    if (!Array.isArray(parsed.audits)) return false;
    if (!Array.isArray(parsed.returns ?? [])) return false;
    return true;
  };

  const Storage = {
    async load() {
      const idbRaw = await idbGet(IDB_KEY);
      if (typeof idbRaw === "string" && idbRaw) {
        try {
          const parsed = JSON.parse(idbRaw);
          if (isDbShapeValid(parsed)) return parsed;
        } catch {}
      }

      const raw = localStorage.getItem(DB_KEY);
      if (!raw) return defaultDb();
      try {
        const parsed = JSON.parse(raw);
        if (!isDbShapeValid(parsed)) return defaultDb();
        await idbSet(IDB_KEY, JSON.stringify(parsed));
        try {
          localStorage.setItem(DB_META_KEY, JSON.stringify({ mode: "idb", migratedAt: new Date().toISOString() }));
        } catch {}
        return parsed;
      } catch {
        return defaultDb();
      }
    },
    async save(dbToSave) {
      const raw = JSON.stringify(dbToSave);
      const idbOk = await idbSet(IDB_KEY, raw);
      try {
        localStorage.setItem(DB_KEY, raw);
        localStorage.setItem(DB_META_KEY, JSON.stringify({ mode: idbOk ? "idb" : "ls", updatedAt: new Date().toISOString() }));
      } catch {
        try {
          localStorage.removeItem(DB_KEY);
          localStorage.setItem(DB_META_KEY, JSON.stringify({ mode: "idb", updatedAt: new Date().toISOString() }));
        } catch {}
      }
      return idbOk;
    },
    async reset() {
      try {
        localStorage.removeItem(DB_KEY);
        localStorage.removeItem(DB_META_KEY);
      } catch {}
      await idbDel(IDB_KEY);
    },
  };

  let db = await Storage.load();

  const persist = () => Storage.save(db);

  const nextId = (type, prefix) => {
    const n = db.meta.counters[type] || 1;
    db.meta.counters[type] = n + 1;
    persist();
    return `${prefix}${n}`;
  };

  /* =========================
     صلاحيات وحالة المستخدم
  ========================= */

  const getCurrentUser = () => db.users.find((u) => u.id === db.session.userId) || null;
  const isOwner = () => getCurrentUser()?.role === "owner";

  const requireAuth = () => {
    const user = getCurrentUser();
    if (!user || !db.session.token) {
      showLogin();
      return false;
    }
    return true;
  };

  /* =========================
     مكونات الواجهة الأساسية
  ========================= */

  const viewLogin = $("#view-login");
  const viewShell = $("#view-shell");

  const sidebar = $("#sidebar");
  const btnToggleNav = $("#btnToggleNav");
  const btnLogout = $("#btnLogout");
  const topbarMeta = $("#topbarMeta");

  const btnBackupDownload = $("#btnBackupDownload");
  const btnBackupRestore = $("#btnBackupRestore");
  const backupFile = $("#backupFile");
  const btnPrintLatestIssue = $("#btnPrintLatestIssue");
  const btnPrintAudit = $("#btnPrintAudit");

  const loginForm = $("#loginForm");
  const loginError = $("#loginError");

  const modal = $("#modal");
  const modalTitle = $("#modalTitle");
  const modalBody = $("#modalBody");

  const showLoginError = (msg) => {
    loginError.textContent = msg;
    loginError.classList.remove("hidden");
  };

  const clearLoginError = () => {
    loginError.textContent = "";
    loginError.classList.add("hidden");
  };

  const showLogin = () => {
    viewShell.classList.remove("view--active");
    viewShell.classList.add("view");
    viewLogin.classList.add("view--active");
    viewLogin.classList.remove("view");
    closeModal();
    clearLoginError();
    $("#loginPassword").value = "";
  };

  const showApp = () => {
    viewLogin.classList.remove("view--active");
    viewLogin.classList.add("view");
    viewShell.classList.add("view--active");
    viewShell.classList.remove("view");
    closeModal();
    renderAll();
    routeFromHash();
  };

  const openModal = (title, bodyEl) => {
    modalTitle.textContent = title;
    modalBody.innerHTML = "";
    modalBody.appendChild(bodyEl);
    modal.classList.remove("hidden");
  };

  const closeModal = () => {
    modal.classList.add("hidden");
    modalTitle.textContent = "";
    modalBody.innerHTML = "";
  };

  modal.addEventListener("click", (e) => {
    const target = e.target;
    if (target && (target.matches("[data-close]") || target.closest("[data-close]"))) closeModal();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal.classList.contains("hidden")) closeModal();
  });

  btnToggleNav.addEventListener("click", () => {
    sidebar.classList.toggle("sidebar--open");
  });

  const closeSidebarOnMobile = () => {
    if (window.matchMedia("(max-width: 980px)").matches) sidebar.classList.remove("sidebar--open");
  };

  window.addEventListener("hashchange", () => {
    routeFromHash();
  });

  btnLogout.addEventListener("click", () => {
    db.session.userId = null;
    db.session.token = null;
    db.session.loginAt = null;
    persist();
    showLogin();
  });

  /* =========================
     نظام الدخول (Login System)
  ========================= */

  loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    clearLoginError();

    const username = $("#loginUsername").value.trim();
    const password = $("#loginPassword").value;

    const user = db.users.find((u) => u.username === username);
    if (!user || user.password !== password) {
      showLoginError("بيانات الدخول غير صحيحة.");
      return;
    }

    db.session.userId = user.id;
    db.session.token = genToken();
    db.session.loginAt = new Date().toISOString();
    user.lastLoginAt = db.session.loginAt;
    persist();
    showApp();
  });

  /* =========================
     Router بسيط (Hash Router)
  ========================= */

  const routes = ["dashboard", "products", "drivers", "issue", "sales", "purchases", "returns", "audit", "users"];

  const setActiveRoute = (route) => {
    for (const r of routes) {
      const el = $(`#route-${r}`);
      if (!el) continue;
      el.classList.toggle("route--active", r === route);
    }

    for (const item of $$(".nav__item")) {
      item.classList.toggle("nav__item--active", item.dataset.route === route);
    }

    closeSidebarOnMobile();
  };

  const routeFromHash = () => {
    if (!requireAuth()) return;

    const raw = (location.hash || "#/dashboard").replace("#/", "");
    const route = routes.includes(raw) ? raw : "dashboard";

    if (route === "users" && !isOwner()) {
      location.hash = "#/dashboard";
      return;
    }

    setActiveRoute(route);
    renderRoute(route);
  };

  /* =========================
     باركود Code39 (بدون مكتبات)
  ========================= */

  const CODE39 = {
    "0": "nnnwwnwnn",
    "1": "wnnwnnnnw",
    "2": "nnwwnnnnw",
    "3": "wnwwnnnnn",
    "4": "nnnwwnnnw",
    "5": "wnnwwnnnn",
    "6": "nnwwwnnnn",
    "7": "nnnwnnwnw",
    "8": "wnnwnnwnn",
    "9": "nnwwnnwnn",
    A: "wnnnnwnnw",
    B: "nnwnnwnnw",
    C: "wnwnnwnnn",
    D: "nnnnwwnnw",
    E: "wnnnwwnnn",
    F: "nnwnwwnnn",
    G: "nnnnnwwnw",
    H: "wnnnnwwnn",
    I: "nnwnnwwnn",
    J: "nnnnwwwnn",
    K: "wnnnnnnww",
    L: "nnwnnnnww",
    M: "wnwnnnnwn",
    N: "nnnnwnnww",
    O: "wnnnwnnwn",
    P: "nnwnwnnwn",
    Q: "nnnnnnwww",
    R: "wnnnnnwwn",
    S: "nnwnnnwwn",
    T: "nnnnwnwwn",
    U: "wwnnnnnnw",
    V: "nwwnnnnnw",
    W: "wwwnnnnnn",
    X: "nwnnwnnnw",
    Y: "wwnnwnnnn",
    Z: "nwwnwnnnn",
    "-": "nwnnnnwnw",
    ".": "wwnnnnwnn",
    " ": "nwwnnnwnn",
    $: "nwnwnwnnn",
    "/": "nwnwnnnwn",
    "+": "nwnnnwnwn",
    "%": "nnnwnwnwn",
    "*": "nwnnwnwnn",
  };

  const toCode39Safe = (value) =>
    String(value ?? "")
      .toUpperCase()
      .replace(/[^0-9A-Z\-\.\s\$\/\+\%]/g, "");

  const renderCode39Svg = (svgEl, rawValue) => {
    const value = toCode39Safe(rawValue);
    const full = `*${value}*`;

    while (svgEl.firstChild) svgEl.removeChild(svgEl.firstChild);

    const quiet = 10;
    const narrow = 2;
    const wide = 5;
    const height = 52;
    const y = 9;
    const textY = 67;
    let x = quiet;

    const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    bg.setAttribute("x", "0");
    bg.setAttribute("y", "0");
    bg.setAttribute("width", "240");
    bg.setAttribute("height", "70");
    bg.setAttribute("fill", "#fff");
    svgEl.appendChild(bg);

    for (let i = 0; i < full.length; i++) {
      const ch = full[i];
      const pattern = CODE39[ch];
      if (!pattern) continue;

      for (let j = 0; j < pattern.length; j++) {
        const isBar = j % 2 === 0;
        const w = pattern[j] === "w" ? wide : narrow;
        if (isBar) {
          const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
          rect.setAttribute("x", String(x));
          rect.setAttribute("y", String(y));
          rect.setAttribute("width", String(w));
          rect.setAttribute("height", String(height));
          rect.setAttribute("fill", "#000");
          svgEl.appendChild(rect);
        }
        x += w;
      }

      x += narrow;
    }

    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    label.setAttribute("x", "120");
    label.setAttribute("y", String(textY));
    label.setAttribute("text-anchor", "middle");
    label.setAttribute("font-size", "10");
    label.setAttribute("fill", "#000");
    label.textContent = value;
    svgEl.appendChild(label);
  };

  const newBarcodeValue = () => {
    const n = db.meta.counters.product || 1;
    return `NAR-${String(n).padStart(6, "0")}`;
  };

  /* =========================
     Rendering (تحديث الواجهة)
  ========================= */

  const renderTopbar = () => {
    const user = getCurrentUser();
    const roleName = user?.role === "owner" ? "مالك" : "موظف";
    topbarMeta.textContent = user ? `المستخدم: ${user.username} • الدور: ${roleName}` : "";

    for (const el of $$(".nav__item--owner")) {
      el.classList.toggle("hidden", !isOwner());
    }
  };

  const renderDashboard = () => {
    $("#kpiProducts").textContent = String(db.products.length);
    $("#kpiInvoices").textContent = String(db.invoices.length);
    const totalSales = db.invoices.reduce((sum, inv) => sum + Number(inv.total || 0), 0);
    $("#kpiSales").textContent = fmtMoney(totalSales);

    const tbody = $("#dashboardInvoices");
    tbody.innerHTML = "";

    const latest = [...db.invoices].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")).slice(0, 6);
    for (const inv of latest) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(inv.no)}</td>
        <td>${escapeHtml(fmtDateTime(inv.createdAt))}</td>
        <td>${escapeHtml(inv.customerName || "زبون نقدي")}</td>
        <td>${escapeHtml(fmtMoney(inv.total))}</td>
        <td class="actions">
          <button class="btn btn--ghost" data-action="viewInvoice" data-id="${escapeHtml(inv.id)}">عرض</button>
          <button class="btn btn--ghost" data-action="printInvoice" data-id="${escapeHtml(inv.id)}">طباعة</button>
        </td>
      `;
      tbody.appendChild(tr);
    }

    if (!latest.length) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="5" class="muted">لا توجد فواتير بعد.</td>`;
      tbody.appendChild(tr);
    }
  };

  const renderProducts = () => {
    const q = $("#productsSearch").value.trim().toLowerCase();
    const tbody = $("#productsTbody");
    tbody.innerHTML = "";

    const items = db.products
      .filter((p) => {
        if (!q) return true;
        return (
          String(p.name || "").toLowerCase().includes(q) ||
          String(p.sku || "").toLowerCase().includes(q) ||
          String(p.barcode || "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));

    for (const p of items) {
      const category = PRODUCT_CATEGORIES.find(c => c.id === p.category) || { name: "غير محدد" };
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(p.name)}</td>
        <td>${escapeHtml(p.sku)}</td>
        <td>
          <div class="badge">${escapeHtml(p.barcode || "")}</div>
        </td>
        <td><span class="badge">${escapeHtml(category.name)}</span></td>
        <td>${escapeHtml(p.qty)}</td>
        <td>${escapeHtml(fmtMoney(p.price))}</td>
        <td class="actions">
          <button class="btn btn--ghost" data-action="barcodeProduct" data-id="${escapeHtml(p.id)}">باركود</button>
          <button class="btn btn--ghost" data-action="editProduct" data-id="${escapeHtml(p.id)}">تعديل</button>
          <button class="btn btn--ghost" data-action="printItemAudit" data-id="${escapeHtml(p.id)}">جرد</button>
          <button class="btn btn--danger" data-action="deleteProduct" data-id="${escapeHtml(p.id)}">حذف</button>
        </td>
      `;
      tbody.appendChild(tr);
    }

    if (!items.length) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="7" class="muted">لا توجد منتجات مطابقة.</td>`;
      tbody.appendChild(tr);
    }
  };

  const renderDrivers = () => {
    const tbody = $("#driversTbody");
    tbody.innerHTML = "";

    for (const d of [...db.drivers].sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")))) {
      const issueCount = db.issues.filter((x) => x.driverId === d.id).length;
      const invCount = db.invoices.filter((x) => x.driverId === d.id).length;
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(d.name)}</td>
        <td><span class="badge">${issueCount}</span></td>
        <td><span class="badge">${invCount}</span></td>
        <td class="actions">
          <button class="btn btn--ghost" data-action="editDriver" data-id="${escapeHtml(d.id)}">تعديل</button>
          <button class="btn btn--danger" data-action="deleteDriver" data-id="${escapeHtml(d.id)}">حذف</button>
        </td>
      `;
      tbody.appendChild(tr);
    }

    if (!db.drivers.length) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="4" class="muted">لم يتم إضافة سائقين بعد.</td>`;
      tbody.appendChild(tr);
    }
  };

  const renderIssues = () => {
    const tbody = $("#issuesTbody");
    tbody.innerHTML = "";

    const list = [...db.issues].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    for (const it of list) {
      const driver = db.drivers.find((d) => d.id === it.driverId);
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(it.no)}</td>
        <td>${escapeHtml(fmtDateTime(it.createdAt))}</td>
        <td>${escapeHtml(driver?.name || "-")}</td>
        <td><span class="badge">${it.items?.length || 0}</span></td>
        <td class="actions">
          <button class="btn btn--ghost" data-action="editIssue" data-id="${escapeHtml(it.id)}">تعديل</button>
          <button class="btn btn--ghost" data-action="viewIssue" data-id="${escapeHtml(it.id)}">عرض</button>
          <button class="btn btn--ghost" data-action="printIssue" data-id="${escapeHtml(it.id)}">طباعة</button>
        </td>
      `;
      tbody.appendChild(tr);
    }

    if (!list.length) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="5" class="muted">لا توجد أذونات صرف بعد.</td>`;
      tbody.appendChild(tr);
    }
  };

  const renderInvoices = () => {
    const tbody = $("#invoicesTbody");
    tbody.innerHTML = "";

    const list = [...db.invoices].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    for (const inv of list) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(inv.no)}</td>
        <td>${escapeHtml(fmtDateTime(inv.createdAt))}</td>
        <td>${escapeHtml(inv.customerName || "زبون نقدي")}</td>
        <td>${escapeHtml(fmtMoney(inv.total))}</td>
        <td class="actions">
          <button class="btn btn--ghost" data-action="viewInvoice" data-id="${escapeHtml(inv.id)}">عرض</button>
          <button class="btn btn--ghost" data-action="printInvoice" data-id="${escapeHtml(inv.id)}">طباعة</button>
          <button class="btn btn--danger" data-action="deleteInvoice" data-id="${escapeHtml(inv.id)}">حذف</button>
        </td>
      `;
      tbody.appendChild(tr);
    }

    if (!list.length) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="5" class="muted">لا توجد فواتير بعد.</td>`;
      tbody.appendChild(tr);
    }
  };

  const renderAudit = () => {
    const tbody = $("#auditTbody");
    tbody.innerHTML = "";

    for (const p of [...db.products].sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")))) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(p.name)}</td>
        <td><span class="badge">${escapeHtml(p.barcode || "")}</span></td>
        <td>${escapeHtml(p.qty)}</td>
        <td>
          <input class="input input--sm" inputmode="numeric" data-audit-actual="${escapeHtml(p.id)}" placeholder="اكتب..." />
        </td>
        <td id="auditDiff-${escapeHtml(p.id)}" class="muted">-</td>
        <td class="actions">
          <button class="btn btn--ghost" data-action="printItemAudit" data-id="${escapeHtml(p.id)}">جرد فردي</button>
        </td>
      `;
      tbody.appendChild(tr);
    }

    if (!db.products.length) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="6" class="muted">لا توجد منتجات للجرد.</td>`;
      tbody.appendChild(tr);
    }

    for (const input of $$("[data-audit-actual]")) {
      input.addEventListener("input", () => {
        const pid = input.getAttribute("data-audit-actual");
        const p = db.products.find((x) => x.id === pid);
        const systemQty = Number(p?.qty || 0);
        const actualStr = input.value.trim();
        const cell = $(`#auditDiff-${CSS.escape(pid)}`);
        if (!actualStr) {
          cell.textContent = "-";
          cell.classList.add("muted");
          cell.classList.remove("badge--danger");
          return;
        }
        const actual = clampNumber(actualStr, { min: 0 });
        const diff = actual - systemQty;
        cell.textContent = diff === 0 ? "0" : String(diff);
        cell.classList.toggle("muted", diff === 0);
      });
    }

    const logTbody = $("#auditLogTbody");
    logTbody.innerHTML = "";

    const audits = [...db.audits].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    for (const a of audits) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(a.no)}</td>
        <td>${escapeHtml(fmtDateTime(a.createdAt))}</td>
        <td><span class="badge">${a.lines?.length || 0}</span></td>
        <td class="actions">
          <button class="btn btn--ghost" data-action="viewAudit" data-id="${escapeHtml(a.id)}">عرض</button>
          <button class="btn btn--ghost" data-action="printAudit" data-id="${escapeHtml(a.id)}">طباعة</button>
        </td>
      `;
      logTbody.appendChild(tr);
    }

    if (!audits.length) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="4" class="muted">لا يوجد سجل جرد بعد.</td>`;
      logTbody.appendChild(tr);
    }
  };

  const renderUsers = () => {
    const tbody = $("#usersTbody");
    tbody.innerHTML = "";

    for (const u of [...db.users].sort((a, b) => String(a.username || "").localeCompare(String(b.username || "")))) {
      const roleName = u.role === "owner" ? "مالك" : "موظف";
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(u.username)}</td>
        <td><span class="badge">${escapeHtml(roleName)}</span></td>
        <td>${escapeHtml(u.lastLoginAt ? fmtDateTime(u.lastLoginAt) : "-")}</td>
        <td class="actions">
          <button class="btn btn--ghost" data-action="editUser" data-id="${escapeHtml(u.id)}">تعديل</button>
          <button class="btn btn--danger" data-action="deleteUser" data-id="${escapeHtml(u.id)}" ${
            u.id === "u1" ? "disabled" : ""
          }>حذف</button>
        </td>
      `;
      tbody.appendChild(tr);
    }
  };

  const renderAll = () => {
    renderTopbar();
    renderDashboard();
    renderProducts();
    renderDrivers();
    renderIssues();
    renderInvoices();
    renderAudit();
    if (isOwner()) renderUsers();
  };

  const renderRoute = (route) => {
    if (route === "dashboard") renderDashboard();
    if (route === "products") renderProducts();
    if (route === "drivers") renderDrivers();
    if (route === "issue") renderIssues();
    if (route === "sales") renderInvoices();
    if (route === "purchases") renderPurchases();
    if (route === "returns") renderReturns();
    if (route === "audit") renderAudit();
    if (route === "users") renderUsers();
  };

  /* =========================
     وظائف CRUD: المنتجات
  ========================= */

  const confirmDialog = (title, message, onConfirm) => {
    const wrap = document.createElement("div");
    wrap.innerHTML = `
      <div class="two-col">
        <div>
          <div class="muted">${escapeHtml(message)}</div>
        </div>
      </div>
      <div class="hr"></div>
      <div class="actions">
        <button class="btn btn--ghost" type="button" data-cancel>إلغاء</button>
        <button class="btn btn--danger" type="button" data-ok>تأكيد</button>
      </div>
    `;
    const btnOk = $("[data-ok]", wrap);
    const btnCancel = $("[data-cancel]", wrap);
    btnCancel.addEventListener("click", closeModal);
    btnOk.addEventListener("click", () => {
      closeModal();
      onConfirm();
    });
    openModal(title, wrap);
  };

  // Product categories
  const PRODUCT_CATEGORIES = [
    { id: "roll", name: "رول" },
    { id: "ajami", name: "عجمي" },
    { id: "furniture", name: "مفروشات" },
    { id: "home", name: "منزلية" },
    { id: "furniture", name: "اثاث" },
    { id: "other", name: "أخرى" }
  ];

  const productForm = (initial, onSave) => {
    const p = initial || {
      id: null,
      name: "",
      sku: "",
      barcode: "",
      qty: 0,
      price: 0,
      category: "other"
    };

    const wrap = document.createElement("div");
    wrap.innerHTML = `
      <form class="form" id="productForm">
        <div class="two-col">
          <div class="form__row">
            <label class="label" for="pName">اسم المنتج</label>
            <input id="pName" class="input" required />
          </div>
          <div class="form__row">
            <label class="label" for="pSku">رقم الصنف</label>
            <input id="pSku" class="input" required />
          </div>
        </div>
        
        <div class="form__row">
          <label class="label" for="pCategory">التصنيف</label>
          <select id="pCategory" class="select" required>
            ${PRODUCT_CATEGORIES.map(cat => 
              `<option value="${cat.id}" ${p.category === cat.id ? "selected" : ""}>${cat.name}</option>`
            ).join("")}
          </select>
        </div>

        <div class="three-col">
          <div class="form__row">
            <label class="label" for="pQty">الكمية</label>
            <input id="pQty" class="input" inputmode="numeric" required />
          </div>
          <div class="form__row">
            <label class="label" for="pPrice">سعر البيع</label>
            <input id="pPrice" class="input" inputmode="decimal" required />
          </div>
          <div class="form__row">
            <label class="label" for="pBarcode">باركود</label>
            <input id="pBarcode" class="input" placeholder="اتركه فارغًا لتوليده تلقائيًا" />
          </div>
        </div>

        <div class="two-col">
          <div class="card" style="padding:12px;">
            <div class="muted" style="font-weight:800; margin-bottom:8px;">معاينة الباركود</div>
            <div id="barcodePreview"></div>
          </div>
          <div class="card" style="padding:12px;">
            <div class="muted" style="font-weight:800; margin-bottom:8px;">ملاحظات</div>
            <div class="muted">
              قارئ الباركود عادة يعمل كلوحة مفاتيح ويُرسل الكود ثم Enter. استخدم نفس القيمة في الفواتير/الصرف.
            </div>
          </div>
        </div>

        <div class="hr"></div>
        <div class="actions">
          <button class="btn btn--ghost" type="button" data-cancel>إلغاء</button>
          <button class="btn btn--primary" type="submit">حفظ</button>
        </div>
        <div id="pError" class="alert alert--danger hidden" role="alert"></div>
      </form>
    `;

    const form = $("#productForm", wrap);
    const pName = $("#pName", wrap);
    const pSku = $("#pSku", wrap);
    const pCategory = $("#pCategory", wrap);
    const pQty = $("#pQty", wrap);
    const pPrice = $("#pPrice", wrap);
    const pBarcode = $("#pBarcode", wrap);
    const pError = $("#pError", wrap);
    const preview = $("#barcodePreview", wrap);

    const showError = (msg) => {
      pError.textContent = msg;
      pError.classList.remove("hidden");
    };

    const hideError = () => {
      pError.textContent = "";
      pError.classList.add("hidden");
    };

    const drawPreview = (value) => {
      preview.innerHTML = "";
      const tpl = $("#tplBarcode");
      const node = tpl.content.firstElementChild.cloneNode(true);
      renderCode39Svg(node, value);
      preview.appendChild(node);
    };

    pName.value = p.name;
    pSku.value = p.sku;
    pCategory.value = p.category || "other";
    pQty.value = String(p.qty ?? 0);
    pPrice.value = String(p.price ?? 0);
    pBarcode.value = p.barcode || "";

    drawPreview(pBarcode.value || newBarcodeValue());

    pBarcode.addEventListener("input", () => {
      drawPreview(pBarcode.value || newBarcodeValue());
    });

    $("[data-cancel]", wrap).addEventListener("click", closeModal);

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      hideError();

      const name = pName.value.trim();
      const sku = pSku.value.trim();
      const category = pCategory.value;
      const qty = clampNumber(pQty.value, { min: 0 });
      const price = clampNumber(pPrice.value, { min: 0 });
      const barcode = (pBarcode.value.trim() || newBarcodeValue()).toUpperCase();

      if (!name) return showError("اسم المنتج مطلوب.");
      if (!sku) return showError("رقم الصنف مطلوب.");
      if (!barcode) return showError("الباركود مطلوب.");

      const barcodeExists = db.products.some((x) => x.barcode === barcode && x.id !== p.id);
      if (barcodeExists) return showError("هذا الباركود مستخدم لمنتج آخر.");

      onSave({ ...p, name, sku, category, qty, price, barcode });
    });

    return wrap;
  };

  const openAddProduct = () => {
    openModal(
      "إضافة منتج",
      productForm(null, (data) => {
        const id = nextId("product", "p");
        const now = new Date().toISOString();
        db.products.push({ ...data, id, createdAt: now, updatedAt: now });
        persist();
        closeModal();
        renderProducts();
      })
    );
  };

  const openEditProduct = (id) => {
    const p = db.products.find((x) => x.id === id);
    if (!p) return;
    openModal(
      "تعديل منتج",
      productForm(p, (data) => {
        const idx = db.products.findIndex((x) => x.id === id);
        if (idx === -1) return;
        db.products[idx] = { ...db.products[idx], ...data, updatedAt: new Date().toISOString() };
        persist();
        closeModal();
        renderProducts();
        renderAudit();
      })
    );
  };

  const deleteProduct = (id) => {
    const p = db.products.find((x) => x.id === id);
    if (!p) return;

    const usedInInvoices = db.invoices.some((inv) => inv.items?.some((it) => it.productId === id));
    const usedInIssues = db.issues.some((isr) => isr.items?.some((it) => it.productId === id));
    if (usedInInvoices || usedInIssues) {
      confirmDialog("تنبيه", "هذا المنتج مرتبط بسجلات (فواتير/صرف). حذف المنتج سيؤثر على التقارير. المتابعة؟", () => {
        db.products = db.products.filter((x) => x.id !== id);
        persist();
        renderProducts();
        renderAudit();
      });
      return;
    }

    confirmDialog("حذف منتج", `حذف المنتج: ${p.name}؟`, () => {
      db.products = db.products.filter((x) => x.id !== id);
      persist();
      renderProducts();
      renderAudit();
    });
  };

  const showProductBarcode = (id) => {
    const p = db.products.find((x) => x.id === id);
    if (!p) return;
    const wrap = document.createElement("div");
    wrap.innerHTML = `
      <div class="two-col">
        <div>
          <div class="badge">اسم المنتج: ${escapeHtml(p.name)}</div>
          <div style="height:10px;"></div>
          <div class="badge">باركود: ${escapeHtml(p.barcode || "")}</div>
          <div style="height:10px;"></div>
          <button class="btn btn--ghost" type="button" data-copy>نسخ الباركود</button>
        </div>
        <div id="barcodeBox"></div>
      </div>
    `;
    const box = $("#barcodeBox", wrap);
    const tpl = $("#tplBarcode");
    const node = tpl.content.firstElementChild.cloneNode(true);
    renderCode39Svg(node, p.barcode);
    box.appendChild(node);

    $("[data-copy]", wrap).addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(p.barcode || "");
      } catch {
        // تجاهل في حال عدم توفر الصلاحية
      }
    });

    openModal("باركود المنتج", wrap);
  };

  /* =========================
     وظائف CRUD: السائقين
  ========================= */

  const driverForm = (initial, onSave) => {
    const d = initial || { id: null, name: "" };
    const wrap = document.createElement("div");
    wrap.innerHTML = `
      <form class="form" id="driverForm">
        <div class="form__row">
          <label class="label" for="dName">اسم السائق</label>
          <input id="dName" class="input" required />
        </div>
        <div class="hr"></div>
        <div class="actions">
          <button class="btn btn--ghost" type="button" data-cancel>إلغاء</button>
          <button class="btn btn--primary" type="submit">حفظ</button>
        </div>
        <div id="dError" class="alert alert--danger hidden" role="alert"></div>
      </form>
    `;

    const form = $("#driverForm", wrap);
    const dName = $("#dName", wrap);
    const dError = $("#dError", wrap);

    dName.value = d.name || "";

    const showError = (msg) => {
      dError.textContent = msg;
      dError.classList.remove("hidden");
    };
    const hideError = () => {
      dError.textContent = "";
      dError.classList.add("hidden");
    };

    $("[data-cancel]", wrap).addEventListener("click", closeModal);
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      hideError();
      const name = dName.value.trim();
      if (!name) return showError("اسم السائق مطلوب.");
      const exists = db.drivers.some((x) => x.name === name && x.id !== d.id);
      if (exists) return showError("اسم السائق موجود بالفعل.");
      onSave({ ...d, name });
    });

    return wrap;
  };

  const openAddDriver = () => {
    openModal(
      "إضافة سائق",
      driverForm(null, (data) => {
        const id = nextId("driver", "d");
        db.drivers.push({ ...data, id, createdAt: new Date().toISOString() });
        persist();
        closeModal();
        renderDrivers();
      })
    );
  };

  const openEditDriver = (id) => {
    const d = db.drivers.find((x) => x.id === id);
    if (!d) return;
    openModal(
      "تعديل سائق",
      driverForm(d, (data) => {
        const idx = db.drivers.findIndex((x) => x.id === id);
        if (idx === -1) return;
        db.drivers[idx] = { ...db.drivers[idx], ...data };
        persist();
        closeModal();
        renderDrivers();
      })
    );
  };

  const deleteDriver = (id) => {
    const d = db.drivers.find((x) => x.id === id);
    if (!d) return;
    const used = db.issues.some((x) => x.driverId === id) || db.invoices.some((x) => x.driverId === id);
    if (used) {
      confirmDialog("لا يمكن الحذف", "هذا السائق مرتبط بسجلات (فواتير/صرف). يمكنك تعديل الاسم بدلًا من الحذف.", () => {});
      return;
    }
    confirmDialog("حذف سائق", `حذف السائق: ${d.name}؟`, () => {
      db.drivers = db.drivers.filter((x) => x.id !== id);
      persist();
      renderDrivers();
    });
  };

  /* =========================
     أدوات مشتركة: المنتجات في السلة (فاتورة/صرف)
  ========================= */

  const findProductByBarcode = (barcode) => {
    const b = String(barcode || "").trim().toUpperCase();
    if (!b) return null;
    return db.products.find((p) => String(p.barcode || "").toUpperCase() === b) || null;
  };

  const toLineTotal = (line) => Number(line.qty || 0) * Number(line.price || 0);

  const buildLinesTable = ({ lines, onChange, allowPrice }) => {
    const wrap = document.createElement("div");
    wrap.innerHTML = `
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>المنتج</th>
              <th>الباركود</th>
              <th>المتاح</th>
              <th>الكمية</th>
              <th>${allowPrice ? "السعر" : "السعر (من المنتج)"}</th>
              <th>الإجمالي</th>
              <th></th>
            </tr>
          </thead>
          <tbody id="linesTbody"></tbody>
        </table>
      </div>
    `;

    const tbody = $("#linesTbody", wrap);

    const render = () => {
      tbody.innerHTML = "";
      for (const line of lines) {
        const p = db.products.find((x) => x.id === line.productId);
        const available = Number(p?.qty || 0);
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${escapeHtml(p?.name || "-")}</td>
          <td><span class="badge">${escapeHtml(p?.barcode || "")}</span></td>
          <td>${escapeHtml(available)}</td>
          <td>
            <input class="input input--sm" inputmode="numeric" data-qty="${escapeHtml(line.productId)}" value="${escapeHtml(
          line.qty
        )}" />
          </td>
          <td>
            <input class="input input--sm" inputmode="decimal" data-price="${escapeHtml(line.productId)}" value="${escapeHtml(
          line.price
        )}" ${allowPrice ? "" : "disabled"} />
          </td>
          <td>${escapeHtml(fmtMoney(toLineTotal(line)))}</td>
          <td class="actions">
            <button class="btn btn--danger" type="button" data-remove="${escapeHtml(line.productId)}">حذف</button>
          </td>
        `;
        tbody.appendChild(tr);
      }

      if (!lines.length) {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td colspan="7" class="muted">لم يتم إضافة أصناف بعد.</td>`;
        tbody.appendChild(tr);
      }

      for (const inp of $$("[data-qty]", tbody)) {
        inp.addEventListener("input", () => {
          const pid = inp.getAttribute("data-qty");
          const line = lines.find((x) => x.productId === pid);
          if (!line) return;
          line.qty = clampNumber(inp.value, { min: 1 });
          onChange();
          render();
        });
      }

      for (const inp of $$("[data-price]", tbody)) {
        inp.addEventListener("input", () => {
          const pid = inp.getAttribute("data-price");
          const line = lines.find((x) => x.productId === pid);
          if (!line) return;
          line.price = clampNumber(inp.value, { min: 0 });
          onChange();
          render();
        });
      }

      for (const btn of $$("[data-remove]", tbody)) {
        btn.addEventListener("click", () => {
          const pid = btn.getAttribute("data-remove");
          const idx = lines.findIndex((x) => x.productId === pid);
          if (idx !== -1) lines.splice(idx, 1);
          onChange();
          render();
        });
      }
    };

    render();
    return { el: wrap, rerender: render };
  };

  const checkStockForLines = (lines) => {
    for (const line of lines) {
      const p = db.products.find((x) => x.id === line.productId);
      if (!p) return `منتج غير موجود في السلة.`;
      const available = Number(p.qty || 0);
      const want = Number(line.qty || 0);
      if (want <= 0) return `كمية غير صحيحة للمنتج: ${p.name}`;
      if (want > available) return `الكمية غير كافية للمنتج: ${p.name} (المتاح: ${available})`;
    }
    return null;
  };

  const applyStockReduction = (lines) => {
    for (const line of lines) {
      const p = db.products.find((x) => x.id === line.productId);
      if (!p) continue;
      p.qty = clampNumber(Number(p.qty || 0) - Number(line.qty || 0), { min: 0 });
      p.updatedAt = new Date().toISOString();
    }
  };

  /* =========================
     أذونات الصرف
  ========================= */

  const issueForm = () => {
    const lines = [];
    const wrap = document.createElement("div");

    wrap.innerHTML = `
      <form class="form" id="issueForm">
        <div class="two-col">
          <div class="form__row">
            <label class="label" for="issueDriver">السائق</label>
            <select id="issueDriver" class="select" required></select>
          </div>
          <div class="form__row">
            <label class="label" for="issueBarcode">إدخال باركود (قارئ/كتابة)</label>
            <input id="issueBarcode" class="input" placeholder="امسح الباركود ثم Enter" />
          </div>
        </div>

        <div id="issueLines"></div>
        <div class="hr"></div>
        <div class="actions">
          <button class="btn btn--ghost" type="button" data-cancel>إلغاء</button>
          <button class="btn btn--primary" type="submit">حفظ إذن الصرف</button>
        </div>
        <div id="issueError" class="alert alert--danger hidden" role="alert"></div>
      </form>
    `;

    const form = $("#issueForm", wrap);
    const selDriver = $("#issueDriver", wrap);
    const inpBarcode = $("#issueBarcode", wrap);
    const issueError = $("#issueError", wrap);

    const setError = (msg) => {
      issueError.textContent = msg;
      issueError.classList.remove("hidden");
    };
    const clearError = () => {
      issueError.textContent = "";
      issueError.classList.add("hidden");
    };

    const drivers = [...db.drivers].sort((a, b) => String(a.name).localeCompare(String(b.name)));
    selDriver.innerHTML = `<option value="">اختر...</option>` + drivers.map((d) => `<option value="${escapeHtml(d.id)}">${escapeHtml(d.name)}</option>`).join("");

    const { el: linesEl, rerender } = buildLinesTable({
      lines,
      onChange: () => {},
      allowPrice: false,
    });
    $("#issueLines", wrap).appendChild(linesEl);

    const addProductToLines = (product) => {
      const existing = lines.find((x) => x.productId === product.id);
      if (existing) {
        existing.qty = clampNumber(Number(existing.qty || 0) + 1, { min: 1 });
      } else {
        lines.push({ productId: product.id, qty: 1, price: Number(product.price || 0) });
      }
      rerender();
    };

    inpBarcode.setAttribute("autocomplete", "off");
    inpBarcode.setAttribute("inputmode", "numeric");
    inpBarcode.addEventListener("focus", () => {
      inpBarcode.select();
    });
    inpBarcode.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      clearError();
      const code = inpBarcode.value.trim();
      inpBarcode.value = "";
      const p = findProductByBarcode(code);
      if (!p) return setError("لم يتم العثور على منتج بهذا الباركود.");
      addProductToLines(p);
    });

    $("[data-cancel]", wrap).addEventListener("click", closeModal);

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      clearError();

      const driverId = selDriver.value;
      if (!driverId) return setError("يجب اختيار السائق.");
      if (!lines.length) return setError("أضف صنفًا واحدًا على الأقل.");

      const stockError = checkStockForLines(lines);
      if (stockError) return setError(stockError);

      applyStockReduction(lines);

      const id = nextId("issue", "is");
      const no = `IS-${String(db.meta.counters.issue - 1).padStart(6, "0")}`;
      const now = new Date().toISOString();

      db.issues.push({
        id,
        no,
        driverId,
        items: lines.map((l) => ({ ...l })),
        createdAt: now,
        createdBy: getCurrentUser()?.username || "",
      });

      persist();
      closeModal();
      renderIssues();
      renderProducts();
      renderAudit();
    });

    setTimeout(() => inpBarcode.focus(), 50);
    return wrap;
  };

  const openNewIssue = () => {
    if (!db.drivers.length) {
      confirmDialog("مطلوب", "أضف سائقًا أولًا قبل إنشاء إذن صرف.", () => {
        location.hash = "#/drivers";
      });
      return;
    }
    if (!db.products.length) {
      confirmDialog("مطلوب", "أضف منتجات أولًا قبل إنشاء إذن صرف.", () => {
        location.hash = "#/products";
      });
      return;
    }
    openModal("إذن صرف جديد", issueForm());
  };

  const editIssueForm = (issue) => {
    const originalItems = (issue.items || []).map((l) => ({ ...l }));
    const lines = originalItems.map((l) => ({ ...l }));
    const wrap = document.createElement("div");

    wrap.innerHTML = `
      <form class="form" id="issueFormEdit">
        <div class="two-col">
          <div class="form__row">
            <label class="label" for="issueDriverEdit">السائق</label>
            <select id="issueDriverEdit" class="select" required></select>
          </div>
          <div class="form__row">
            <label class="label" for="issueBarcodeEdit">إدخال باركود (قارئ/كتابة)</label>
            <input id="issueBarcodeEdit" class="input" placeholder="امسح الباركود ثم Enter" />
          </div>
        </div>

        <div id="issueLinesEdit"></div>
        <div class="hr"></div>
        <div class="actions">
          <button class="btn btn--ghost" type="button" data-cancel>إلغاء</button>
          <button class="btn btn--primary" type="submit">حفظ التعديل</button>
        </div>
        <div id="issueErrorEdit" class="alert alert--danger hidden" role="alert"></div>
      </form>
    `;

    const form = $("#issueFormEdit", wrap);
    const selDriver = $("#issueDriverEdit", wrap);
    const inpBarcode = $("#issueBarcodeEdit", wrap);
    const issueError = $("#issueErrorEdit", wrap);

    const setError = (msg) => {
      issueError.textContent = msg;
      issueError.classList.remove("hidden");
    };
    const clearError = () => {
      issueError.textContent = "";
      issueError.classList.add("hidden");
    };

    const drivers = [...db.drivers].sort((a, b) => String(a.name).localeCompare(String(b.name)));
    selDriver.innerHTML = `<option value="">اختر...</option>` + drivers.map((d) => `<option value="${escapeHtml(d.id)}">${escapeHtml(d.name)}</option>`).join("");
    selDriver.value = issue.driverId || "";

    const { el: linesEl, rerender } = buildLinesTable({
      lines,
      onChange: () => {},
      allowPrice: false,
    });
    $("#issueLinesEdit", wrap).appendChild(linesEl);

    const addProductToLines = (product) => {
      const existing = lines.find((x) => x.productId === product.id);
      if (existing) {
        existing.qty = clampNumber(Number(existing.qty || 0) + 1, { min: 1 });
      } else {
        lines.push({ productId: product.id, qty: 1, price: Number(product.price || 0) });
      }
      rerender();
    };

    inpBarcode.setAttribute("autocomplete", "off");
    inpBarcode.setAttribute("inputmode", "numeric");
    inpBarcode.addEventListener("focus", () => {
      inpBarcode.select();
    });
    inpBarcode.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      clearError();
      const code = inpBarcode.value.trim();
      inpBarcode.value = "";
      const p = findProductByBarcode(code);
      if (!p) return setError("لم يتم العثور على منتج بهذا الباركود.");
      addProductToLines(p);
    });

    $("[data-cancel]", wrap).addEventListener("click", closeModal);

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      clearError();

      const driverId = selDriver.value;
      if (!driverId) return setError("يجب اختيار السائق.");
      if (!lines.length) return setError("أضف صنفًا واحدًا على الأقل.");

      const map = new Map();
      for (const l of originalItems) {
        const key = l.productId;
        const entry = map.get(key) || { oldQty: 0, newQty: 0 };
        entry.oldQty += Number(l.qty || 0);
        map.set(key, entry);
      }
      for (const l of lines) {
        const key = l.productId;
        const entry = map.get(key) || { oldQty: 0, newQty: 0 };
        entry.newQty += Number(l.qty || 0);
        map.set(key, entry);
      }

      for (const [pid, entry] of map.entries()) {
        const p = db.products.find((x) => x.id === pid);
        if (!p) continue;
        const currentQty = Number(p.qty || 0);
        const delta = Number(entry.newQty || 0) - Number(entry.oldQty || 0);
        const finalQty = currentQty - delta;
        if (finalQty < 0) {
          return setError(`الكمية غير كافية للمنتج: ${p.name} بعد التعديل.`);
        }
      }

      for (const [pid, entry] of map.entries()) {
        const p = db.products.find((x) => x.id === pid);
        if (!p) continue;
        const currentQty = Number(p.qty || 0);
        const delta = Number(entry.newQty || 0) - Number(entry.oldQty || 0);
        const finalQty = clampNumber(currentQty - delta, { min: 0 });
        p.qty = finalQty;
        p.updatedAt = new Date().toISOString();
      }

      issue.driverId = driverId;
      issue.items = lines.map((l) => ({ ...l }));
      issue.updatedAt = new Date().toISOString();

      persist();
      closeModal();
      renderIssues();
      renderProducts();
      renderAudit();
    });

    setTimeout(() => inpBarcode.focus(), 50);
    return wrap;
  };

  const openEditIssue = (id) => {
    const it = db.issues.find((x) => x.id === id);
    if (!it) return;
    if (!db.products.length) {
      confirmDialog("مطلوب", "أضف منتجات أولًا قبل تعديل إذن صرف.", () => {
        location.hash = "#/products";
      });
      return;
    }
    openModal("تعديل إذن صرف", editIssueForm(it));
  };

  const openViewIssue = (id) => {
    const it = db.issues.find((x) => x.id === id);
    if (!it) return;
    const driver = db.drivers.find((d) => d.id === it.driverId);

    const wrap = document.createElement("div");
    const rows = (it.items || []).map((l) => {
      const p = db.products.find((x) => x.id === l.productId);
      return `
        <tr>
          <td>${escapeHtml(p?.name || "-")}</td>
          <td>${escapeHtml(p?.barcode || "")}</td>
          <td>${escapeHtml(l.qty)}</td>
        </tr>
      `;
    });
    wrap.innerHTML = `
      <div class="two-col">
        <div>
          <div class="badge">رقم الإذن: ${escapeHtml(it.no)}</div>
          <div style="height:8px;"></div>
          <div class="badge">التاريخ: ${escapeHtml(fmtDateTime(it.createdAt))}</div>
          <div style="height:8px;"></div>
          <div class="badge">السائق: ${escapeHtml(driver?.name || "-")}</div>
          <div style="height:8px;"></div>
          <div class="badge">المستخدم: ${escapeHtml(it.createdBy || "-")}</div>
        </div>
        <div class="muted">
          <div style="font-weight:900; margin-bottom:6px;">الأصناف</div>
          <div class="table-wrap">
            <table class="table">
              <thead><tr><th>المنتج</th><th>باركود</th><th>كمية</th></tr></thead>
              <tbody>${rows.join("")}</tbody>
            </table>
          </div>
        </div>
      </div>
      <div class="hr"></div>
      <div class="actions">
        <button class="btn btn--ghost" type="button" data-close2>إغلاق</button>
        <button class="btn btn--primary" type="button" data-print>طباعة</button>
      </div>
    `;
    $("[data-close2]", wrap).addEventListener("click", closeModal);
    $("[data-print]", wrap).addEventListener("click", () => printIssue(it.id));
    openModal("عرض إذن صرف", wrap);
  };

  const printIssue = (id) => {
    const it = db.issues.find((x) => x.id === id);
    if (!it) return;
    const driver = db.drivers.find((d) => d.id === it.driverId);
    const items = (it.items || []).map((l) => {
      const p = db.products.find((x) => x.id === l.productId);
      return { name: p?.name || "-", barcode: p?.barcode || "", qty: l.qty };
    });

    const html = `
      <html dir="rtl" lang="ar">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>إذن صرف ${escapeHtml(it.no)}</title>
          <style>
            @page { size: A3 portrait; margin: 20mm; }
            *{box-sizing:border-box;}
            body{font-family:Tahoma,Arial,sans-serif;margin:0;background:#f3f4f6;color:#0f172a;}
            .sheet{max-width:1120px;margin:20px auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:24px 28px;box-shadow:0 18px 40px rgba(15,23,42,0.16);}
            .sheet__header{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:16px;}
            .sheet__title{font-size:22px;font-weight:800;margin:0;color:#0f172a;}
            .sheet__sub{font-size:13px;color:#6b7280;margin-top:4px;}
            .brand{display:flex;align-items:center;gap:10px;}
            .brand-mark{width:40px;height:40px;border-radius:14px;background:radial-gradient(circle at 30% 30%,#2563eb,#4f46e5);box-shadow:0 10px 24px rgba(37,99,235,0.35);}
            .meta-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px 18px;font-size:13px;color:#111827;margin-top:6px;}
            .meta-label{color:#6b7280;margin-inline-start:4px;}
            .meta-value{font-weight:600;}
            .section-title{font-size:15px;font-weight:700;margin:18px 0 8px;color:#111827;}
            table{width:100%;border-collapse:collapse;margin-top:6px;}
            th,td{border:1px solid #e5e7eb;padding:8px 6px;font-size:12px;}
            th{background:#f3f4ff;text-align:right;color:#1f2937;}
            tbody tr:nth-child(even){background:#f9fafb;}
            .footer{margin-top:18px;font-size:12px;color:#6b7280;display:flex;justify-content:space-between;align-items:center;}
            .footer .brand-small{font-weight:700;color:#111827;}
            .actions{margin-top:16px;display:flex;justify-content:flex-end;gap:10px;}
            .btn{padding:8px 12px;font-size:12px;border-radius:999px;border:1px solid #d1d5db;background:#ffffff;cursor:pointer;}
            .btn-primary{background:linear-gradient(90deg,#2563eb,#4f46e5);color:#f9fafb;border-color:rgba(37,99,235,0.8);}
            @media print{
              body{background:#ffffff;}
              .sheet{margin:0;border:none;box-shadow:none;border-radius:0;}
              .actions{display:none;}
            }
          </style>
        </head>
        <body>
          <div class="sheet">
            <div class="sheet__header">
              <div>
                <h1 class="sheet__title">مخازن النرجس – درنة</h1>
                <div class="sheet__sub">إذن صرف من المخزن</div>
              </div>
              <div class="brand">
                <div class="brand-mark"></div>
              </div>
            </div>
            <div class="meta-grid">
              <div><span class="meta-label">رقم الإذن:</span><span class="meta-value">${escapeHtml(it.no)}</span></div>
              <div><span class="meta-label">التاريخ:</span><span class="meta-value">${escapeHtml(fmtDateTime(it.createdAt))}</span></div>
              <div><span class="meta-label">السائق:</span><span class="meta-value">${escapeHtml(driver?.name || "-")}</span></div>
              <div><span class="meta-label">المستخدم:</span><span class="meta-value">${escapeHtml(it.createdBy || "-")}</span></div>
            </div>
            <div class="section-title">تفاصيل الأصناف المصروفة</div>
            <table>
              <thead><tr><th>الصنف</th><th>الباركود</th><th>الكمية</th></tr></thead>
              <tbody>
                ${items
                  .map(
                    (x) =>
                      `<tr><td>${escapeHtml(x.name)}</td><td>${escapeHtml(x.barcode)}</td><td>${escapeHtml(x.qty)}</td></tr>`
                  )
                  .join("")}
              </tbody>
            </table>
            <div class="footer">
              <span class="brand-small">نظام مخازن النرجس – درنة</span>
              <span>توقيع المستلم: ....................................</span>
            </div>
            <div class="actions">
              <button class="btn" onclick="window.close()">إغلاق</button>
              <button class="btn btn-primary" onclick="window.print()">طباعة على ورق A3</button>
            </div>
          </div>
        </body>
      </html>
    `;

    const w = window.open("", "_blank", "noopener,noreferrer,width=900,height=700");
    if (!w) {
      alert("المتصفح منع فتح نافذة الطباعة. فعّل النوافذ المنبثقة (Popups) لهذا الموقع ثم حاول مرة أخرى.");
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
  };

  /* =========================
     الفواتير والمبيعات + الإيصال
  ========================= */

  const invoiceForm = () => {
    const lines = [];
    const wrap = document.createElement("div");
    wrap.innerHTML = `
      <form class="form" id="invoiceForm">
        <div class="three-col">
          <div class="form__row">
            <label class="label" for="invCustomer">العميل (اختياري)</label>
            <input id="invCustomer" class="input" placeholder="اتركه فارغًا لزبون نقدي" />
          </div>
          <div class="form__row">
            <label class="label" for="invDriver">السائق (اختياري)</label>
            <select id="invDriver" class="select"></select>
          </div>
          <div class="form__row">
            <label class="label" for="invBarcode">إدخال باركود (قارئ/كتابة)</label>
            <input id="invBarcode" class="input" placeholder="امسح الباركود ثم Enter" />
          </div>
        </div>

        <div id="invoiceLines"></div>
        <div class="hr"></div>
        <div class="two-col">
          <div class="muted">الإجمالي يتم حسابه تلقائيًا من الأصناف.</div>
          <div class="card" style="padding:12px;">
            <div class="muted" style="font-weight:800;">الإجمالي</div>
            <div style="font-size:22px;font-weight:900;margin-top:8px;" id="invTotal">0.00</div>
          </div>
        </div>
        <div class="hr"></div>
        <div class="actions">
          <button class="btn btn--ghost" type="button" data-cancel>إلغاء</button>
          <button class="btn btn--primary" type="submit">حفظ الفاتورة</button>
        </div>
        <div id="invError" class="alert alert--danger hidden" role="alert"></div>
      </form>
    `;

    const form = $("#invoiceForm", wrap);
    const invCustomer = $("#invCustomer", wrap);
    const invDriver = $("#invDriver", wrap);
    const invBarcode = $("#invBarcode", wrap);
    const invTotal = $("#invTotal", wrap);
    const invError = $("#invError", wrap);

    const setError = (msg) => {
      invError.textContent = msg;
      invError.classList.remove("hidden");
    };
    const clearError = () => {
      invError.textContent = "";
      invError.classList.add("hidden");
    };

    const drivers = [...db.drivers].sort((a, b) => String(a.name).localeCompare(String(b.name)));
    invDriver.innerHTML =
      `<option value="">-</option>` + drivers.map((d) => `<option value="${escapeHtml(d.id)}">${escapeHtml(d.name)}</option>`).join("");

    const recalc = () => {
      const total = lines.reduce((sum, l) => sum + toLineTotal(l), 0);
      invTotal.textContent = fmtMoney(total);
    };

    const { el: linesEl, rerender } = buildLinesTable({
      lines,
      onChange: recalc,
      allowPrice: true,
    });
    $("#invoiceLines", wrap).appendChild(linesEl);
    recalc();

    const addProductToLines = (product) => {
      const existing = lines.find((x) => x.productId === product.id);
      if (existing) {
        existing.qty = clampNumber(Number(existing.qty || 0) + 1, { min: 1 });
      } else {
        lines.push({ productId: product.id, qty: 1, price: Number(product.price || 0) });
      }
      rerender();
      recalc();
    };

    invBarcode.setAttribute("autocomplete", "off");
    invBarcode.setAttribute("inputmode", "numeric");
    invBarcode.addEventListener("focus", () => {
      invBarcode.select();
    });
    invBarcode.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      clearError();
      const code = invBarcode.value.trim();
      invBarcode.value = "";
      const p = findProductByBarcode(code);
      if (!p) return setError("لم يتم العثور على منتج بهذا الباركود.");
      addProductToLines(p);
    });

    $("[data-cancel]", wrap).addEventListener("click", closeModal);

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      clearError();

      if (!lines.length) return setError("أضف صنفًا واحدًا على الأقل.");
      const id = nextId("invoice", "inv");
      const no = `INV-${String(db.meta.counters.invoice - 1).padStart(6, "0")}`;
      const now = new Date().toISOString();
      const total = lines.reduce((sum, l) => sum + toLineTotal(l), 0);

      const stockError = checkStockForLines(lines);
      if (stockError) return setError(stockError);

      applyStockReduction(lines);

      db.invoices.push({
        id,
        no,
        customerName: invCustomer.value.trim() || "",
        driverId: invDriver.value || "",
        items: lines.map((l) => ({ ...l })),
        total,
        createdAt: now,
        createdBy: getCurrentUser()?.username || "",
      });

      persist();
      closeModal();
      renderInvoices();
      renderDashboard();
      renderProducts();
      renderAudit();
      printInvoice(id);
    });

    setTimeout(() => invBarcode.focus(), 50);
    return wrap;
  };

  const openNewInvoice = () => {
    if (!db.products.length) {
      confirmDialog("مطلوب", "أضف منتجات أولًا قبل إنشاء فاتورة.", () => {
        location.hash = "#/products";
      });
      return;
    }
    openModal("فاتورة جديدة", invoiceForm());
  };

  const openViewInvoice = (id) => {
    const inv = db.invoices.find((x) => x.id === id);
    if (!inv) return;
    const driver = db.drivers.find((d) => d.id === inv.driverId);
    const wrap = document.createElement("div");

    const rows = (inv.items || []).map((l) => {
      const p = db.products.find((x) => x.id === l.productId);
      return `
        <tr>
          <td>${escapeHtml(p?.name || "-")}</td>
          <td>${escapeHtml(p?.barcode || "")}</td>
          <td>${escapeHtml(l.qty)}</td>
          <td>${escapeHtml(fmtMoney(l.price))}</td>
          <td>${escapeHtml(fmtMoney(toLineTotal(l)))}</td>
        </tr>
      `;
    });

    wrap.innerHTML = `
      <div class="two-col">
        <div>
          <div class="badge">رقم الفاتورة: ${escapeHtml(inv.no)}</div>
          <div style="height:8px;"></div>
          <div class="badge">التاريخ: ${escapeHtml(fmtDateTime(inv.createdAt))}</div>
          <div style="height:8px;"></div>
          <div class="badge">العميل: ${escapeHtml(inv.customerName || "زبون نقدي")}</div>
          <div style="height:8px;"></div>
          <div class="badge">السائق: ${escapeHtml(driver?.name || "-")}</div>
          <div style="height:8px;"></div>
          <div class="badge">المستخدم: ${escapeHtml(inv.createdBy || "-")}</div>
        </div>
        <div class="card" style="padding:12px;">
          <div class="muted" style="font-weight:900;">الإجمالي</div>
          <div style="font-size:22px;font-weight:900;margin-top:8px;">${escapeHtml(fmtMoney(inv.total))}</div>
        </div>
      </div>
      <div class="hr"></div>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>المنتج</th><th>باركود</th><th>كمية</th><th>سعر</th><th>الإجمالي</th></tr></thead>
          <tbody>${rows.join("")}</tbody>
        </table>
      </div>
      <div class="hr"></div>
      <div class="actions">
        <button class="btn btn--ghost" type="button" data-close2>إغلاق</button>
        <button class="btn btn--ghost" type="button" data-return>مرتجع مشتريات</button>
        <button class="btn btn--primary" type="button" data-print>طباعة إيصال</button>
      </div>
    `;
    $("[data-close2]", wrap).addEventListener("click", closeModal);
    $("[data-return]", wrap).addEventListener("click", () => {
      createReturnForInvoice(inv.id);
      closeModal();
    });
    $("[data-print]", wrap).addEventListener("click", () => printInvoice(inv.id));
    openModal("عرض فاتورة", wrap);
  };

  const deleteInvoice = (id) => {
    const inv = db.invoices.find((x) => x.id === id);
    if (!inv) return;
    confirmDialog(
      "حذف فاتورة",
      "حذف الفاتورة لا يعيد الكميات للمخزون (لمنع العبث). إذا أردت تصحيح فاتورة، أنشئ فاتورة عكسية/مرتجعات لاحقًا.",
      () => {
        db.invoices = db.invoices.filter((x) => x.id !== id);
        persist();
        renderInvoices();
        renderDashboard();
      }
    );
  };

  const createReturnForInvoice = (id) => {
    const inv = db.invoices.find((x) => x.id === id);
    if (!inv) return;
    if (!inv.items || !inv.items.length) {
      confirmDialog("تنبيه", "لا توجد أصناف في هذه الفاتورة لإنشاء مرتجع.", () => {});
      return;
    }

    if (Array.isArray(db.returns) && db.returns.some((r) => r.invoiceId === inv.id)) {
      confirmDialog("تنبيه", "تم إنشاء مرتجع لهذه الفاتورة من قبل.", () => {});
      return;
    }

    if (!window.confirm("سيتم إنشاء مرتجع مشتريات لهذه الفاتورة وإعادة الكميات للمخزون. هل تريد المتابعة؟")) {
      return;
    }

    const lines = inv.items.map((l) => ({ ...l }));

    for (const l of lines) {
      const p = db.products.find((x) => x.id === l.productId);
      if (!p) continue;
      p.qty = clampNumber(Number(p.qty || 0) + Number(l.qty || 0), { min: 0 });
      p.updatedAt = new Date().toISOString();
    }

    const idRet = nextId("return", "ret");
    const noRet = `RET-${String(db.meta.counters.return - 1).padStart(6, "0")}`;
    const now = new Date().toISOString();
    const total = lines.reduce((sum, l) => sum + toLineTotal(l), 0);

    if (!Array.isArray(db.returns)) db.returns = [];
    db.returns.push({
      id: idRet,
      no: noRet,
      invoiceId: inv.id,
      items: lines.map((l) => ({ ...l })),
      total,
      createdAt: now,
      createdBy: getCurrentUser()?.username || "",
    });

    persist();
    renderInvoices();
    renderDashboard();
    renderProducts();
    renderAudit();
    confirmDialog("تم", "تم إنشاء مرتجع مشتريات لهذه الفاتورة وتمت إعادة الكميات للمخزون.", () => {});
  };

  const printInvoice = (id) => {
    const inv = db.invoices.find((x) => x.id === id);
    if (!inv) return;
    const driver = db.drivers.find((d) => d.id === inv.driverId);
    const items = (inv.items || []).map((l) => {
      const p = db.products.find((x) => x.id === l.productId);
      return {
        name: p?.name || "-",
        qty: Number(l.qty || 0),
        price: Number(l.price || 0),
        total: toLineTotal(l),
      };
    });

    const html = `
      <html dir="rtl" lang="ar">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>فاتورة ${escapeHtml(inv.no)}</title>
          <style>
            @page { size: A3 portrait; margin: 20mm; }
            *{box-sizing:border-box;}
            body{font-family:Tahoma,Arial,sans-serif;margin:0;background:#f3f4f6;color:#0f172a;}
            .sheet{max-width:1120px;margin:20px auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:24px 28px;box-shadow:0 18px 40px rgba(15,23,42,0.16);}
            .sheet__header{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:18px;}
            .sheet__title{font-size:24px;font-weight:800;margin:0;color:#0f172a;}
            .sheet__sub{font-size:13px;color:#6b7280;margin-top:4px;}
            .brand{display:flex;align-items:center;gap:10px;}
            .brand-mark{width:40px;height:40px;border-radius:14px;background:radial-gradient(circle at 30% 30%,#2563eb,#4f46e5);box-shadow:0 10px 24px rgba(37,99,235,0.35);}
            .meta-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px 18px;font-size:13px;color:#111827;margin-top:6px;}
            .meta-label{color:#6b7280;margin-inline-start:4px;}
            .meta-value{font-weight:600;}
            .section-title{font-size:15px;font-weight:700;margin:18px 0 8px;color:#111827;}
            table{width:100%;border-collapse:collapse;margin-top:6px;}
            th,td{border:1px solid #e5e7eb;padding:8px 6px;font-size:12px;}
            th{background:#f3f4ff;text-align:right;color:#1f2937;}
            tbody tr:nth-child(even){background:#f9fafb;}
            .totals{margin-top:14px;font-size:14px;max-width:260px;margin-inline-start:auto;border:1px solid #e5e7eb;border-radius:10px;padding:10px 12px;background:#f9fafb;}
            .totals-row{display:flex;justify-content:space-between;margin-top:4px;font-weight:700;}
            .footer{margin-top:20px;font-size:12px;color:#6b7280;display:flex;justify-content:space-between;align-items:center;}
            .footer .brand-small{font-weight:700;color:#111827;}
            .actions{margin-top:16px;display:flex;justify-content:flex-end;gap:10px;}
            .btn{padding:8px 12px;font-size:12px;border-radius:999px;border:1px solid #d1d5db;background:#ffffff;cursor:pointer;}
            .btn-primary{background:linear-gradient(90deg,#2563eb,#4f46e5);color:#f9fafb;border-color:rgba(37,99,235,0.8);}
            @media print{
              body{background:#ffffff;}
              .sheet{margin:0;border:none;box-shadow:none;border-radius:0;}
              .actions{display:none;}
            }
          </style>
        </head>
        <body>
          <div class="sheet">
            <div class="sheet__header">
              <div>
                <h1 class="sheet__title">مخازن النرجس – درنة</h1>
                <div class="sheet__sub">فاتورة بيع</div>
              </div>
              <div class="brand">
                <div class="brand-mark"></div>
              </div>
            </div>
            <div class="meta-grid">
              <div><span class="meta-label">رقم الفاتورة:</span><span class="meta-value">${escapeHtml(inv.no)}</span></div>
              <div><span class="meta-label">التاريخ:</span><span class="meta-value">${escapeHtml(fmtDateTime(inv.createdAt))}</span></div>
              <div><span class="meta-label">العميل:</span><span class="meta-value">${escapeHtml(inv.customerName || "زبون نقدي")}</span></div>
              <div><span class="meta-label">السائق:</span><span class="meta-value">${escapeHtml(driver?.name || "-")}</span></div>
              <div><span class="meta-label">المستخدم:</span><span class="meta-value">${escapeHtml(inv.createdBy || "-")}</span></div>
            </div>
            <div class="section-title">تفاصيل الأصناف</div>
            <table>
              <thead>
                <tr><th>الصنف</th><th>الكمية</th><th>سعر الوحدة</th><th>الإجمالي</th></tr>
              </thead>
              <tbody>
                ${items
                  .map(
                    (it) =>
                      `<tr>
                        <td>${escapeHtml(it.name)}</td>
                        <td>${escapeHtml(it.qty)}</td>
                        <td>${escapeHtml(fmtMoney(it.price))}</td>
                        <td>${escapeHtml(fmtMoney(it.total))}</td>
                      </tr>`
                  )
                  .join("")}
              </tbody>
            </table>
            <div class="totals">
              <div class="totals-row">
                <span>الإجمالي النهائي</span>
                <span>${escapeHtml(fmtMoney(inv.total))}</span>
              </div>
            </div>
            <div class="footer">
              <span class="brand-small">نظام مخازن النرجس – درنة</span>
              <span>توقيع العميل: ....................................</span>
            </div>
            <div class="actions">
              <button class="btn" onclick="window.close()">إغلاق</button>
              <button class="btn btn-primary" onclick="window.print()">طباعة على ورق A3</button>
            </div>
          </div>
        </body>
      </html>
    `;

    const w = window.open("", "_blank", "noopener,noreferrer,width=1024,height=720");
    if (!w) {
      alert("المتصفح منع فتح نافذة الطباعة. فعّل النوافذ المنبثقة (Popups) لهذا الموقع ثم حاول مرة أخرى.");
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
  };

  /* =========================
     الجرد
  ========================= */

  const saveAudit = () => {
    console.log("Save audit function called - app.js:2162");
    
    if (!db.products.length) {
      console.log("No products found - app.js:2165");
      confirmDialog("خطأ", "لا توجد منتجات في المخزن.", () => {});
      return;
    }
    
    const inputs = $$("[data-audit-actual]");
    console.log(`Found ${inputs.length} audit inputs - app.js:2171`);
    
    const lines = [];
    for (const input of inputs) {
      const pid = input.getAttribute("data-audit-actual");
      const v = input.value.trim();
      if (!v) continue;
      const p = db.products.find((x) => x.id === pid);
      if (!p) continue;
      const systemQty = Number(p.qty || 0);
      const actualQty = clampNumber(v, { min: 0 });
      lines.push({ productId: pid, systemQty, actualQty, diff: actualQty - systemQty });
    }
    
    console.log(`Collected ${lines.length} audit lines - app.js:2185`);
    
    if (!lines.length) {
      confirmDialog("تنبيه", "أدخل كميات فعلية لمنتج واحد على الأقل ثم احفظ.", () => {});
      return;
    }
    
    const id = nextId("audit", "au");
    const no = `AUD-${String(db.meta.counters.audit || 1).padStart(6, "0")}`;
    const now = new Date().toISOString();
    const auditRecord = {
      id,
      no,
      createdAt: now,
      createdBy: getCurrentUser()?.username || "مستخدم غير معروف",
      lines,
    };
    
    console.log("Saving audit record: - app.js:2203", auditRecord);
    
    db.audits.push(auditRecord);
    db.meta.counters.audit = (db.meta.counters.audit || 1) + 1;
    
    persist();
    renderAudit();
    
    confirmDialog("نجاح", "تم حفظ الجرد بنجاح!", () => {});
  };

  const openViewAudit = (id) => {
    const a = db.audits.find((x) => x.id === id);
    if (!a) return;
    const wrap = document.createElement("div");
    const rows = (a.lines || []).map((l) => {
      const p = db.products.find((x) => x.id === l.productId);
      const badgeClass = l.diff === 0 ? "badge badge--ok" : "badge badge--danger";
      return `
        <tr>
          <td>${escapeHtml(p?.name || "-")}</td>
          <td>${escapeHtml(p?.barcode || "")}</td>
          <td>${escapeHtml(l.systemQty)}</td>
          <td>${escapeHtml(l.actualQty)}</td>
          <td><span class="${badgeClass}">${escapeHtml(l.diff)}</span></td>
        </tr>
      `;
    });
    wrap.innerHTML = `
      <div class="two-col">
        <div>
          <div class="badge">رقم: ${escapeHtml(a.no)}</div>
          <div style="height:8px;"></div>
          <div class="badge">تاريخ: ${escapeHtml(fmtDateTime(a.createdAt))}</div>
          <div style="height:8px;"></div>
          <div class="badge">مستخدم: ${escapeHtml(a.createdBy || "-")}</div>
        </div>
        <div class="muted">
          هذا السجل لا يغير المخزون تلقائيًا، لكنه يساعد على مقارنة الكمية الفعلية بكمية النظام.
        </div>
      </div>
      <div class="hr"></div>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>المنتج</th><th>باركود</th><th>بالنظام</th><th>فعلي</th><th>الفرق</th></tr></thead>
          <tbody>${rows.join("")}</tbody>
        </table>
      </div>
      <div class="hr"></div>
      <div class="actions">
        <button class="btn btn--ghost" type="button" data-close2>إغلاق</button>
        <button class="btn btn--primary" type="button" data-print>طباعة</button>
      </div>
    `;
    $("[data-close2]", wrap).addEventListener("click", closeModal);
    $("[data-print]", wrap).addEventListener("click", () => printAudit(a.id));
    openModal("عرض سجل جرد", wrap);
  };

  const openPrintWindow = (title, html) => {
    const w = window.open("", "_blank", "noopener,noreferrer,width=900,height=700");
    if (!w) {
      alert("المتصفح منع فتح نافذة الطباعة. فعّل النوافذ المنبثقة (Popups) لهذا الموقع ثم حاول مرة أخرى.");
      return;
    }
    w.document.open();
    w.document.write(`<!doctype html>${html}`);
    w.document.close();
    try {
      w.document.title = title;
    } catch {}
  };

  const printAudit = (id) => {
    const a = db.audits.find((x) => x.id === id);
    if (!a) return;
    const rows = (a.lines || [])
      .map((l) => {
        const p = db.products.find((x) => x.id === l.productId);
        return `
          <tr>
            <td>${escapeHtml(p?.name || "-")}</td>
            <td>${escapeHtml(p?.barcode || "")}</td>
            <td>${escapeHtml(l.systemQty)}</td>
            <td>${escapeHtml(l.actualQty)}</td>
            <td>${escapeHtml(l.diff)}</td>
          </tr>
        `;
      })
      .join("");

    const html = `
      <html dir="rtl" lang="ar">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>جرد ${escapeHtml(a.no)}</title>
          <style>
            body{font-family:Tahoma,Arial,sans-serif;margin:18px;color:#111;}
            h1{font-size:18px;margin:0 0 10px;}
            .meta{font-size:12px;margin:6px 0;}
            table{width:100%;border-collapse:collapse;margin-top:12px;}
            th,td{border:1px solid #ddd;padding:8px;font-size:12px;}
            th{background:#f4f4f4;text-align:right;}
            .btns{margin:12px 0;display:flex;gap:8px;}
            button{padding:8px 10px;border:1px solid #ccc;background:#fff;cursor:pointer;border-radius:8px}
            @media print{.btns{display:none} body{margin:0}}
          </style>
        </head>
        <body>
          <div class="btns">
            <button onclick="window.print()">طباعة</button>
            <button onclick="window.close()">إغلاق</button>
          </div>
          <h1>مخازن النرجس – درنة • جرد</h1>
          <div class="meta">الرقم: ${escapeHtml(a.no)}</div>
          <div class="meta">التاريخ: ${escapeHtml(fmtDateTime(a.createdAt))}</div>
          <div class="meta">المستخدم: ${escapeHtml(a.createdBy || "-")}</div>
          <table>
            <thead><tr><th>المنتج</th><th>باركود</th><th>بالنظام</th><th>فعلي</th><th>الفرق</th></tr></thead>
            <tbody>${rows || `<tr><td colspan="5">-</td></tr>`}</tbody>
          </table>
        </body>
      </html>
    `;

    openPrintWindow(`جرد ${a.no}`, html);
  };

  const printAuditSnapshot = () => {
    const lines = db.products
      .map((p) => {
        const input = $(`[data-audit-actual="${CSS.escape(p.id)}"]`);
        const actualStr = input ? String(input.value || "").trim() : "";
        const systemQty = Number(p.qty || 0);
        const actualQty = actualStr ? clampNumber(actualStr, { min: 0 }) : null;
        const diff = actualQty === null ? "" : String(actualQty - systemQty);
        return {
          name: p.name || "-",
          barcode: p.barcode || "",
          systemQty,
          actualQty,
          diff,
        };
      })
      .sort((a, b) => String(a.name).localeCompare(String(b.name)));

    const rows = lines
      .map(
        (l) => `
          <tr>
            <td>${escapeHtml(l.name)}</td>
            <td>${escapeHtml(l.barcode)}</td>
            <td>${escapeHtml(l.systemQty)}</td>
            <td>${escapeHtml(l.actualQty === null ? "" : l.actualQty)}</td>
            <td>${escapeHtml(l.diff)}</td>
          </tr>
        `
      )
      .join("");

    const html = `
      <html dir="rtl" lang="ar">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>طباعة الجرد</title>
          <style>
            body{font-family:Tahoma,Arial,sans-serif;margin:18px;color:#111;}
            h1{font-size:18px;margin:0 0 10px;}
            .meta{font-size:12px;margin:6px 0;}
            table{width:100%;border-collapse:collapse;margin-top:12px;}
            th,td{border:1px solid #ddd;padding:8px;font-size:12px;}
            th{background:#f4f4f4;text-align:right;}
            .btns{margin:12px 0;display:flex;gap:8px;}
            button{padding:8px 10px;border:1px solid #ccc;background:#fff;cursor:pointer;border-radius:8px}
            @media print{.btns{display:none} body{margin:0}}
          </style>
        </head>
        <body>
          <div class="btns">
            <button onclick="window.print()">طباعة</button>
            <button onclick="window.close()">إغلاق</button>
          </div>
          <h1>مخازن النرجس – درنة • طباعة الجرد</h1>
          <div class="meta">التاريخ: ${escapeHtml(fmtDateTime(new Date().toISOString()))}</div>
          <div class="meta">المستخدم: ${escapeHtml(getCurrentUser()?.username || "-")}</div>
          <table>
            <thead><tr><th>المنتج</th><th>باركود</th><th>بالنظام</th><th>فعلي</th><th>الفرق</th></tr></thead>
            <tbody>${rows || `<tr><td colspan="5">لا توجد منتجات.</td></tr>`}</tbody>
          </table>
        </body>
      </html>
    `;

    openPrintWindow("طباعة الجرد", html);
  };

  const printLatestIssue = () => {
    const latest = [...db.issues].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))[0];
    if (!latest) {
      confirmDialog("تنبيه", "لا توجد أذونات صرف للطباعة.", () => {});
      return;
    }
    printIssue(latest.id);
  };

  const downloadBackup = () => {
    const payload = {
      app: db.meta?.name || "مخازن النرجس – درنة",
      exportedAt: new Date().toISOString(),
      db,
    };
    const raw = JSON.stringify(payload, null, 2);
    const blob = new Blob([raw], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 19).replaceAll(":", "-");
    a.href = url;
    a.download = `backup-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  const restoreBackupFromFile = async (file) => {
    const text = await file.text();
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      confirmDialog("خطأ", "ملف النسخ الاحتياطي غير صالح (JSON).", () => {});
      return;
    }
    const nextDb = parsed?.db ?? parsed;
    if (!isDbShapeValid(nextDb)) {
      confirmDialog("خطأ", "النسخة الاحتياطية لا تطابق بنية البيانات المتوقعة.", () => {});
      return;
    }

    db = nextDb;
    db.session = { userId: null, token: null, loginAt: null };
    await Storage.save(db);
    closeModal();
    showLogin();
    confirmDialog("تمت الاستعادة", "تمت استعادة النسخة الاحتياطية بنجاح. سجّل الدخول للمتابعة.", () => {});
  };

  /* =========================
     المستخدمون والصلاحيات
  ========================= */

  const userForm = (initial, onSave) => {
    const u = initial || { id: null, username: "", password: "", role: "staff" };
    const wrap = document.createElement("div");
    wrap.innerHTML = `
      <form class="form" id="userForm">
        <div class="two-col">
          <div class="form__row">
            <label class="label" for="uName">اسم المستخدم</label>
            <input id="uName" class="input" required />
          </div>
          <div class="form__row">
            <label class="label" for="uRole">الدور</label>
            <select id="uRole" class="select">
              <option value="staff">موظف</option>
              <option value="owner">مالك</option>
            </select>
          </div>
        </div>
        <div class="form__row">
          <label class="label" for="uPass">كلمة المرور</label>
          <input id="uPass" class="input" type="password" ${initial ? "" : "required"} />
          <div class="muted" style="font-size:12px;">في حالة التعديل: اتركها فارغة للإبقاء على كلمة المرور الحالية.</div>
        </div>
        <div class="hr"></div>
        <div class="actions">
          <button class="btn btn--ghost" type="button" data-cancel>إلغاء</button>
          <button class="btn btn--primary" type="submit">حفظ</button>
        </div>
        <div id="uError" class="alert alert--danger hidden" role="alert"></div>
      </form>
    `;

    const form = $("#userForm", wrap);
    const uName = $("#uName", wrap);
    const uRole = $("#uRole", wrap);
    const uPass = $("#uPass", wrap);
    const uError = $("#uError", wrap);

    const setError = (msg) => {
      uError.textContent = msg;
      uError.classList.remove("hidden");
    };
    const clearError = () => {
      uError.textContent = "";
      uError.classList.add("hidden");
    };

    uName.value = u.username || "";
    uRole.value = u.role || "staff";

    $("[data-cancel]", wrap).addEventListener("click", closeModal);
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      clearError();

      const username = uName.value.trim();
      const role = uRole.value;
      const pass = uPass.value;

      if (!username) return setError("اسم المستخدم مطلوب.");
      const exists = db.users.some((x) => x.username === username && x.id !== u.id);
      if (exists) return setError("اسم المستخدم مستخدم بالفعل.");
      if (!initial && !pass) return setError("كلمة المرور مطلوبة.");

      onSave({
        ...u,
        username,
        role,
        password: pass ? pass : u.password,
      });
    });

    return wrap;
  };

  const openAddUser = () => {
    openModal(
      "إضافة مستخدم",
      userForm(null, (data) => {
        const id = nextId("user", "u");
        db.users.push({ ...data, id, createdAt: new Date().toISOString(), lastLoginAt: null });
        persist();
        closeModal();
        renderUsers();
      })
    );
  };

  const openEditUser = (id) => {
    const u = db.users.find((x) => x.id === id);
    if (!u) return;
    openModal(
      "تعديل مستخدم",
      userForm(u, (data) => {
        const idx = db.users.findIndex((x) => x.id === id);
        if (idx === -1) return;
        db.users[idx] = { ...db.users[idx], ...data };
        persist();
        closeModal();
        renderUsers();
        renderTopbar();
      })
    );
  };

  const deleteUser = (id) => {
    const u = db.users.find((x) => x.id === id);
    if (!u) return;
    if (u.id === db.session.userId) {
      confirmDialog("لا يمكن الحذف", "لا يمكنك حذف المستخدم الحالي وهو مسجّل الدخول.", () => {});
      return;
    }
    confirmDialog("حذف مستخدم", `حذف المستخدم: ${u.username}؟`, () => {
      db.users = db.users.filter((x) => x.id !== id);
      persist();
      renderUsers();
    });
  };

  /* =========================
     الأحداث العامة على الجداول
  ========================= */

  document.addEventListener("click", (e) => {
    const el = e.target?.closest?.("[data-action]");
    if (!el) return;
    const action = el.getAttribute("data-action");
    const id = el.getAttribute("data-id");

    if (action === "editProduct") openEditProduct(id);
    if (action === "deleteProduct") deleteProduct(id);
    if (action === "barcodeProduct") showProductBarcode(id);

    if (action === "editDriver") openEditDriver(id);
    if (action === "deleteDriver") deleteDriver(id);

    if (action === "editIssue") openEditIssue(id);
    if (action === "viewIssue") openViewIssue(id);
    if (action === "printIssue") printIssue(id);

    if (action === "viewInvoice") openViewInvoice(id);
    if (action === "printInvoice") printInvoiceExternal(id);
    if (action === "deleteInvoice") deleteInvoice(id);

    if (action === "viewPurchase") openViewPurchase(id);
    if (action === "printPurchase") printPurchase(id);
    if (action === "returnPurchase") openReturnFromPurchase(id);

    if (action === "viewReturn") openViewReturn(id);
    if (action === "printReturn") printReturn(id);

    if (action === "printIssue") printIssueExternal(id);
    if (action === "viewAudit") openViewAudit(id);
    if (action === "printAudit") printAudit(id);

    if (action === "editUser") {
      if (!isOwner()) return;
      openEditUser(id);
    }
    if (action === "deleteUser") {
      if (!isOwner()) return;
      deleteUser(id);
    }
  });

  /* =========================
     أزرار الصفحات
  ========================= */

  $("#btnAddProduct").addEventListener("click", openAddProduct);
  $("#productsSearch").addEventListener("input", renderProducts);
  
  // Theme selector
  const themeSelector = $("#themeSelector");
  if (themeSelector) {
    themeSelector.addEventListener("change", (e) => {
      applyTheme(e.target.value);
    });
  }

  $("#btnAddDriver").addEventListener("click", openAddDriver);

  $("#btnNewIssue").addEventListener("click", openNewIssue);

  $("#btnNewInvoice").addEventListener("click", openNewInvoice);
  
  $("#btnNewPurchase").addEventListener("click", openNewPurchase);
  
  $("#btnNewReturn").addEventListener("click", openNewReturn);

  $("#btnSaveAudit").addEventListener("click", saveAudit);
  
  $("#btnPrintGeneralAudit").addEventListener("click", printGeneralAudit);
  
  // Update the old audit button to use the new external printing
  btnPrintAudit.addEventListener("click", printAuditSnapshotExternal);
  
  // Add event listener for individual item audit (will be added dynamically)
  document.addEventListener("click", (e) => {
    const auditItemBtn = e.target.closest("[data-action='printItemAudit']");
    if (auditItemBtn) {
      const productId = auditItemBtn.getAttribute("data-id");
      printItemAudit(productId);
    }
  });
  
  // Date-based audit functionality
  $("#btnFilterByDate").addEventListener("click", () => {
    const selectedDate = $("#auditDate").value;
    if (!selectedDate) {
      alert("يرجى اختيار تاريخ للجرد");
      return;
    }
    printDateBasedAudit(selectedDate);
  });
  
  // Set default date to today
  const today = new Date().toISOString().split('T')[0];
  $("#auditDate").value = today;

  btnPrintLatestIssue.addEventListener("click", printLatestIssue);
  btnPrintAudit.addEventListener("click", printAuditSnapshot);

  btnBackupDownload.addEventListener("click", downloadBackup);
  btnBackupRestore.addEventListener("click", () => backupFile.click());
  backupFile.addEventListener("change", async () => {
    const file = backupFile.files?.[0];
    backupFile.value = "";
    if (!file) return;
    await restoreBackupFromFile(file);
  });

  $("#btnAddUser").addEventListener("click", () => {
    if (!isOwner()) return;
    openAddUser();
  });

  $("#btnResetDemo").addEventListener("click", () => {
    confirmDialog("إعادة ضبط", "سيتم حذف جميع البيانات المخزنة محليًا على هذا المتصفح. المتابعة؟", () => {
      (async () => {
        await Storage.reset();
        db = await Storage.load();
        await Storage.save(db);
        showLogin();
      })();
    });
  });

  // Load saved theme
  loadTheme();

  // Purchase and Return functions
  const renderPurchases = () => {
    const tbody = $("#purchasesTbody");
    tbody.innerHTML = "";

    const list = [...(db.purchases || [])].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

    for (const pur of list) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(pur.id)}</td>
        <td>${escapeHtml(fmtDateTime(pur.createdAt))}</td>
        <td>${escapeHtml(pur.supplier || "")}</td>
        <td>${escapeHtml(fmtMoney(pur.total))}</td>
        <td class="actions">
          <button class="btn btn--ghost" data-action="viewPurchase" data-id="${escapeHtml(pur.id)}">عرض</button>
          <button class="btn btn--ghost" data-action="printPurchase" data-id="${escapeHtml(pur.id)}">طباعة</button>
          <button class="btn btn--ghost" data-action="returnPurchase" data-id="${escapeHtml(pur.id)}">إرجاع</button>
        </td>
      `;
      tbody.appendChild(tr);
    }

    if (!list.length) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="5" class="muted">لم تُسجل مشتريات بعد.</td>`;
      tbody.appendChild(tr);
    }
  };

  const renderReturns = () => {
    const tbody = $("#returnsTbody");
    tbody.innerHTML = "";

    const list = [...(db.returns || [])].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

    for (const ret of list) {
      const originalPurchase = db.purchases?.find(p => p.id === ret.originalPurchaseId);
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(ret.id)}</td>
        <td>${escapeHtml(fmtDateTime(ret.createdAt))}</td>
        <td>${escapeHtml(originalPurchase?.id || ret.originalPurchaseId)}</td>
        <td>${escapeHtml(ret.supplier || "")}</td>
        <td>${escapeHtml(fmtMoney(ret.total))}</td>
        <td class="actions">
          <button class="btn btn--ghost" data-action="viewReturn" data-id="${escapeHtml(ret.id)}">عرض</button>
          <button class="btn btn--ghost" data-action="printReturn" data-id="${escapeHtml(ret.id)}">طباعة</button>
        </td>
      `;
      tbody.appendChild(tr);
    }

    if (!list.length) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="6" class="muted">لم تُسجل إرجاعات مشتريات بعد.</td>`;
      tbody.appendChild(tr);
    }
  };

  // Purchase and Return Management Functions
  
  const openNewPurchase = () => {
    // Implementation for new purchase form
    alert("ميزة إضافة مشتريات جديدة قيد التطوير");
  };
  
  const openNewReturn = () => {
    // Implementation for new return form
    alert("ميزة إضافة إرجاع مشتريات جديدة قيد التطوير");
  };
  
  const openViewPurchase = (id) => {
    // Implementation for viewing purchase details
    alert("ميزة عرض تفاصيل المشتريات قيد التطوير");
  };
  
  const openViewReturn = (id) => {
    // Implementation for viewing return details
    alert("ميزة عرض تفاصيل الإرجاع قيد التطوير");
  };
  
  const openReturnFromPurchase = (purchaseId) => {
    // Implementation for creating return from purchase
    alert("ميزة إنشاء إرجاع من فاتورة شراء قيد التطوير");
  };
  
  const printPurchase = (id) => {
    const purchase = db.purchases?.find((x) => x.id === id);
    if (!purchase) return;
    
    const html = `
      <html dir="rtl" lang="ar">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>فاتورة شراء ${escapeHtml(purchase.id)}</title>
          <style>
            @page { size: A4 portrait; margin: 20mm; }
            *{box-sizing:border-box;}
            body{font-family:Tahoma,Arial,sans-serif;margin:0;background:#f3f4f6;color:#0f172a;}
            .sheet{max-width:800px;margin:20px auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:24px 28px;box-shadow:0 18px 40px rgba(15,23,42,0.16);}
            .sheet__header{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:18px;}
            .sheet__title{font-size:24px;font-weight:800;margin:0;color:#0f172a;}
            .sheet__sub{font-size:13px;color:#6b7280;margin-top:4px;}
            .brand{display:flex;align-items:center;gap:10px;}
            .brand-mark{width:40px;height:40px;border-radius:14px;background:radial-gradient(circle at 30% 30%,#2563eb,#4f46e5);box-shadow:0 10px 24px rgba(37,99,235,0.35);}
            .meta-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px 18px;font-size:13px;color:#111827;margin-top:6px;}
            .meta-label{color:#6b7280;margin-inline-start:4px;}
            .meta-value{font-weight:600;}
            .section-title{font-size:15px;font-weight:700;margin:18px 0 8px;color:#111827;}
            table{width:100%;border-collapse:collapse;margin-top:6px;}
            th,td{border:1px solid #e5e7eb;padding:8px 6px;font-size:12px;}
            th{background:#f3f4ff;text-align:right;color:#1f2937;}
            tbody tr:nth-child(even){background:#f9fafb;}
            .totals{margin-top:14px;font-size:14px;max-width:260px;margin-inline-start:auto;border:1px solid #e5e7eb;border-radius:10px;padding:10px 12px;background:#f9fafb;}
            .totals-row{display:flex;justify-content:space-between;margin-top:4px;font-weight:700;}
            .footer{margin-top:20px;font-size:12px;color:#6b7280;display:flex;justify-content:space-between;align-items:center;}
            .footer .brand-small{font-weight:700;color:#111827;}
            .actions{margin-top:16px;display:flex;justify-content:flex-end;gap:10px;}
            .btn{padding:8px 12px;font-size:12px;border-radius:999px;border:1px solid #d1d5db;background:#ffffff;cursor:pointer;}
            .btn-primary{background:linear-gradient(90deg,#2563eb,#4f46e5);color:#f9fafb;border-color:rgba(37,99,235,0.8);}
            @media print{
              body{background:#ffffff;}
              .sheet{margin:0;border:none;box-shadow:none;border-radius:0;}
              .actions{display:none;}
            }
          </style>
        </head>
        <body>
          <div class="sheet">
            <div class="sheet__header">
              <div>
                <h1 class="sheet__title">مخازن النرجس – درنة</h1>
                <div class="sheet__sub">فاتورة شراء</div>
              </div>
              <div class="brand">
                <div class="brand-mark"></div>
              </div>
            </div>
            <div class="meta-grid">
              <div><span class="meta-label">رقم الفاتورة:</span><span class="meta-value">${escapeHtml(purchase.id)}</span></div>
              <div><span class="meta-label">التاريخ:</span><span class="meta-value">${escapeHtml(fmtDateTime(purchase.createdAt))}</span></div>
              <div><span class="meta-label">المورد:</span><span class="meta-value">${escapeHtml(purchase.supplier || "-")}</span></div>
              <div><span class="meta-label">المستخدم:</span><span class="meta-value">${escapeHtml(purchase.createdBy || "-")}</span></div>
            </div>
            <div class="section-title">تفاصيل الأصناف المشتراة</div>
            <table>
              <thead>
                <tr><th>الصنف</th><th>الكمية</th><th>سعر الوحدة</th><th>الإجمالي</th></tr>
              </thead>
              <tbody>
                ${(purchase.items || [])
                  .map(item => {
                    const product = db.products.find(p => p.id === item.productId);
                    return `<tr>
                      <td>${escapeHtml(product?.name || "-")}</td>
                      <td>${escapeHtml(item.qty || 0)}</td>
                      <td>${escapeHtml(fmtMoney(item.price || 0))}</td>
                      <td>${escapeHtml(fmtMoney((item.qty || 0) * (item.price || 0)))}</td>
                    </tr>`;
                  })
                  .join("")}
              </tbody>
            </table>
            <div class="totals">
              <div class="totals-row">
                <span>الإجمالي النهائي</span>
                <span>${escapeHtml(fmtMoney(purchase.total || 0))}</span>
              </div>
            </div>
            <div class="footer">
              <span class="brand-small">نظام مخازن النرجس – درنة</span>
              <span>توقيع المورد: ....................................</span>
            </div>
            <div class="actions">
              <button class="btn" onclick="window.close()">إغلاق</button>
              <button class="btn btn-primary" onclick="window.print()">طباعة</button>
            </div>
          </div>
        </body>
      </html>
    `;

    const w = window.open("", "_blank", "noopener,noreferrer,width=900,height=700");
    if (!w) {
      alert("المتصفح منع فتح نافذة الطباعة. فعّل النوافذ المنبثقة (Popups) لهذا الموقع ثم حاول مرة أخرى.");
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
  };
  
  // Enhanced External Browser Printing
  // Image-based instant printing
  const printAsImage = (htmlContent, title) => {
    const printWindow = window.open('', '_blank', 'width=1200,height=800,scrollbars=yes,resizable=yes');
    if (!printWindow) {
      alert("تعذر فتح نافذة الطباعة. يرجى تفعيل النوافذ المنبثقة.");
      return;
    }
    
    const imageHtml = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
        <head>
          <meta charset="utf-8">
          <title>${title}</title>
          <style>
            @media print {
              @page { size: A4; margin: 10mm; }
              body { margin: 0; }
              .no-print { display: none !important; }
            }
            body { 
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              margin: 0;
              padding: 20px;
              background: #f0f2f5;
            }
            .print-container {
              max-width: 800px;
              margin: 0 auto;
              background: white;
              border-radius: 16px;
              box-shadow: 0 15px 35px rgba(0,0,0,0.1);
              padding: 40px;
            }
            .actions {
              text-align: center;
              margin-top: 40px;
              padding-top: 30px;
              border-top: 1px solid #e2e8f0;
            }
            .btn {
              padding: 15px 30px;
              margin: 0 15px;
              border: none;
              border-radius: 12px;
              cursor: pointer;
              font-size: 18px;
              font-weight: 600;
            }
            .btn-print {
              background: linear-gradient(135deg, #3b82f6, #2563eb);
              color: white;
            }
            .btn-close {
              background: #f1f5f9;
              color: #64748b;
            }
          </style>
        </head>
        <body>
          <div class="print-container">
            ${htmlContent}
            <div class="actions no-print">
              <button class="btn btn-print" onclick="window.print()">🖨️ طباعة فورية</button>
              <button class="btn btn-close" onclick="window.close()">❌ إغلاق</button>
            </div>
          </div>
        </body>
      </html>
    `;
    
    printWindow.document.write(imageHtml);
    printWindow.document.close();
    printWindow.focus();
    
    // Auto-print after a short delay
    setTimeout(() => {
      try {
        printWindow.print();
      } catch (e) {
        console.log("Autoprint failed - app.js:2982");
      }
    }, 1000);
  };

  const printToExternalBrowser = (htmlContent, title) => {
    const printWindow = window.open('', '_blank', 'width=1200,height=800,scrollbars=yes,resizable=yes');
    if (!printWindow) {
      alert("تعذر فتح نافذة الطباعة. يرجى تفعيل النوافذ المنبثقة.");
      return;
    }
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
        <head>
          <meta charset="utf-8">
          <title>${title}</title>
          <style>
            @media print {
              @page { size: A4; margin: 15mm; }
              body { margin: 0; }
              .no-print { display: none !important; }
              .print-container { box-shadow: none !important; border: none !important; }
            }
            body { 
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              margin: 0;
              padding: 20px;
              background: #f8fafc;
            }
            .print-container {
              max-width: 800px;
              margin: 0 auto;
              background: white;
              border-radius: 12px;
              box-shadow: 0 10px 25px rgba(0,0,0,0.1);
              padding: 30px;
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
              padding-bottom: 20px;
              border-bottom: 2px solid #e2e8f0;
            }
            .header h1 {
              color: #1e293b;
              margin: 0 0 10px 0;
              font-size: 28px;
            }
            .header p {
              color: #64748b;
              margin: 0;
              font-size: 16px;
            }
            .actions {
              text-align: center;
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #e2e8f0;
            }
            .btn {
              padding: 12px 24px;
              margin: 0 10px;
              border: none;
              border-radius: 8px;
              cursor: pointer;
              font-size: 16px;
              font-weight: 600;
            }
            .btn-print {
              background: linear-gradient(135deg, #3b82f6, #2563eb);
              color: white;
            }
            .btn-close {
              background: #f1f5f9;
              color: #64748b;
            }
          </style>
        </head>
        <body>
          <div class="print-container">
            ${htmlContent}
            <div class="actions no-print">
              <button class="btn btn-print" onclick="window.print()">طباعة</button>
              <button class="btn btn-close" onclick="window.close()">إغلاق</button>
            </div>
          </div>
        </body>
      </html>
    `);
    
    printWindow.document.close();
    printWindow.focus();
  };

  // Beautiful Audit Printing Functions
  const printGeneralAudit = () => {
    const auditItems = db.products.map(product => {
      const systemQty = product.qty || 0;
      const actualQty = systemQty; // In a real audit, this would come from user input
      const difference = actualQty - systemQty;
      
      return {
        name: product.name,
        barcode: product.barcode,
        systemQty,
        actualQty,
        difference,
        category: product.category || 'other'
      };
    });
    
    const categoryNames = {
      'roll': 'رول',
      'ajami': 'عجمي',
      'furniture': 'مفروشات',
      'home': 'منزلية',
      'other': 'أخرى'
    };
    
    const htmlContent = `
      <div class="header">
        <h1>📊 جرد المخزون العام</h1>
        <p>مخازن النرجس – درنة | ${new Date().toLocaleDateString('ar-LY')}</p>
      </div>
      
      <div style="margin-bottom: 25px; padding: 15px; background: #f1f5f9; border-radius: 8px;">
        <h3 style="margin: 0 0 10px 0; color: #1e293b;">ملخص الجرد</h3>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px;">
          <div style="text-align: center; padding: 10px; background: white; border-radius: 6px;">
            <div style="font-size: 24px; font-weight: bold; color: #3b82f6;">${db.products.length}</div>
            <div style="color: #64748b; font-size: 14px;">إجمالي الأصناف</div>
          </div>
          <div style="text-align: center; padding: 10px; background: white; border-radius: 6px;">
            <div style="font-size: 24px; font-weight: bold; color: #10b981;">${auditItems.filter(item => item.difference === 0).length}</div>
            <div style="color: #64748b; font-size: 14px;">مطابق</div>
          </div>
          <div style="text-align: center; padding: 10px; background: white; border-radius: 6px;">
            <div style="font-size: 24px; font-weight: bold; color: #ef4444;">${auditItems.filter(item => item.difference !== 0).length}</div>
            <div style="color: #64748b; font-size: 14px;">غير مطابق</div>
          </div>
        </div>
      </div>
      
      <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
        <thead>
          <tr style="background: linear-gradient(135deg, #3b82f6, #2563eb); color: white;">
            <th style="padding: 12px; text-align: right; border: 1px solid #cbd5e1;">الصنف</th>
            <th style="padding: 12px; text-align: center; border: 1px solid #cbd5e1;">الباركود</th>
            <th style="padding: 12px; text-align: center; border: 1px solid #cbd5e1;">التصنيف</th>
            <th style="padding: 12px; text-align: center; border: 1px solid #cbd5e1;">الكمية بالنظام</th>
            <th style="padding: 12px; text-align: center; border: 1px solid #cbd5e1;">الكمية الفعلية</th>
            <th style="padding: 12px; text-align: center; border: 1px solid #cbd5e1;">الفرق</th>
          </tr>
        </thead>
        <tbody>
          ${auditItems.map(item => `
            <tr style="background: ${item.difference === 0 ? '#f0fdf4' : '#fef2f2'};">
              <td style="padding: 10px; border: 1px solid #e2e8f0;">${escapeHtml(item.name)}</td>
              <td style="padding: 10px; text-align: center; border: 1px solid #e2e8f0;">${escapeHtml(item.barcode || '-')}</td>
              <td style="padding: 10px; text-align: center; border: 1px solid #e2e8f0;">
                <span style="padding: 4px 8px; border-radius: 12px; background: #e0f2fe; color: #0284c7; font-size: 12px;">
                  ${categoryNames[item.category] || 'غير محدد'}
                </span>
              </td>
              <td style="padding: 10px; text-align: center; border: 1px solid #e2e8f0;">${item.systemQty}</td>
              <td style="padding: 10px; text-align: center; border: 1px solid #e2e8f0;">${item.actualQty}</td>
              <td style="padding: 10px; text-align: center; border: 1px solid #e2e8f0; font-weight: bold; color: ${item.difference === 0 ? '#16a34a' : '#dc2626'};">
                ${item.difference > 0 ? '+' : ''}${item.difference}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      
      <div style="margin-top: 30px; padding: 20px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
        <h4 style="margin: 0 0 15px 0; color: #1e293b;">ملاحظات الجرد:</h4>
        <textarea style="width: 100%; min-height: 80px; padding: 12px; border: 1px solid #cbd5e1; border-radius: 6px; resize: vertical;" placeholder="أدخل ملاحظات الجرد هنا..."></textarea>
      </div>
    `;
    
    printToExternalBrowser(htmlContent, 'جرد المخزون العام');
  };
  
  const printItemAudit = (productId) => {
    const product = db.products.find(p => p.id === productId);
    if (!product) return;
    
    const categoryNames = {
      'roll': 'رول',
      'ajami': 'عجمي',
      'furniture': 'مفروشات',
      'home': 'منزلية',
      'other': 'أخرى'
    };
    
    const htmlContent = `
      <div class="header">
        <h1>🔍 جرد صنف فردي</h1>
        <p>مخازن النرجس – درنة | ${new Date().toLocaleDateString('ar-LY')}</p>
      </div>
      
      <div style="margin-bottom: 25px; padding: 20px; background: linear-gradient(135deg, #f0f9ff, #e0f2fe); border-radius: 12px; border: 1px solid #bae6fd;">
        <h3 style="margin: 0 0 15px 0; color: #0c4a6e; display: flex; align-items: center; gap: 10px;">
          <span>📦</span>
          تفاصيل الصنف
        </h3>
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px;">
          <div>
            <div style="font-weight: 600; color: #334155; margin-bottom: 5px;">اسم الصنف:</div>
            <div style="color: #0f172a; font-size: 18px;">${escapeHtml(product.name)}</div>
          </div>
          <div>
            <div style="font-weight: 600; color: #334155; margin-bottom: 5px;">رقم الصنف:</div>
            <div style="color: #0f172a; font-size: 18px;">${escapeHtml(product.sku)}</div>
          </div>
          <div>
            <div style="font-weight: 600; color: #334155; margin-bottom: 5px;">الباركود:</div>
            <div style="color: #0f172a;">${escapeHtml(product.barcode || 'غير متوفر')}</div>
          </div>
          <div>
            <div style="font-weight: 600; color: #334155; margin-bottom: 5px;">التصنيف:</div>
            <div>
              <span style="padding: 6px 12px; border-radius: 16px; background: #dbeafe; color: #1d4ed8; font-size: 14px; font-weight: 500;">
                ${categoryNames[product.category] || 'غير محدد'}
              </span>
            </div>
          </div>
        </div>
      </div>
      
      <div style="margin-bottom: 25px; padding: 20px; background: white; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
        <h3 style="margin: 0 0 20px 0; color: #1e293b; text-align: center;">📊 معلومات الكمية</h3>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px;">
          <div style="text-align: center; padding: 20px; background: #f0fdf4; border-radius: 10px; border: 2px solid #86efac;">
            <div style="font-size: 14px; color: #166534; margin-bottom: 8px;">الكمية بالنظام</div>
            <div style="font-size: 32px; font-weight: bold; color: #16a34a;">${product.qty || 0}</div>
          </div>
          <div style="text-align: center; padding: 20px; background: #f0f9ff; border-radius: 10px; border: 2px solid #93c5fd;">
            <div style="font-size: 14px; color: #1e40af; margin-bottom: 8px;">الكمية الفعلية</div>
            <input type="number" value="${product.qty || 0}" style="width: 100px; padding: 12px; font-size: 24px; text-align: center; border: 2px solid #3b82f6; border-radius: 8px; font-weight: bold;" id="actualQty">
          </div>
          <div style="text-align: center; padding: 20px; background: #fef2f2; border-radius: 10px; border: 2px solid #fca5a5;">
            <div style="font-size: 14px; color: #991b1b; margin-bottom: 8px;">الفرق</div>
            <div style="font-size: 32px; font-weight: bold; color: #dc2626;" id="difference">0</div>
          </div>
        </div>
      </div>
      
      <div style="margin-bottom: 25px; padding: 20px; background: #fffbeb; border-radius: 12px; border: 1px solid #fde68a;">
        <h3 style="margin: 0 0 15px 0; color: #92400e; display: flex; align-items: center; gap: 10px;">
          <span>📝</span>
          ملاحظات الجرد
        </h3>
        <textarea id="auditNotes" style="width: 100%; min-height: 100px; padding: 15px; border: 1px solid #fde68a; border-radius: 8px; resize: vertical; font-family: inherit;" placeholder="أدخل ملاحظات الجرد لهذا الصنف..."></textarea>
      </div>
      
      <div style="text-align: center; padding: 15px; background: #f1f5f9; border-radius: 8px; margin-top: 20px;">
        <div style="font-size: 14px; color: #64748b;">سعر الوحدة: <span style="font-weight: bold; color: #1e293b;">${fmtMoney(product.price || 0)} دينار</span></div>
        <div style="font-size: 14px; color: #64748b; margin-top: 5px;">القيمة الإجمالية: <span style="font-weight: bold; color: #1e293b;">${fmtMoney((product.qty || 0) * (product.price || 0))} دينار</span></div>
      </div>
      
      <script>
        const systemQty = ${product.qty || 0};
        const actualQtyInput = document.getElementById('actualQty');
        const differenceDiv = document.getElementById('difference');
        
        actualQtyInput.addEventListener('input', () => {
          const actualQty = parseInt(actualQtyInput.value) || 0;
          const diff = actualQty - systemQty;
          differenceDiv.textContent = (diff >= 0 ? '+' : '') + diff;
          differenceDiv.style.color = diff === 0 ? '#16a34a' : '#dc2626';
          
          const container = differenceDiv.closest('div');
          container.style.background = diff === 0 ? '#f0fdf4' : '#fef2f2';
          container.style.borderColor = diff === 0 ? '#86efac' : '#fca5a5';
        });
      </script>
    `;
    
    printToExternalBrowser(htmlContent, `جرد صنف: ${product.name}`);
  };
  
  // Date-based Audit Printing Function
  const printDateBasedAudit = (selectedDate) => {
    const auditDate = new Date(selectedDate);
    const formattedDate = auditDate.toLocaleDateString('ar-LY', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    
    // Filter products based on date (in a real system, you'd have date tracking)
    const auditItems = db.products.map(product => {
      const systemQty = product.qty || 0;
      const actualQty = systemQty; // Default to system quantity
      const difference = actualQty - systemQty;
      
      return {
        name: product.name,
        sku: product.sku,
        barcode: product.barcode,
        systemQty,
        actualQty,
        difference,
        category: product.category || 'other'
      };
    });
    
    const categoryNames = {
      'roll': 'رول',
      'ajami': 'عجمي',
      'furniture': 'مفروشات',
      'home': 'منزلية',
      'other': 'أخرى'
    };
    
    const htmlContent = `
      <div class="header">
        <h1>📅 جرد بتاريخ محدد</h1>
        <p>مخازن النرجس – درنة | ${formattedDate}</p>
      </div>
      
      <div style="margin-bottom: 25px; padding: 15px; background: linear-gradient(135deg, #ecfeff, #cffafe); border-radius: 12px; border: 1px solid #a5f3fc;">
        <h3 style="margin: 0 0 15px 0; color: #0891b2; display: flex; align-items: center; gap: 10px;">
          <span>🗓️</span>
          معلومات الجرد
        </h3>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px;">
          <div style="background: white; padding: 12px; border-radius: 8px; text-align: center;">
            <div style="font-size: 24px; font-weight: bold; color: #0891b2;">${db.products.length}</div>
            <div style="color: #0e7490; font-size: 14px;">إجمالي الأصناف</div>
          </div>
          <div style="background: white; padding: 12px; border-radius: 8px; text-align: center;">
            <div style="font-size: 24px; font-weight: bold; color: #10b981;">${auditDate.toLocaleDateString('ar-LY')}</div>
            <div style="color: #047857; font-size: 14px;">التاريخ المحدد</div>
          </div>
          <div style="background: white; padding: 12px; border-radius: 8px; text-align: center;">
            <div style="font-size: 24px; font-weight: bold; color: #8b5cf6;">${new Date().toLocaleTimeString('ar-LY', { hour: '2-digit', minute: '2-digit' })}</div>
            <div style="color: #7c3aed; font-size: 14px;">وقت الطباعة</div>
          </div>
        </div>
      </div>
      
      <table style="width: 100%; border-collapse: collapse; margin-top: 20px; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
        <thead>
          <tr style="background: linear-gradient(135deg, #0891b2, #06b6d4); color: white;">
            <th style="padding: 15px; text-align: right; border: 1px solid #0e7490;">اسم الصنف</th>
            <th style="padding: 15px; text-align: center; border: 1px solid #0e7490;">رقم الصنف</th>
            <th style="padding: 15px; text-align: center; border: 1px solid #0e7490;">الباركود</th>
            <th style="padding: 15px; text-align: center; border: 1px solid #0e7490;">التصنيف</th>
            <th style="padding: 15px; text-align: center; border: 1px solid #0e7490;">الكمية</th>
            <th style="padding: 15px; text-align: center; border: 1px solid #0e7490;">الحالة</th>
          </tr>
        </thead>
        <tbody>
          ${auditItems.map(item => `
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 12px; border: 1px solid #e2e8f0;">${escapeHtml(item.name)}</td>
              <td style="padding: 12px; text-align: center; border: 1px solid #e2e8f0; font-family: monospace;">${escapeHtml(item.sku)}</td>
              <td style="padding: 12px; text-align: center; border: 1px solid #e2e8f0;">
                <span style="padding: 4px 8px; background: #f1f5f9; border-radius: 6px; font-size: 12px; font-family: monospace;">
                  ${escapeHtml(item.barcode || 'غير متوفر')}
                </span>
              </td>
              <td style="padding: 12px; text-align: center; border: 1px solid #e2e8f0;">
                <span style="padding: 6px 12px; border-radius: 16px; background: #dbeafe; color: #1d4ed8; font-size: 12px; font-weight: 500;">
                  ${categoryNames[item.category] || 'غير محدد'}
                </span>
              </td>
              <td style="padding: 12px; text-align: center; border: 1px solid #e2e8f0; font-weight: bold;">${item.systemQty}</td>
              <td style="padding: 12px; text-align: center; border: 1px solid #e2e8f0;">
                <span style="padding: 6px 12px; border-radius: 20px; background: #dcfce7; color: #166534; font-weight: 600; font-size: 12px;">
                  ✅ متوفر
                </span>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      
      <div style="margin-top: 30px; padding: 20px; background: #fff7ed; border-radius: 12px; border: 1px solid #fed7aa;">
        <h3 style="margin: 0 0 15px 0; color: #c2410c; display: flex; align-items: center; gap: 10px;">
          <span>📋</span>
          ملاحظات الجرد
        </h3>
        <textarea style="width: 100%; min-height: 100px; padding: 15px; border: 1px solid #fed7aa; border-radius: 8px; resize: vertical; font-family: inherit;" placeholder="أدخل ملاحظات الجرد لهذا التاريخ..."></textarea>
      </div>
      
      <div style="margin-top: 25px; padding: 15px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; text-align: center;">
        <div style="font-size: 14px; color: #64748b;">تم إعداد هذا الجرد بتاريخ: ${new Date().toLocaleString('ar-LY')}</div>
        <div style="font-size: 14px; color: #64748b; margin-top: 5px;">نظام مخازن النرجس – درنة</div>
      </div>
    `;
    
    printToExternalBrowser(htmlContent, `جرد بتاريخ: ${formattedDate}`);
  };

  // Enhanced External Printing Functions
  
  // Image-based printing function
  const printAsImage = (htmlContent, title) => {
    const printWindow = window.open('', '_blank', 'width=1200,height=800,scrollbars=yes,resizable=yes');
    if (!printWindow) {
      alert("تعذر فتح نافذة الطباعة. يرجى تفعيل النوافذ المنبثقة.");
      return;
    }
    
    // Convert HTML to image using html2canvas approach
    const imageHtml = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
        <head>
          <meta charset="utf-8">
          <title>${title}</title>
          <style>
            @media print {
              @page { size: A4; margin: 10mm; }
              body { margin: 0; }
              .no-print { display: none !important; }
              .print-container { box-shadow: none !important; border: none !important; }
            }
            body { 
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              margin: 0;
              padding: 20px;
              background: #f0f2f5;
            }
            .print-container {
              max-width: 800px;
              margin: 0 auto;
              background: white;
              border-radius: 16px;
              box-shadow: 0 15px 35px rgba(0,0,0,0.1);
              padding: 40px;
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
              padding-bottom: 25px;
              border-bottom: 3px solid #e2e8f0;
            }
            .header h1 {
              color: #1e293b;
              margin: 0 0 12px 0;
              font-size: 32px;
              font-weight: 800;
            }
            .header p {
              color: #64748b;
              margin: 0;
              font-size: 18px;
            }
            .actions {
              text-align: center;
              margin-top: 40px;
              padding-top: 30px;
              border-top: 1px solid #e2e8f0;
            }
            .btn {
              padding: 15px 30px;
              margin: 0 15px;
              border: none;
              border-radius: 12px;
              cursor: pointer;
              font-size: 18px;
              font-weight: 600;
              transition: all 0.3s ease;
            }
            .btn-print {
              background: linear-gradient(135deg, #3b82f6, #2563eb);
              color: white;
              box-shadow: 0 8px 20px rgba(59, 130, 246, 0.3);
            }
            .btn-print:hover {
              transform: translateY(-2px);
              box-shadow: 0 12px 25px rgba(59, 130, 246, 0.4);
            }
            .btn-close {
              background: #f1f5f9;
              color: #64748b;
              border: 1px solid #e2e8f0;
            }
            .btn-close:hover {
              background: #e2e8f0;
            }
          </style>
        </head>
        <body>
          <div class="print-container">
            ${htmlContent}
            <div class="actions no-print">
              <button class="btn btn-print" onclick="window.print()">🖨️ طباعة فورية</button>
              <button class="btn btn-close" onclick="window.close()">❌ إغلاق</button>
            </div>
          </div>
        </body>
      </html>
    `;
    
    printWindow.document.write(imageHtml);
    printWindow.document.close();
    printWindow.focus();
    
    // Auto-print after a short delay
    setTimeout(() => {
      try {
        printWindow.print();
      } catch (e) {
        console.log("Autoprint failed, user can print manually - app.js:3492");
      }
    }, 1000);
  };
  
  const printInvoiceExternal = (id) => {
    const inv = db.invoices.find((x) => x.id === id);
    if (!inv) return;
    const driver = db.drivers.find((d) => d.id === inv.driverId);
    const items = (inv.items || []).map((l) => {
      const p = db.products.find((x) => x.id === l.productId);
      return {
        name: p?.name || "-",
        qty: Number(l.qty || 0),
        price: Number(l.price || 0),
        total: toLineTotal(l),
      };
    });

    const htmlContent = `
      <div class="header">
        <h1>🧾 فاتورة بيع</h1>
        <p>مخازن النرجس – درنة | ${new Date().toLocaleDateString('ar-LY')}</p>
      </div>
      
      <div style="margin-bottom: 25px; padding: 20px; background: linear-gradient(135deg, #f0f9ff, #e0f2fe); border-radius: 12px; border: 1px solid #bae6fd;">
        <h3 style="margin: 0 0 15px 0; color: #0c4a6e;">📋 معلومات الفاتورة</h3>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px;">
          <div>
            <div style="font-weight: 600; color: #334155; margin-bottom: 5px;">رقم الفاتورة:</div>
            <div style="color: #0f172a; font-size: 18px; font-weight: bold;">${escapeHtml(inv.no)}</div>
          </div>
          <div>
            <div style="font-weight: 600; color: #334155; margin-bottom: 5px;">التاريخ:</div>
            <div style="color: #0f172a;">${escapeHtml(fmtDateTime(inv.createdAt))}</div>
          </div>
          <div>
            <div style="font-weight: 600; color: #334155; margin-bottom: 5px;">العميل:</div>
            <div style="color: #0f172a;">${escapeHtml(inv.customerName || "زبون نقدي")}</div>
          </div>
          <div>
            <div style="font-weight: 600; color: #334155; margin-bottom: 5px;">السائق:</div>
            <div style="color: #0f172a;">${escapeHtml(driver?.name || "-")}</div>
          </div>
          <div>
            <div style="font-weight: 600; color: #334155; margin-bottom: 5px;">المستخدم:</div>
            <div style="color: #0f172a;">${escapeHtml(inv.createdBy || "-")}</div>
          </div>
        </div>
      </div>
      
      <div style="margin-bottom: 25px;">
        <h3 style="margin: 0 0 15px 0; color: #1e293b; padding-bottom: 10px; border-bottom: 2px solid #e2e8f0;">📦 تفاصيل الأصناف</h3>
        <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
          <thead>
            <tr style="background: linear-gradient(135deg, #3b82f6, #2563eb); color: white;">
              <th style="padding: 15px; text-align: right; border: 1px solid #1d4ed8;">الصنف</th>
              <th style="padding: 15px; text-align: center; border: 1px solid #1d4ed8;">الكمية</th>
              <th style="padding: 15px; text-align: center; border: 1px solid #1d4ed8;">سعر الوحدة</th>
              <th style="padding: 15px; text-align: center; border: 1px solid #1d4ed8;">الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            ${items
              .map(
                (it, index) =>
                  `<tr style="background: ${index % 2 === 0 ? '#f8fafc' : 'white'}; border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 12px; border: 1px solid #e2e8f0;">${escapeHtml(it.name)}</td>
                    <td style="padding: 12px; text-align: center; border: 1px solid #e2e8f0; font-weight: bold;">${escapeHtml(it.qty)}</td>
                    <td style="padding: 12px; text-align: center; border: 1px solid #e2e8f0;">${escapeHtml(fmtMoney(it.price))}</td>
                    <td style="padding: 12px; text-align: center; border: 1px solid #e2e8f0; font-weight: bold; color: #0f172a;">${escapeHtml(fmtMoney(it.total))}</td>
                  </tr>`
              )
              .join("")}
          </tbody>
        </table>
      </div>
      
      <div style="margin-bottom: 25px; padding: 20px; background: #f0fdf4; border-radius: 12px; border: 2px solid #86efac;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <h3 style="margin: 0; color: #166534; font-size: 20px;">💰 الإجمالي النهائي</h3>
          <div style="font-size: 28px; font-weight: bold; color: #16a34a;">${escapeHtml(fmtMoney(inv.total))} دينار</div>
        </div>
      </div>
      
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 20px; background: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0;">
        <div style="font-weight: 600; color: #1e293b;">نظام مخازن النرجس – درنة</div>
        <div>توقيع العميل: ....................................</div>
      </div>
    `;

    printToExternalBrowser(htmlContent, `فاتورة ${escapeHtml(inv.no)}`);
  };
  
  const printIssueExternal = (id) => {
    const it = db.issues.find((x) => x.id === id);
    if (!it) return;
    const driver = db.drivers.find((d) => d.id === it.driverId);
    const items = (it.items || []).map((l) => {
      const p = db.products.find((x) => x.id === l.productId);
      return { name: p?.name || "-", barcode: p?.barcode || "", qty: l.qty };
    });

    const htmlContent = `
      <div class="header">
        <h1>📦 إذن صرف</h1>
        <p>مخازن النرجس – درنة | ${new Date().toLocaleDateString('ar-LY')}</p>
      </div>
      
      <div style="margin-bottom: 25px; padding: 20px; background: linear-gradient(135deg, #fffbeb, #fef3c7); border-radius: 12px; border: 1px solid #fde68a;">
        <h3 style="margin: 0 0 15px 0; color: #92400e;">📋 معلومات الإذن</h3>
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px;">
          <div>
            <div style="font-weight: 600; color: #334155; margin-bottom: 5px;">رقم الإذن:</div>
            <div style="color: #0f172a; font-size: 18px; font-weight: bold;">${escapeHtml(it.no)}</div>
          </div>
          <div>
            <div style="font-weight: 600; color: #334155; margin-bottom: 5px;">التاريخ:</div>
            <div style="color: #0f172a;">${escapeHtml(fmtDateTime(it.createdAt))}</div>
          </div>
          <div>
            <div style="font-weight: 600; color: #334155; margin-bottom: 5px;">السائق:</div>
            <div style="color: #0f172a;">${escapeHtml(driver?.name || "-")}</div>
          </div>
          <div>
            <div style="font-weight: 600; color: #334155; margin-bottom: 5px;">المستخدم:</div>
            <div style="color: #0f172a;">${escapeHtml(it.createdBy || "-")}</div>
          </div>
        </div>
      </div>
      
      <div style="margin-bottom: 25px;">
        <h3 style="margin: 0 0 15px 0; color: #1e293b; padding-bottom: 10px; border-bottom: 2px solid #e2e8f0;">📦 تفاصيل الأصناف المصروفة</h3>
        <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
          <thead>
            <tr style="background: linear-gradient(135deg, #f59e0b, #d97706); color: white;">
              <th style="padding: 15px; text-align: right; border: 1px solid #92400e;">الصنف</th>
              <th style="padding: 15px; text-align: center; border: 1px solid #92400e;">الباركود</th>
              <th style="padding: 15px; text-align: center; border: 1px solid #92400e;">الكمية</th>
            </tr>
          </thead>
          <tbody>
            ${items
              .map(
                (x, index) =>
                  `<tr style="background: ${index % 2 === 0 ? '#fffbeb' : '#fef3c7'}; border-bottom: 1px solid #fde68a;">
                    <td style="padding: 12px; border: 1px solid #fde68a;">${escapeHtml(x.name)}</td>
                    <td style="padding: 12px; text-align: center; border: 1px solid #fde68a; font-family: monospace;">${escapeHtml(x.barcode)}</td>
                    <td style="padding: 12px; text-align: center; border: 1px solid #fde68a; font-weight: bold;">${escapeHtml(x.qty)}</td>
                  </tr>`
              )
              .join("")}
          </tbody>
        </table>
      </div>
      
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 20px; background: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0;">
        <div style="font-weight: 600; color: #1e293b;">نظام مخازن النرجس – درنة</div>
        <div>توقيع المستلم: ....................................</div>
      </div>
    `;

    printToExternalBrowser(htmlContent, `إذن صرف ${escapeHtml(it.no)}`);
  };

  const printReturn = (id) => {
    const ret = db.returns?.find((x) => x.id === id);
    if (!ret) return;
    
    const originalPurchase = db.purchases?.find(p => p.id === ret.originalPurchaseId);
    
    const html = `
      <html dir="rtl" lang="ar">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>إيصال إرجاع ${escapeHtml(ret.id)}</title>
          <style>
            @page { size: A4 portrait; margin: 20mm; }
            *{box-sizing:border-box;}
            body{font-family:Tahoma,Arial,sans-serif;margin:0;background:#f3f4f6;color:#0f172a;}
            .sheet{max-width:800px;margin:20px auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:24px 28px;box-shadow:0 18px 40px rgba(15,23,42,0.16);}
            .sheet__header{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:18px;}
            .sheet__title{font-size:24px;font-weight:800;margin:0;color:#0f172a;}
            .sheet__sub{font-size:13px;color:#6b7280;margin-top:4px;}
            .brand{display:flex;align-items:center;gap:10px;}
            .brand-mark{width:40px;height:40px;border-radius:14px;background:radial-gradient(circle at 30% 30%,#2563eb,#4f46e5);box-shadow:0 10px 24px rgba(37,99,235,0.35);}
            .meta-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px 18px;font-size:13px;color:#111827;margin-top:6px;}
            .meta-label{color:#6b7280;margin-inline-start:4px;}
            .meta-value{font-weight:600;}
            .section-title{font-size:15px;font-weight:700;margin:18px 0 8px;color:#111827;}
            table{width:100%;border-collapse:collapse;margin-top:6px;}
            th,td{border:1px solid #e5e7eb;padding:8px 6px;font-size:12px;}
            th{background:#f3f4ff;text-align:right;color:#1f2937;}
            tbody tr:nth-child(even){background:#f9fafb;}
            .totals{margin-top:14px;font-size:14px;max-width:260px;margin-inline-start:auto;border:1px solid #e5e7eb;border-radius:10px;padding:10px 12px;background:#f9fafb;}
            .totals-row{display:flex;justify-content:space-between;margin-top:4px;font-weight:700;}
            .footer{margin-top:20px;font-size:12px;color:#6b7280;display:flex;justify-content:space-between;align-items:center;}
            .footer .brand-small{font-weight:700;color:#111827;}
            .actions{margin-top:16px;display:flex;justify-content:flex-end;gap:10px;}
            .btn{padding:8px 12px;font-size:12px;border-radius:999px;border:1px solid #d1d5db;background:#ffffff;cursor:pointer;}
            .btn-primary{background:linear-gradient(90deg,#2563eb,#4f46e5);color:#f9fafb;border-color:rgba(37,99,235,0.8);}
            @media print{
              body{background:#ffffff;}
              .sheet{margin:0;border:none;box-shadow:none;border-radius:0;}
              .actions{display:none;}
            }
          </style>
        </head>
        <body>
          <div class="sheet">
            <div class="sheet__header">
              <div>
                <h1 class="sheet__title">مخازن النرجس – درنة</h1>
                <div class="sheet__sub">إيصال إرجاع مشتريات</div>
              </div>
              <div class="brand">
                <div class="brand-mark"></div>
              </div>
            </div>
            <div class="meta-grid">
              <div><span class="meta-label">رقم الإيصال:</span><span class="meta-value">${escapeHtml(ret.id)}</span></div>
              <div><span class="meta-label">التاريخ:</span><span class="meta-value">${escapeHtml(fmtDateTime(ret.createdAt))}</span></div>
              <div><span class="meta-label">فاتورة الشراء الأصلية:</span><span class="meta-value">${escapeHtml(originalPurchase?.id || ret.originalPurchaseId)}</span></div>
              <div><span class="meta-label">المورد:</span><span class="meta-value">${escapeHtml(ret.supplier || "-")}</span></div>
              <div><span class="meta-label">المستخدم:</span><span class="meta-value">${escapeHtml(ret.createdBy || "-")}</span></div>
            </div>
            <div class="section-title">تفاصيل الأصناف المرتجعة</div>
            <table>
              <thead>
                <tr><th>الصنف</th><th>الكمية المرتجعة</th><th>سعر الوحدة</th><th>الإجمالي</th></tr>
              </thead>
              <tbody>
                ${(ret.items || [])
                  .map(item => {
                    const product = db.products.find(p => p.id === item.productId);
                    return `<tr>
                      <td>${escapeHtml(product?.name || "-")}</td>
                      <td>${escapeHtml(item.qty || 0)}</td>
                      <td>${escapeHtml(fmtMoney(item.price || 0))}</td>
                      <td>${escapeHtml(fmtMoney((item.qty || 0) * (item.price || 0)))}</td>
                    </tr>`;
                  })
                  .join("")}
              </tbody>
            </table>
            <div class="totals">
              <div class="totals-row">
                <span>الإجمالي المرتجع</span>
                <span>${escapeHtml(fmtMoney(ret.total || 0))}</span>
              </div>
            </div>
            <div class="footer">
              <span class="brand-small">نظام مخازن النرجس – درنة</span>
              <span>توقيع المورد: ....................................</span>
            </div>
            <div class="actions">
              <button class="btn" onclick="window.close()">إغلاق</button>
              <button class="btn btn-primary" onclick="window.print()">طباعة</button>
            </div>
          </div>
        </body>
      </html>
    `;

    const w = window.open("", "_blank", "noopener,noreferrer,width=900,height=700");
    if (!w) {
      alert("المتصفح منع فتح نافذة الطباعة. فعّل النوافذ المنبثقة (Popups) لهذا الموقع ثم حاول مرة أخرى.");
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
  };

  /* =========================
     تشغيل التطبيق
  ========================= */

  if (db.session.userId && db.session.token) {
    showApp();
  } else {
    showLogin();
  }

  if (!location.hash) location.hash = "#/dashboard";
})();
            table{width:100%;border-collapse:collapse;margin-top:6px;}
            th,td{border:1px solid #e5e7eb;padding:8px 6px;font-size:12px;}
            th{background:#f3f4ff;text-align:right;color:#1f2937;}
            tbody tr:nth-child(even){background:#f9fafb;}
            .totals{margin-top:14px;font-size:14px;max-width:260px;margin-inline-start:auto;border:1px solid #e5e7eb;border-radius:10px;padding:10px 12px;background:#f9fafb;}
            .totals-row{display:flex;justify-content:space-between;margin-top:4px;font-weight:700;}
            .footer{margin-top:20px;font-size:12px;color:#6b7280;display:flex;justify-content:space-between;align-items:center;}
            .footer .brand-small{font-weight:700;color:#111827;}
            .actions{margin-top:16px;display:flex;justify-content:flex-end;gap:10px;}
            .btn{padding:8px 12px;font-size:12px;border-radius:999px;border:1px solid #d1d5db;background:#ffffff;cursor:pointer;}
            .btn-primary{background:linear-gradient(90deg,#2563eb,#4f46e5);color:#f9fafb;border-color:rgba(37,99,235,0.8);}
            @media print{
              body{background:#ffffff;}
              .sheet{margin:0;border:none;box-shadow:none;border-radius:0;}
              .actions{display:none;}
            }
          </style>
        </head>
        <body>
          <div class="sheet">
            <div class="sheet__header">
              <div>
                <h1 class="sheet__title">مخازن النرجس – درنة</h1>
                <div class="sheet__sub">إيصال إرجاع مشتريات</div>
              </div>
              <div class="brand">
                <div class="brand-mark"></div>
              </div>
            </div>
            <div class="meta-grid">
              <div><span class="meta-label">رقم الإيصال:</span><span class="meta-value">${escapeHtml(ret.id)}</span></div>
              <div><span class="meta-label">التاريخ:</span><span class="meta-value">${escapeHtml(fmtDateTime(ret.createdAt))}</span></div>
              <div><span class="meta-label">فاتورة الشراء الأصلية:</span><span class="meta-value">${escapeHtml(originalPurchase?.id || ret.originalPurchaseId)}</span></div>
              <div><span class="meta-label">المورد:</span><span class="meta-value">${escapeHtml(ret.supplier || "-")}</span></div>
              <div><span class="meta-label">المستخدم:</span><span class="meta-value">${escapeHtml(ret.createdBy || "-")}</span></div>
            </div>
            <div class="section-title">تفاصيل الأصناف المرتجعة</div>
            <table>
              <thead>
                <tr><th>الصنف</th><th>الكمية المرتجعة</th><th>سعر الوحدة</th><th>الإجمالي</th></tr>
              </thead>
              <tbody>
                ${(ret.items || [])
                  .map(item => {
                    const product = db.products.find(p => p.id === item.productId);
                    return `<tr>
                      <td>${escapeHtml(product?.name || "-")}</td>
                      <td>${escapeHtml(item.qty || 0)}</td>
                      <td>${escapeHtml(fmtMoney(item.price || 0))}</td>
                      <td>${escapeHtml(fmtMoney((item.qty || 0) * (item.price || 0)))}</td>
                    </tr>`;
                  })
                  .join("")}
              </tbody>
            </table>
            <div class="totals">
              <div class="totals-row">
                <span>الإجمالي المرتجع</span>
                <span>${escapeHtml(fmtMoney(ret.total || 0))}</span>
              </div>
            </div>
            <div class="footer">
              <span class="brand-small">نظام مخازن النرجس – درنة</span>
              <span>توقيع المورد: ....................................</span>
            </div>
            <div class="actions">
              <button class="btn" onclick="window.close()">إغلاق</button>
              <button class="btn btn-primary" onclick="window.print()">طباعة</button>
            </div>
          </div>
        </body>
      </html>
    `;

    const w = window.open("", "_blank", "noopener,noreferrer,width=900,height=700");
    if (!w) {
      alert("المتصفح منع فتح نافذة الطباعة. فعّل النوافذ المنبثقة (Popups) لهذا الموقع ثم حاول مرة أخرى.");
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
  };

  /* =========================
     تشغيل التطبيق
  ========================= */

  if (db.session.userId && db.session.token) {
    showApp();
  } else {
    showLogin();
  }

  if (!location.hash) location.hash = "#/dashboard";
})();

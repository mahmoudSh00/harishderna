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

  const routes = ["dashboard", "products", "drivers", "issue", "sales", "audit", "users"];

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
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(p.name)}</td>
        <td>${escapeHtml(p.sku)}</td>
        <td>
          <div class="badge">${escapeHtml(p.barcode || "")}</div>
        </td>
        <td>${escapeHtml(p.qty)}</td>
        <td>${escapeHtml(fmtMoney(p.price))}</td>
        <td class="actions">
          <button class="btn btn--ghost" data-action="barcodeProduct" data-id="${escapeHtml(p.id)}">باركود</button>
          <button class="btn btn--ghost" data-action="editProduct" data-id="${escapeHtml(p.id)}">تعديل</button>
          <button class="btn btn--danger" data-action="deleteProduct" data-id="${escapeHtml(p.id)}">حذف</button>
        </td>
      `;
      tbody.appendChild(tr);
    }

    if (!items.length) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="6" class="muted">لا توجد منتجات مطابقة.</td>`;
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
      `;
      tbody.appendChild(tr);
    }

    if (!db.products.length) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="5" class="muted">لا توجد منتجات للجرد.</td>`;
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

  const productForm = (initial, onSave) => {
    const p = initial || {
      id: null,
      name: "",
      sku: "",
      barcode: "",
      qty: 0,
      price: 0,
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
      const qty = clampNumber(pQty.value, { min: 0 });
      const price = clampNumber(pPrice.value, { min: 0 });
      const barcode = (pBarcode.value.trim() || newBarcodeValue()).toUpperCase();

      if (!name) return showError("اسم المنتج مطلوب.");
      if (!sku) return showError("رقم الصنف مطلوب.");
      if (!barcode) return showError("الباركود مطلوب.");

      const barcodeExists = db.products.some((x) => x.barcode === barcode && x.id !== p.id);
      if (barcodeExists) return showError("هذا الباركود مستخدم لمنتج آخر.");

      onSave({ ...p, name, sku, qty, price, barcode });
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
    if (!db.products.length) return;
    const inputs = $$("[data-audit-actual]");
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
    if (!lines.length) {
      confirmDialog("تنبيه", "أدخل كميات فعلية لمنتج واحد على الأقل ثم احفظ.", () => {});
      return;
    }
    const id = nextId("audit", "au");
    const no = `AUD-${String(db.meta.counters.audit - 1).padStart(6, "0")}`;
    const now = new Date().toISOString();
    db.audits.push({
      id,
      no,
      createdAt: now,
      createdBy: getCurrentUser()?.username || "",
      lines,
    });
    persist();
    renderAudit();
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
    if (action === "printInvoice") printInvoice(id);
    if (action === "deleteInvoice") deleteInvoice(id);

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

  $("#btnAddDriver").addEventListener("click", openAddDriver);

  $("#btnNewIssue").addEventListener("click", openNewIssue);

  $("#btnNewInvoice").addEventListener("click", openNewInvoice);

  $("#btnSaveAudit").addEventListener("click", saveAudit);

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

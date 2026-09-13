/* ============================================================
   SIC Enterprise - Application Logic (Complete)
   ============================================================ */

// ============ DOM HELPERS ============
const $  = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

// ============ GLOBAL STATE ============
let currentUser = null;
let inventoryMode = 'manual';
let editingCustomerId = null;
let editingSupplierId = null;
let editingProductId = null;

// ============ 🚀 APP START ============
document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

function initApp() {
  const status = checkActivation();

  if (status.status === 'expired') {
    showActivationScreen();
    return;
  }

  if (status.status === 'trial' && status.daysLeft <= 1) {
    setTimeout(() => showTrialWarning(status.daysLeft), 1500);
  }

  showLoginScreen();
  bindEvents();
  loadSettings();
  applyTheme();
  setTimeout(renderActivationSection, 500);
}

// ============ 🔒 شاشة التفعيل ============
function showActivationScreen() {
  $('#activationScreen').classList.remove('hidden');
  $('#loginScreen').classList.add('hidden');
  $('#activationCodeDisplay').textContent = getDeviceId();

  $('#activationBtn').onclick = () => {
    const code = $('#activationInput').value;
    const result = tryActivate(code);

    if (result.success) {
      toast('✅ تم تفعيل التطبيق بنجاح');
      setTimeout(() => {
        $('#activationScreen').classList.add('hidden');
        showLoginScreen();
      }, 1000);
    } else {
      $('#activationError').textContent = result.message;
    }
  };

  $('#activationInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') $('#activationBtn').click();
  });
}

// ============ 🔔 تحذير قرب انتهاء التجربة ============
function showTrialWarning(daysLeft) {
  const content = $('#trialWarningContent');
  const code = getDeviceId();

  content.innerHTML = `
    <div style="font-size:48px;margin-bottom:12px;">${daysLeft === 0 ? '⏰' : '⏳'}</div>
    <h3 style="color:var(--warning);margin-bottom:12px;font-size:18px;">
      ${daysLeft === 0 ? 'آخر يوم!' : `باقي ${daysLeft} ${daysLeft === 1 ? 'يوم' : 'أيام'}`}
    </h3>
    <p style="color:var(--muted);font-size:13px;margin-bottom:16px;line-height:1.7;">
      لتفعيل التطبيق نهائياً، أرسل الكود التالي للمطور:
    </p>
    <div style="background:var(--card2);padding:12px;border-radius:10px;font-family:monospace;font-weight:800;color:var(--primary);letter-spacing:2px;margin-bottom:16px;font-size:14px;word-break:break-all;">
      ${code}
    </div>
    <button class="btn primary full" onclick="document.getElementById('trialWarningModal').classList.remove('show'); go('settings');">
      🔑 تفعيل الآن
    </button>
  `;

  $('#trialWarningModal').classList.add('show');
  $('#closeTrialWarning').onclick = () => $('#trialWarningModal').classList.remove('show');
}

// ============ 🛡️ شاشة الدخول ============
function showLoginScreen() {
  const screen = $('#loginScreen');
  screen.classList.remove('hidden');

  const saved = localStorage.getItem('sic_session');
  if (saved) {
    try {
      const s = JSON.parse(saved);
      const u = state.users.find(x => x.id === s.id);
      if (u) {
        currentUser = u;
        screen.classList.add('hidden');
        afterLogin();
        return;
      }
    } catch {}
  }

  $('#userLoginBtn').onclick = () => doUserLogin();
  $('#pinLoginBtn').onclick = () => doPinLogin();
  $('#switchToPin').onclick = () => switchLoginView('pin');
  $('#switchToUser').onclick = () => switchLoginView('user');

  if (window.PublicKeyCredential) {
    $('#fingerprintBtn').style.display = 'block';
    $('#fingerprintBtn').onclick = () => toast('👆 البصمة تحتاج HTTPS', 'error');
  }

  $('#loginPass').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') doUserLogin();
  });
  $('#loginPin').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') doPinLogin();
  });
}

function switchLoginView(view) {
  if (view === 'pin') {
    $('#userView').style.display = 'none';
    $('#pinView').style.display = 'block';
    setTimeout(() => $('#loginPin').focus(), 100);
  } else {
    $('#userView').style.display = 'block';
    $('#pinView').style.display = 'none';
    setTimeout(() => $('#loginUser').focus(), 100);
  }
  $('#loginError').textContent = '';
}

function doUserLogin() {
  const u = $('#loginUser').value.trim().toLowerCase();
  const p = $('#loginPass').value.trim();
  const err = $('#loginError');

  if (!u || !p) { err.textContent = 'أدخل المستخدم وكلمة المرور'; return; }

  const user = state.users.find(x => x.username === u && x.password === p);
  if (!user) {
    err.textContent = '❌ بيانات خاطئة';
    $('#loginPass').value = '';
    return;
  }
  completeLogin(user);
}

function doPinLogin() {
  const pin = $('#loginPin').value.trim();
  const err = $('#loginError');

  if (!pin || pin.length < 4) { err.textContent = 'أدخل رمز PIN من 4 أرقام'; return; }

  const user = state.users.find(x => x.pin === pin);
  if (!user) {
    err.textContent = '❌ PIN خاطئ';
    $('#loginPin').value = '';
    return;
  }
  completeLogin(user);
}

function completeLogin(user) {
  currentUser = user;
  localStorage.setItem('sic_session', JSON.stringify({ id: user.id, username: user.username }));

  $('#loginScreen').classList.add('hidden');
  $('#loginError').textContent = '';
  $('#loginUser').value = '';
  $('#loginPass').value = '';
  $('#loginPin').value = '';

  afterLogin();
}

function afterLogin() {
  applyPermissions();
  renderAll();
  renderCart();
  go('dashboard');
  if (state.settings.autoBackup) checkAutoBackup();
}

// ============ 🎭 الصلاحيات ============
function applyPermissions() {
  if (!currentUser) return;

  const isAdmin = currentUser.role === 'admin';
  const isManager = currentUser.role === 'manager';

  $$('.admin-only').forEach(el => el.classList.toggle('hidden', !isAdmin));

  $('#userBadge').textContent = isAdmin ? '👑' : (isManager ? '🧰' : '👤');
  $('#userBadge').title = currentUser.name;

  const du = $('#drawerUser');
  if (du) du.textContent = `مرحباً، ${currentUser.name}`;

  const dcn = $('#drawerCompanyName');
  if (dcn) dcn.textContent = state.settings.companyName || 'SIC Enterprise';

  updateDrawerTrial();
}

function updateDrawerTrial() {
  const el = $('#drawerTrial');
  if (!el) return;

  if (state.activation && state.activation.active) {
    el.style.display = 'block';
    el.textContent = '✅ مُفعّل مدى الحياة';
    el.style.color = 'var(--success)';
    el.style.background = 'rgba(34,197,94,.15)';
  } else if (state.trial) {
    const start = new Date(state.trial.startDate).getTime();
    const elapsed = Date.now() - start;
    const daysUsed = Math.floor(elapsed / MS_PER_DAY);
    const daysLeft = Math.max(0, TRIAL_DAYS - daysUsed);

    el.style.display = 'block';
    el.textContent = `⏳ تجربة: باقي ${daysLeft} يوم`;
    el.style.color = daysLeft <= 3 ? 'var(--danger)' : 'var(--warning)';
    el.style.background = daysLeft <= 3 ? 'rgba(239,68,68,.15)' : 'rgba(245,158,11,.15)';
  }
}

// ============ 🔗 ربط الأحداث ============
function bindEvents() {
  $('#menuBtn').onclick = openDrawer;
  $('#overlay').onclick = closeDrawer;

  $$('.drawer-nav a').forEach(a => {
    a.onclick = (e) => { e.preventDefault(); go(a.dataset.page); };
  });

  $$('.grid-card').forEach(c => {
    c.onclick = () => go(c.dataset.page);
  });

  $('#logoutBtn').onclick = () => {
    if (!confirm('تسجيل الخروج؟')) return;
    localStorage.removeItem('sic_session');
    location.reload();
  };

  $('#themeBtn').onclick = toggleTheme;

  $$('.mode-tab').forEach(tab => {
    tab.onclick = () => {
      $$('.mode-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      inventoryMode = tab.dataset.source;
      const supBox = $('#supplierPurchaseBox');
      supBox.style.display = inventoryMode === 'supplier' ? 'block' : 'none';

      if (inventoryMode === 'supplier') {
        $('#prodSupplier').innerHTML = state.suppliers.length
          ? state.suppliers.map(s => `<option value="${s.id}">${s.name}</option>`).join('')
          : '<option value="">⚠️ لا يوجد موردين</option>';
      }
    };
  });

  $('#toggleAddProduct').onclick = () => {
    const panel = $('#invAddPanel');
    const shown = panel.style.display !== 'none';

    if (shown) {
      resetProductForm();
    } else {
      resetProductForm();
      panel.style.display = 'block';
      $('#toggleAddProduct').textContent = '✖️ إغلاق النموذج';
    }
  };

  $('#addProduct').onclick = addProduct;
  $('#invExport').onclick = exportProducts;

  $('#searchProduct').addEventListener('input', renderProductTable);
  $('#searchCustomer').addEventListener('input', renderCustomerList);
  $('#searchSupplier').addEventListener('input', renderSupplierList);
  $('#searchInvoice').addEventListener('input', renderInvoiceList);
  $('#searchTreasury').addEventListener('input', renderTreasury);
  $('#invoiceFilter').onchange = renderInvoiceList;
  $('#treasuryPeriod').onchange = renderTreasury;
  $('#treasuryType').onchange = renderTreasury;
  $('#logFilter').onchange = renderActivityLog;
  $('#logExport').onclick = exportActivityLog;

  $('#openScannerPOS').onclick = () => startScanner('pos');
  $('#openScanner').onclick = () => startScanner('inventory');
  $('#closeScanner').onclick = stopScanner;
  $('#addToCart').onclick = addToCartManual;
  $('#posQuickSearch').addEventListener('input', onPosSearch);
  $('#posBtnHistory').onclick = openPosHistory;
  $('#closePosHistory').onclick = () => $('#posHistoryModal').classList.remove('show');
  $('#posBtnClear').onclick = clearCart;
  $('#posBtnNew').onclick = () => { clearCart(true); $('#posQuickSearch').focus(); };
  $('#posBtnValidate').onclick = () => checkout();
  $('#checkoutBtn').onclick = () => checkout();

  $$('input[name="payType"]').forEach(r => {
    r.onchange = () => {
      const val = $('#page-pos').querySelector('input[name="payType"]:checked').value;
      $('#creditCustomerBox').style.display = val === 'credit' ? 'block' : 'none';
    };
  });

  $('#toggleAddCustomer').onclick = toggleCustomerForm;
  $('#saveCustomerBtn').onclick = saveCustomer;
  $('#cancelCustomerBtn').onclick = cancelCustomerForm;
  $('#custExport').onclick = exportCustomers;

  $('#toggleAddSupplier').onclick = toggleSupplierForm;
  $('#saveSupplierBtn').onclick = saveSupplier;
  $('#cancelSupplierBtn').onclick = cancelSupplierForm;
  $('#supExport').onclick = exportSuppliers;

  $('#closeReceipt').onclick = () => $('#receiptModal').classList.remove('show');
  $('#printReceipt').onclick = () => window.print();
  $('#closePayDebt').onclick = () => $('#payDebtModal').classList.remove('show');
  $('#confirmPayDebt').onclick = confirmPayDebt;
  $('#closeHistory').onclick = () => $('#historyModal').classList.remove('show');
  $('#closeStatement').onclick = () => $('#statementModal').classList.remove('show');
  $('#printStatement').onclick = () => window.print();

  $('#treasuryExport').onclick = exportTreasury;
  $('#adjustBalanceBtn').onclick = adjustBalanceManually;

  $('#statsFrom').onchange = renderReports;
  $('#statsTo').onchange = renderReports;
  $$('.date-quick').forEach(btn => {
    btn.onclick = () => {
      $$('.date-quick').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      setQuickDateRange(btn.dataset.range);
      renderReports();
    };
  });

  $('#backupExport').onclick = exportBackup;
  $('#backupImport').onclick = () => $('#backupFileInput').click();
  $('#backupFileInput').onchange = importBackup;
  $('#backupAutoToggle').onclick = toggleAutoBackup;
  $('#backupExcel').onclick = exportExcelBundle;
  $('#backupReset').onclick = resetAllData;

  $('#saveSettings').onclick = saveSettings;

  $('#toggleAddUser').onclick = () => {
    const p = $('#userAddPanel');
    const shown = p.style.display !== 'none';
    p.style.display = shown ? 'none' : 'block';
    $('#toggleAddUser').textContent = shown ? '➕ إضافة مستخدم' : '✖️ إغلاق النموذج';
  };
  $('#addUserBtn').onclick = addUser;

  const openActBtn = $('#openActivationBtn');
  if (openActBtn) openActBtn.onclick = openActivationFromSettings;
}

// ============ 🧭 التنقل ============
function go(page) {
  $$('.page').forEach(p => p.classList.remove('active'));
  const target = $('#page-' + page);
  if (target) target.classList.add('active');

  $$('.drawer-nav a').forEach(a => {
    a.classList.toggle('active', a.dataset.page === page);
  });

  closeDrawer();
  renderAll();

  if (page === 'stats') {
    setTimeout(() => {
      if (!$('#statsFrom').value) setQuickDateRange('today');
      renderReports();
    }, 100);
  }

  if (page === 'settings') {
    setTimeout(renderActivationSection, 150);
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}
window.go = go;

const drawer = $('#drawer');
const overlay = $('#overlay');

function openDrawer() {
  drawer.classList.add('open');
  overlay.classList.add('show');
}

function closeDrawer() {
  drawer.classList.remove('open');
  overlay.classList.remove('show');
}

// ============ 🎨 الوضع الليلي ============
function applyTheme() {
  const isDark = state.settings.darkMode === true;
  document.body.classList.toggle('dark', isDark);
  const btn = $('#themeBtn');
  if (btn) btn.textContent = isDark ? '☀️' : '🌙';
}

function toggleTheme() {
  const isDark = !document.body.classList.contains('dark');
  document.body.classList.toggle('dark', isDark);
  $('#themeBtn').textContent = isDark ? '☀️' : '🌙';

  state.settings.darkMode = isDark;
  DB.set('settings', state.settings);

  if ($('#page-stats').classList.contains('active')) {
    setTimeout(renderReports, 150);
  }
}

// ============ 🔔 Toast ============
function toast(msg, type = 'success') {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'toast show' + (type === 'error' ? ' error' : (type === 'warning' ? ' warning' : ''));
  clearTimeout(t._tm);
  t._tm = setTimeout(() => t.className = 'toast', 2400);
}
window.toast = toast;

// ============ ⚙️ تحميل الإعدادات ============
function loadSettings() {
  const s = state.settings;

  const el = (id) => $('#' + id);
  if (el('setCompanyName')) {
    el('setCompanyName').value = s.companyName || '';
    el('setLogo').value = s.logo || '◆';
    el('setPhone').value = s.phone || '';
    el('setEmail').value = s.email || '';
    el('setAddress').value = s.address || '';
    el('setPaperSize').value = s.paperSize || '80mm';
    el('setReceiptFooter').value = s.receiptFooter || '';
    el('setInvoiceStart').value = s.invoiceStart || 1;
    el('setCurrency').value = s.currency || 'دج';
    el('setLanguage').value = s.language || 'ar';
    el('setDarkMode').checked = s.darkMode === true;
    el('setLowStockAlert').value = s.lowStockAlert || 5;
    el('setLowBalanceAlert').value = s.lowBalanceAlert || 0;
    el('setSensitivePassword').value = s.sensitivePassword || '';
  }

  $('#logoIcon').textContent = s.logo || '◆';
  const companyName = s.companyName || 'SIC Enterprise';
  $('#logoText').innerHTML = `${companyName} <small>Enterprise</small>`;

  const dcn = $('#drawerCompanyName');
  if (dcn) dcn.textContent = companyName;
}

// ============================================================
// 🔑 قسم التفعيل في الإعدادات
// ============================================================
function renderActivationSection() {
  const statusText = $('#activationStatusText');
  if (!statusText) return;

  const statusBox = $('#activationStatusBox');
  const deviceIdBox = $('#deviceIdBox');
  const deviceIdValue = $('#deviceIdValue');
  const openBtn = $('#openActivationBtn');
  const activatedBtn = $('#showActivatedBtn');

  const isActivated = state.activation && state.activation.active === true;

  if (isActivated) {
    statusBox.style.background = 'rgba(34,197,94,.15)';
    statusText.textContent = '✅ مُفعّل مدى الحياة';
    statusText.style.color = 'var(--success)';

    if (deviceIdBox) deviceIdBox.style.display = 'block';
    if (deviceIdValue) deviceIdValue.textContent = getDeviceId();

    if (openBtn) openBtn.style.display = 'none';
    if (activatedBtn) {
      activatedBtn.style.display = 'block';
      activatedBtn.onclick = () => {
        const activatedAt = state.activation.activatedAt
          ? formatDate(state.activation.activatedAt) : '—';
        alert(
          `✅ التطبيق مُفعّل بنجاح\n\n` +
          `📅 تاريخ التفعيل: ${activatedAt}\n` +
          `💻 معرّف الجهاز: ${getDeviceId()}\n` +
          `📦 الإصدار: 1.0.0`
        );
      };
    }

    const about = $('#aboutLicense');
    if (about) {
      about.textContent = '✅ مُفعّل مدى الحياة';
      about.style.color = 'var(--success)';
    }
  } else if (state.trial && state.trial.startDate) {
    const start = new Date(state.trial.startDate).getTime();
    const elapsed = Date.now() - start;
    const daysUsed = Math.floor(elapsed / MS_PER_DAY);
    const daysLeft = Math.max(0, TRIAL_DAYS - daysUsed);

    if (daysLeft <= 3) {
      statusBox.style.background = 'rgba(239,68,68,.15)';
      statusText.style.color = 'var(--danger)';
    } else if (daysLeft <= 6) {
      statusBox.style.background = 'rgba(245,158,11,.15)';
      statusText.style.color = 'var(--warning)';
    } else {
      statusBox.style.background = 'rgba(34,197,94,.15)';
      statusText.style.color = 'var(--success)';
    }

    statusText.textContent = `⏳ تجربة — باقي ${daysLeft} ${daysLeft === 1 ? 'يوم' : 'أيام'}`;

    if (deviceIdBox) deviceIdBox.style.display = 'block';
    if (deviceIdValue) deviceIdValue.textContent = getDeviceId();

    if (openBtn) {
      openBtn.style.display = 'block';
      openBtn.textContent = '🔑 تفعيل الآن';
    }
    if (activatedBtn) activatedBtn.style.display = 'none';

    const about = $('#aboutLicense');
    if (about) {
      about.textContent = `⏳ تجربة (باقي ${daysLeft} يوم)`;
      about.style.color = daysLeft <= 3 ? 'var(--danger)' : 'var(--warning)';
    }
  }
}
window.renderActivationSection = renderActivationSection;

function openActivationFromSettings() {
  const screen = $('#activationScreen');
  if (!screen) return;

  screen.classList.remove('hidden');
  $('#activationCodeDisplay').textContent = getDeviceId();
  $('#activationInput').value = '';
  $('#activationError').textContent = '';

  $('#activationBtn').onclick = () => {
    const code = $('#activationInput').value;
    const result = tryActivate(code);

    if (result.success) {
      toast('✅ تم تفعيل التطبيق بنجاح');
      setTimeout(() => {
        screen.classList.add('hidden');
        renderActivationSection();
        updateDrawerTrial();
      }, 1000);
    } else {
      $('#activationError').textContent = result.message;
    }
  };

  $('#activationInput').onkeypress = (e) => {
    if (e.key === 'Enter') $('#activationBtn').click();
  };

  setTimeout(() => $('#activationInput').focus(), 200);
}
window.openActivationFromSettings = openActivationFromSettings;

// ============================================================
// 📦 إضافة / تعديل منتج
// ============================================================
function addProduct() {
  if (!currentUser || currentUser.role === 'cashier') {
    return toast('❌ غير مصرح', 'error');
  }

  const isEditing = $('#addProduct').dataset.editing === 'true';

  const name = $('#prodName').value.trim();
  const sell = +$('#prodSell').value;
  const barcode = $('#prodBarcode').value.trim() || String(Date.now());
  const ref = $('#prodRef').value.trim();
  const buy = +$('#prodBuy').value || 0;
  const semiGros = +$('#prodSemiGros').value || 0;
  const qty = +$('#prodQty').value || 0;
  const minQty = +$('#prodMinQty').value || 5;
  const expiry = $('#prodExpiry').value || null;

  if (!name) return toast('أدخل اسم المنتج', 'error');
  if (!sell || sell <= 0) return toast('أدخل سعر البيع', 'error');
  if (qty < 0) return toast('أدخل الكمية', 'error');

  // تعديل منتج موجود
  if (isEditing && editingProductId) {
    const p = state.products.find(x => x.id === editingProductId);
    if (!p) return toast('❌ المنتج غير موجود', 'error');

    if (state.products.some(x => x.barcode === barcode && x.id !== editingProductId)) {
      return toast('⚠️ الباركود مستعمل في منتج آخر', 'error');
    }

    p.name = name;
    p.barcode = barcode;
    p.ref = ref;
    p.buy = buy;
    p.sell = sell;
    p.semiGros = semiGros;
    p.qty = qty;
    p.minQty = minQty;
    p.expiry = expiry;

    logActivity('inventory', `تعديل منتج: ${name}`, 0);
    toast('✏️ تم حفظ التعديلات');

    resetProductForm();
    saveAll();
    renderAll();
    return;
  }

  // إضافة منتج جديد
  if (!qty || qty <= 0) return toast('أدخل الكمية', 'error');

  if (state.products.some(p => p.barcode === barcode)) {
    return toast('⚠️ الباركود مستعمل', 'error');
  }

  if (inventoryMode === 'supplier') {
    const supplierId = +$('#prodSupplier').value;
    const purPrice = +$('#prodPurPrice').value;
    const payType = $('#page-inventory').querySelector('input[name="purPayType"]:checked').value;

    if (!supplierId) return toast('❌ اختر مورداً', 'error');
    if (!purPrice || purPrice <= 0) return toast('أدخل سعر الشراء', 'error');

    const supplier = state.suppliers.find(s => s.id === supplierId);
    if (!supplier) return toast('❌ المورد غير موجود', 'error');

    const totalCost = qty * purPrice;

    state.products.push({
      id: uid(), name, buy: purPrice, sell, semiGros,
      qty, minQty, ref, barcode, expiry,
      supplierId, supplierName: supplier.name,
      createdAt: nowISO()
    });

    if (payType === 'cash') {
      state.treasury -= totalCost;
      addTreasuryMove('purchase-cash', -totalCost, `شراء ${name} (${qty} وحدة)`, supplier.id);
      logActivity('purchase', `شراء نقدي من ${supplier.name}: ${name}`, -totalCost);
    } else {
      supplier.debt = (supplier.debt || 0) + totalCost;
      addTreasuryMove('purchase-credit', 0, `شراء كريدي من ${supplier.name}: ${name}`, supplier.id);
      logActivity('purchase', `شراء كريدي من ${supplier.name}: ${name}`, totalCost);
    }

    toast('✅ تم الشراء وإضافة المنتج');
  } else {
    state.products.push({
      id: uid(), name, buy, sell, semiGros,
      qty, minQty, ref, barcode, expiry,
      createdAt: nowISO()
    });
    logActivity('inventory', `إضافة منتج: ${name}`, 0);
    toast('✅ تم إضافة المنتج');
  }

  saveAll();
  renderAll();
  resetProductForm();
}

function resetProductForm() {
  editingProductId = null;

  ['prodName','prodBuy','prodSell','prodSemiGros','prodQty',
   'prodBarcode','prodRef','prodExpiry','prodPurPrice']
    .forEach(id => { const el = $('#'+id); if (el) el.value = ''; });

  $('#prodMinQty').value = '5';

  $('#addProduct').textContent = '💾 حفظ المنتج';
  $('#addProduct').dataset.editing = 'false';

  $('#invAddPanel').style.display = 'none';
  $('#toggleAddProduct').textContent = '➕ إضافة منتج';

  const tabs = $('#modeTabs');
  if (tabs) tabs.style.display = 'flex';
}

function editProduct(id) {
  if (!currentUser || currentUser.role === 'cashier') {
    return toast('❌ غير مصرح', 'error');
  }

  const p = state.products.find(x => x.id === id);
  if (!p) return;

  editingProductId = id;

  $('#prodBarcode').value = p.barcode || '';
  $('#prodName').value = p.name || '';
  $('#prodRef').value = p.ref || '';
  $('#prodBuy').value = p.buy || 0;
  $('#prodSell').value = p.sell || 0;
  $('#prodSemiGros').value = p.semiGros || 0;
  $('#prodQty').value = p.qty || 0;
  $('#prodMinQty').value = p.minQty || 5;
  $('#prodExpiry').value = p.expiry || '';

  $('#addProduct').textContent = '💾 حفظ التعديلات';
  $('#addProduct').dataset.editing = 'true';

  $('#invAddPanel').style.display = 'block';
  $('#toggleAddProduct').textContent = '✖️ إغلاق النموذج';

  const tabs = $('#modeTabs');
  if (tabs) tabs.style.display = 'none';

  window.scrollTo({ top: 150, behavior: 'smooth' });
  toast('✏️ عدّل البيانات ثم اضغط حفظ');
}
window.editProduct = editProduct;

function deleteProduct(id) {
  if (!currentUser || currentUser.role !== 'admin') {
    return toast('❌ فقط المدير يمكنه الحذف', 'error');
  }
  if (!confirm('حذف هذا المنتج؟')) return;
  state.products = state.products.filter(p => p.id !== id);
  saveAll();
  renderAll();
  toast('🗑️ تم الحذف');
}
window.deleteProduct = deleteProduct;

function exportProducts() {
  const rows = [['كود','الاسم','Référence','شراء','بيع','جملة','كمية','حد أدنى','المورد','الصلاحية']];
  state.products.forEach(p => rows.push([
    p.barcode, p.name, p.ref || '', p.buy, p.sell, p.semiGros || '',
    p.qty, p.minQty || 5, p.supplierName || '', p.expiry || ''
  ]));

  const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
  downloadFile('\uFEFF' + csv, 'products_' + Date.now() + '.csv', 'text/csv');
  toast('📤 تم تصدير المنتجات');
}

// ============================================================
// 🛒 POS
// ============================================================
let cart = [];

function onPosSearch(e) {
  const q = e.target.value.trim().toLowerCase();
  const box = $('#posSuggestions');

  if (!q) { box.innerHTML = ''; return; }

  const results = state.products.filter(p =>
    p.name.toLowerCase().includes(q) || (p.barcode || '').includes(q)
  ).slice(0, 6);

  box.innerHTML = results.length
    ? results.map(p => `
        <div class="suggestion" onclick="quickAddToCart(${p.id})">
          <div>
            <b>${p.name}</b>
            <small style="display:block;color:var(--muted);font-size:11px;">${p.barcode}</small>
          </div>
          <div style="text-align:left;">
            <b style="color:var(--success)">${fmtNum(p.sell)}</b>
            <small style="display:block;color:var(--muted);font-size:11px;">متوفر: ${p.qty}</small>
          </div>
        </div>
      `).join('')
    : '<p style="text-align:center;color:var(--muted);padding:12px;font-size:12px;">لا نتائج</p>';
}

function quickAddToCart(pid) {
  const prod = state.products.find(p => p.id === pid);
  if (!prod) return;
  if (prod.qty < 1) return toast('⚠️ الكمية غير متوفرة', 'error');

  const existing = cart.find(c => c.pid === pid);
  if (existing) {
    if (existing.qty + 1 > prod.qty) return toast('⚠️ تجاوزت الكمية المتوفرة', 'error');
    existing.qty += 1;
  } else {
    cart.push({ pid, name: prod.name, price: prod.sell, qty: 1 });
  }

  $('#posQuickSearch').value = '';
  $('#posSuggestions').innerHTML = '';
  renderCart();
  toast('🛒 ' + prod.name);
}
window.quickAddToCart = quickAddToCart;

function addToCartManual() {
  const pid = +$('#posProduct').value;
  const qty = +$('#posQty').value;
  const prod = state.products.find(p => p.id === pid);

  if (!prod) return toast('اختر منتجاً', 'error');
  if (qty <= 0) return toast('كمية غير صحيحة', 'error');

  const existing = cart.find(c => c.pid === pid);
  const newQty = (existing ? existing.qty : 0) + qty;

  if (newQty > prod.qty) return toast(`⚠️ المتوفر فقط ${prod.qty}`, 'error');

  if (existing) existing.qty = newQty;
  else cart.push({ pid, name: prod.name, price: prod.sell, qty });

  $('#posQty').value = '1';
  renderCart();
  toast('🛒 أُضيف');
}

function renderCart() {
  const box = $('#cartList');
  if (!box) return;

  box.innerHTML = cart.length
    ? cart.map((c, i) => `
        <div class="pos-cart-item">
          <div class="info">
            <h4>${c.name}</h4>
            <small>${fmtNum(c.price)} ${state.settings.currency} × ${c.qty}</small>
          </div>
          <div class="qty-ctrl">
            <button onclick="changeQty(${i}, -1)">−</button>
            <b>${c.qty}</b>
            <button onclick="changeQty(${i}, 1)">+</button>
            <button onclick="removeFromCart(${i})" style="background:var(--danger);color:#fff;border:none;">✕</button>
          </div>
        </div>
      `).join('')
    : '<p style="color:var(--muted);text-align:center;padding:24px;font-size:13px;">السلة فارغة</p>';

  const total = cart.reduce((s, c) => s + c.price * c.qty, 0);
  $('#posGrandTotal').textContent = fmtNum(total);
  $('#posArticlesCount').textContent = cart.reduce((s, c) => s + c.qty, 0);
}

function changeQty(i, delta) {
  const c = cart[i];
  const p = state.products.find(x => x.id === c.pid);
  const newQ = c.qty + delta;

  if (newQ < 1) return;
  if (p && newQ > p.qty) return toast('⚠️ المتوفر: ' + p.qty, 'error');

  c.qty = newQ;
  renderCart();
}
window.changeQty = changeQty;

function removeFromCart(i) {
  cart.splice(i, 1);
  renderCart();
}
window.removeFromCart = removeFromCart;

function clearCart(silent = false) {
  if (!cart.length) return;
  if (!silent && !confirm('تفريغ السلة؟')) return;
  cart = [];
  renderCart();
  if (!silent) toast('🗑️ تم التفريغ');
}

function openPosHistory() {
  const recent = state.sales.slice()
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 20);

  $('#posHistoryList').innerHTML = recent.length
    ? recent.map(s => `
        <div class="item">
          <div class="item-info">
            <h4>INV-${String(s.id).slice(-6)}</h4>
            <small>${s.payType === 'credit' ? '💳 ' + (s.customerName || '') : '💵 نقدي'} • ${formatDate(s.date)}</small>
          </div>
          <b style="color:var(--success)">${fmt(s.total)}</b>
        </div>
      `).join('')
    : emptyState('لا توجد فواتير');

  $('#posHistoryModal').classList.add('show');
}

function checkout() {
  if (!cart.length) return toast('السلة فارغة', 'error');

  const payType = $('#page-pos').querySelector('input[name="payType"]:checked').value;
  const total = cart.reduce((s, c) => s + c.price * c.qty, 0);

  let customerId = null, customerName = null;
  if (payType === 'credit') {
    customerId = +$('#posCustomer').value;
    const cust = state.customers.find(c => c.id === customerId);
    if (!cust) return toast('❌ اختر زبوناً', 'error');
    customerName = cust.name;
  }

  cart.forEach(c => {
    const p = state.products.find(x => x.id === c.pid);
    if (p) p.qty = Math.max(0, p.qty - c.qty);
  });

  const sale = {
    id: uid(),
    items: cart.map(c => ({ ...c })),
    total, payType, customerId, customerName,
    date: nowISO(),
    user: currentUser ? currentUser.name : '—'
  };

  state.sales.push(sale);

  if (payType === 'cash') {
    state.treasury += total;
    addTreasuryMove('sale-cash', total, `بيع نقدي INV-${String(sale.id).slice(-6)}`, sale.id);
    logActivity('sale', `بيع نقدي (${cart.length} منتج)`, total);
  } else {
    const cust = state.customers.find(c => c.id === customerId);
    if (cust) cust.debt = (cust.debt || 0) + total;
    addTreasuryMove('sale-credit', 0, `بيع كريدي لـ ${customerName}`, sale.id);
    logActivity('sale', `بيع كريدي إلى ${customerName}`, total);
  }

  saveAll();
  renderAll();

  toast(payType === 'cash' ? '💰 تم البيع النقدي' : '💳 تم البيع بالكريدي');
  generateReceipt(sale);

  cart = [];
  renderCart();
  $('#page-pos').querySelector('input[value="cash"]').checked = true;
  $('#creditCustomerBox').style.display = 'none';
}

// ============================================================
// 👥 الزبائن
// ============================================================
function toggleCustomerForm() {
  const panel = $('#custAddPanel');
  const shown = panel.style.display !== 'none';

  if (shown) resetCustomerForm();
  else { editingCustomerId = null; resetCustomerForm(); }

  panel.style.display = shown ? 'none' : 'block';
  $('#toggleAddCustomer').textContent = shown ? '➕ إضافة زبون' : '✖️ إغلاق النموذج';
}

function resetCustomerForm() {
  editingCustomerId = null;
  ['custName','custPhone','custNotes'].forEach(id => {
    const el = $('#'+id); if (el) el.value = '';
  });
  $('#custDebt').value = '0';
  $('#custCreditLimit').value = '0';
  $('#custFormTitle').textContent = '📋 بيانات الزبون';
  $('#saveCustomerBtn').textContent = '💾 حفظ';
  $('#cancelCustomerBtn').style.display = 'none';
}

function cancelCustomerForm() {
  resetCustomerForm();
  $('#custAddPanel').style.display = 'none';
  $('#toggleAddCustomer').textContent = '➕ إضافة زبون';
}

function saveCustomer() {
  if (!currentUser || currentUser.role === 'cashier') {
    return toast('❌ غير مصرح', 'error');
  }

  const name = $('#custName').value.trim();
  if (!name) return toast('أدخل الاسم', 'error');

  const data = {
    name,
    phone: $('#custPhone').value.trim(),
    debt: +$('#custDebt').value || 0,
    creditLimit: +$('#custCreditLimit').value || 0,
    notes: $('#custNotes').value.trim()
  };

  if (editingCustomerId) {
    const cust = state.customers.find(c => c.id === editingCustomerId);
    if (cust) {
      Object.assign(cust, data);
      logActivity('customer', `تعديل زبون: ${name}`, 0);
      toast('✏️ تم التعديل');
    }
  } else {
    state.customers.push({
      id: uid(),
      code: generateCustomerCode(),
      ...data,
      createdAt: nowISO()
    });
    logActivity('customer', `إضافة زبون: ${name}`, 0);
    toast('👥 تم الإضافة');
  }

  saveAll();
  renderAll();
  cancelCustomerForm();
}

function editCustomer(id) {
  const c = state.customers.find(x => x.id === id);
  if (!c) return;

  editingCustomerId = id;
  $('#custName').value = c.name || '';
  $('#custPhone').value = c.phone || '';
  $('#custDebt').value = c.debt || 0;
  $('#custCreditLimit').value = c.creditLimit || 0;
  $('#custNotes').value = c.notes || '';
  $('#custFormTitle').textContent = '✏️ تعديل: ' + c.name;
  $('#saveCustomerBtn').textContent = '💾 حفظ التعديلات';
  $('#cancelCustomerBtn').style.display = 'block';
  $('#custAddPanel').style.display = 'block';
  $('#toggleAddCustomer').textContent = '✖️ إغلاق النموذج';

  window.scrollTo({ top: 200, behavior: 'smooth' });
}
window.editCustomer = editCustomer;

function deleteCustomer(id) {
  if (!currentUser || currentUser.role !== 'admin') {
    return toast('❌ فقط المدير', 'error');
  }

  const c = state.customers.find(x => x.id === id);
  if (!c) return;

  if (c.debt > 0) return toast('⚠️ لا يمكن حذف زبون عليه دين', 'error');
  if (!confirm(`حذف "${c.name}"؟`)) return;

  state.customers = state.customers.filter(x => x.id !== id);
  saveAll();
  renderAll();
  toast('🗑️ تم');
}
window.deleteCustomer = deleteCustomer;

function exportCustomers() {
  const rows = [['الرمز','الاسم','الهاتف','الدين','حد الائتمان','ملاحظات']];
  state.customers.forEach(c => rows.push([
    c.code || '', c.name, c.phone || '',
    c.debt || 0, c.creditLimit || 0, c.notes || ''
  ]));

  const csv = rows.map(r => r.map(x => `"${x}"`).join(',')).join('\n');
  downloadFile('\uFEFF' + csv, 'customers_' + Date.now() + '.csv', 'text/csv');
  toast('📤 تم التصدير');
}

// ============================================================
// 🏭 الموردين
// ============================================================
function toggleSupplierForm() {
  const panel = $('#supAddPanel');
  const shown = panel.style.display !== 'none';

  if (shown) resetSupplierForm();
  else { editingSupplierId = null; resetSupplierForm(); }

  panel.style.display = shown ? 'none' : 'block';
  $('#toggleAddSupplier').textContent = shown ? '➕ إضافة مورد' : '✖️ إغلاق النموذج';
}

function resetSupplierForm() {
  editingSupplierId = null;
  ['supName','supPhone','supAddress','supNotes'].forEach(id => {
    const el = $('#'+id); if (el) el.value = '';
  });
  $('#supDebt').value = '0';
  $('#supFormTitle').textContent = '📋 بيانات المورد';
  $('#saveSupplierBtn').textContent = '💾 حفظ';
  $('#cancelSupplierBtn').style.display = 'none';
}

function cancelSupplierForm() {
  resetSupplierForm();
  $('#supAddPanel').style.display = 'none';
  $('#toggleAddSupplier').textContent = '➕ إضافة مورد';
}

function saveSupplier() {
  if (!currentUser || currentUser.role === 'cashier') {
    return toast('❌ غير مصرح', 'error');
  }

  const name = $('#supName').value.trim();
  if (!name) return toast('أدخل الاسم', 'error');

  const data = {
    name,
    phone: $('#supPhone').value.trim(),
    address: $('#supAddress').value.trim(),
    debt: +$('#supDebt').value || 0,
    notes: $('#supNotes').value.trim()
  };

  if (editingSupplierId) {
    const sup = state.suppliers.find(s => s.id === editingSupplierId);
    if (sup) {
      Object.assign(sup, data);
      logActivity('supplier', `تعديل مورد: ${name}`, 0);
      toast('✏️ تم التعديل');
    }
  } else {
    state.suppliers.push({
      id: uid(),
      code: generateSupplierCode(),
      ...data,
      createdAt: nowISO()
    });
    logActivity('supplier', `إضافة مورد: ${name}`, 0);
    toast('🏭 تم الإضافة');
  }

  saveAll();
  renderAll();
  cancelSupplierForm();
}

function editSupplier(id) {
  const s = state.suppliers.find(x => x.id === id);
  if (!s) return;

  editingSupplierId = id;
  $('#supName').value = s.name || '';
  $('#supPhone').value = s.phone || '';
  $('#supAddress').value = s.address || '';
  $('#supDebt').value = s.debt || 0;
  $('#supNotes').value = s.notes || '';
  $('#supFormTitle').textContent = '✏️ تعديل: ' + s.name;
  $('#saveSupplierBtn').textContent = '💾 حفظ التعديلات';
  $('#cancelSupplierBtn').style.display = 'block';
  $('#supAddPanel').style.display = 'block';
  $('#toggleAddSupplier').textContent = '✖️ إغلاق النموذج';

  window.scrollTo({ top: 200, behavior: 'smooth' });
}
window.editSupplier = editSupplier;

function deleteSupplier(id) {
  if (!currentUser || currentUser.role !== 'admin') {
    return toast('❌ فقط المدير', 'error');
  }

  const s = state.suppliers.find(x => x.id === id);
  if (!s) return;

  if (s.debt > 0) return toast('⚠️ لا يمكن حذف مورد علينا له دين', 'error');
  if (!confirm(`حذف "${s.name}"؟`)) return;

  state.suppliers = state.suppliers.filter(x => x.id !== id);
  saveAll();
  renderAll();
  toast('🗑️ تم');
}
window.deleteSupplier = deleteSupplier;

function exportSuppliers() {
  const rows = [['الرمز','الاسم','الهاتف','العنوان','الدين','ملاحظات']];
  state.suppliers.forEach(s => rows.push([
    s.code || '', s.name, s.phone || '', s.address || '',
    s.debt || 0, s.notes || ''
  ]));

  const csv = rows.map(r => r.map(x => `"${x}"`).join(',')).join('\n');
  downloadFile('\uFEFF' + csv, 'suppliers_' + Date.now() + '.csv', 'text/csv');
  toast('📤 تم التصدير');
}

// ============================================================
// 💵 تسديد الديون
// ============================================================
let payDebtTarget = null;

function openPayDebt(id) {
  const cust = state.customers.find(c => c.id === id);
  if (!cust) return;
  if (cust.debt <= 0) return toast('✅ لا يوجد دين', 'error');

  payDebtTarget = { type: 'customer', id };
  $('#payDebtTitle').textContent = '💳 تسديد دين الزبون';
  $('#payDebtInfo').textContent = `${cust.name} — الدين الحالي: ${fmt(cust.debt)}`;
  $('#payDebtAmount').value = '';
  $('#payDebtModal').classList.add('show');
}
window.openPayDebt = openPayDebt;

function openPaySupplierDebt(id) {
  const sup = state.suppliers.find(s => s.id === id);
  if (!sup) return;
  if (sup.debt <= 0) return toast('✅ لا يوجد دين', 'error');

  payDebtTarget = { type: 'supplier', id };
  $('#payDebtTitle').textContent = '💵 تسديد دين المورد';
  $('#payDebtInfo').textContent = `${sup.name} — علينا له: ${fmt(sup.debt)}`;
  $('#payDebtAmount').value = '';
  $('#payDebtModal').classList.add('show');
}
window.openPaySupplierDebt = openPaySupplierDebt;

function confirmPayDebt() {
  const amount = +$('#payDebtAmount').value;
  if (!amount || amount <= 0) return toast('أدخل مبلغاً صحيحاً', 'error');
  if (!payDebtTarget) return;

  if (payDebtTarget.type === 'customer') {
    const cust = state.customers.find(c => c.id === payDebtTarget.id);
    if (!cust) return;
    if (amount > cust.debt) return toast('⚠️ المبلغ أكبر من الدين', 'error');

    cust.debt -= amount;
    state.treasury += amount;
    state.payments.push({
      id: uid(), type: 'customer',
      customerId: cust.id, customerName: cust.name,
      amount, date: nowISO()
    });

    addTreasuryMove('payment-in', amount, `تسديد من ${cust.name}`, cust.id);
    logActivity('payment', `تسديد دين من ${cust.name}`, amount);
    toast('✅ تم تسديد الزبون');
  } else {
    const sup = state.suppliers.find(s => s.id === payDebtTarget.id);
    if (!sup) return;
    if (amount > sup.debt) return toast('⚠️ المبلغ أكبر من الدين', 'error');

    sup.debt -= amount;
    state.treasury -= amount;
    state.payments.push({
      id: uid(), type: 'supplier',
      supplierId: sup.id, supplierName: sup.name,
      amount, date: nowISO()
    });

    addTreasuryMove('sup-payment', -amount, `تسديد للمورد ${sup.name}`, sup.id);
    logActivity('payment', `تسديد للمورد ${sup.name}`, -amount);
    toast('✅ تم تسديد المورد');
  }

  saveAll();
  renderAll();
  $('#payDebtModal').classList.remove('show');
}

// ============================================================
// 📋 سجل الزبون/المورد
// ============================================================
function openCustomerHistory(id) {
  const c = state.customers.find(x => x.id === id);
  if (!c) return;

  const sales = state.sales.filter(s => s.customerId === id)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const payments = state.payments.filter(p => p.customerId === id)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  $('#historyTitle').textContent = '📋 سجل: ' + c.name;

  const salesHTML = sales.length
    ? sales.map(s => `
        <div class="item">
          <div class="item-info">
            <h4>INV-${String(s.id).slice(-6)}</h4>
            <small>${formatDate(s.date)} • ${s.items.length} منتج</small>
          </div>
          <b style="color:var(--danger)">+${fmt(s.total)}</b>
        </div>`).join('')
    : '<p style="text-align:center;color:var(--muted);padding:12px;font-size:12px;">لا مبيعات</p>';

  const paymentsHTML = payments.length
    ? payments.map(p => `
        <div class="item">
          <div class="item-info"><h4>💵 تسديد</h4><small>${formatDate(p.date)}</small></div>
          <b style="color:var(--success)">-${fmt(p.amount)}</b>
        </div>`).join('')
    : '<p style="text-align:center;color:var(--muted);padding:12px;font-size:12px;">لا تسديدات</p>';

  $('#historyList').innerHTML = `
    <h4 style="margin-bottom:8px;color:var(--danger);font-size:13px;">🔴 المبيعات (${sales.length})</h4>
    ${salesHTML}
    <h4 style="margin:16px 0 8px;color:var(--success);font-size:13px;">🟢 التسديدات (${payments.length})</h4>
    ${paymentsHTML}
    <div style="margin-top:16px;padding:12px;background:var(--card2);border-radius:12px;text-align:center;">
      <small style="color:var(--muted);">الدين الحالي</small>
      <h2 style="color:${c.debt > 0 ? 'var(--danger)' : 'var(--success)'};margin-top:4px;">${fmt(c.debt)}</h2>
    </div>`;

  $('#historyModal').classList.add('show');
}
window.openCustomerHistory = openCustomerHistory;

function openSupplierHistory(id) {
  const s = state.suppliers.find(x => x.id === id);
  if (!s) return;

  const purchases = (state.treasuryLog || []).filter(t =>
    t.relatedId === id && (t.type === 'purchase-cash' || t.type === 'purchase-credit')
  ).sort((a, b) => new Date(b.date) - new Date(a.date));

  const payments = state.payments.filter(p => p.supplierId === id)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  $('#historyTitle').textContent = '📋 سجل: ' + s.name;

  const purchasesHTML = purchases.length
    ? purchases.map(p => `
        <div class="item">
          <div class="item-info">
            <h4>${p.description}</h4>
            <small>${formatDate(p.date)}</small>
          </div>
          <b style="color:var(--warning)">${p.amount !== 0 ? fmt(Math.abs(p.amount)) : 'كريدي'}</b>
        </div>`).join('')
    : '<p style="text-align:center;color:var(--muted);padding:12px;font-size:12px;">لا مشتريات</p>';

  const paymentsHTML = payments.length
    ? payments.map(p => `
        <div class="item">
          <div class="item-info"><h4>💵 تسديد</h4><small>${formatDate(p.date)}</small></div>
          <b style="color:var(--success)">${fmt(p.amount)}</b>
        </div>`).join('')
    : '<p style="text-align:center;color:var(--muted);padding:12px;font-size:12px;">لا تسديدات</p>';

  $('#historyList').innerHTML = `
    <h4 style="margin-bottom:8px;color:var(--warning);font-size:13px;">📦 المشتريات (${purchases.length})</h4>
    ${purchasesHTML}
    <h4 style="margin:16px 0 8px;color:var(--success);font-size:13px;">💵 التسديدات (${payments.length})</h4>
    ${paymentsHTML}
    <div style="margin-top:16px;padding:12px;background:var(--card2);border-radius:12px;text-align:center;">
      <small style="color:var(--muted);">ما علينا له</small>
      <h2 style="color:${s.debt > 0 ? 'var(--warning)' : 'var(--success)'};margin-top:4px;">${fmt(s.debt)}</h2>
    </div>`;

  $('#historyModal').classList.add('show');
}
window.openSupplierHistory = openSupplierHistory;

// ============================================================
// 📄 كشف الحساب
// ============================================================
function openCustomerStatement(id) {
  const c = state.customers.find(x => x.id === id);
  if (!c) return;

  const sales = state.sales.filter(s => s.customerId === id)
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  const payments = state.payments.filter(p => p.customerId === id)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const movements = [];
  sales.forEach(s => movements.push({
    date: s.date, label: `فاتورة INV-${String(s.id).slice(-6)}`,
    debit: s.total, credit: 0
  }));
  payments.forEach(p => movements.push({
    date: p.date, label: 'تسديد', debit: 0, credit: p.amount
  }));

  movements.sort((a, b) => new Date(a.date) - new Date(b.date));

  let running = 0;
  const rows = movements.map(m => {
    running += m.debit - m.credit;
    return `<tr>
      <td>${formatDateShort(m.date)}</td>
      <td>${m.label}</td>
      <td style="text-align:left">${m.debit > 0 ? fmtNum(m.debit) : '—'}</td>
      <td style="text-align:left">${m.credit > 0 ? fmtNum(m.credit) : '—'}</td>
      <td style="text-align:left;font-weight:700">${fmtNum(running)}</td>
    </tr>`;
  }).join('');

  $('#statementTitle').textContent = '📄 كشف حساب: ' + c.name;
  $('#statementContent').innerHTML = `
    <div class="statement-box">
      <h2>◆ ${state.settings.companyName}</h2>
      <div class="sub">كشف حساب الزبون</div>
      <div class="statement-info"><span>الزبون:</span><b>${c.name}</b></div>
      <div class="statement-info"><span>الرمز:</span><b>${c.code || '—'}</b></div>
      <div class="statement-info"><span>الهاتف:</span><b>${c.phone || '—'}</b></div>
      <div class="statement-info"><span>التاريخ:</span><b>${formatDate(nowISO())}</b></div>
      <table class="statement-table">
        <thead>
          <tr>
            <th>التاريخ</th><th>البيان</th>
            <th style="text-align:left">مدين</th>
            <th style="text-align:left">دائن</th>
            <th style="text-align:left">الرصيد</th>
          </tr>
        </thead>
        <tbody>${rows || '<tr><td colspan="5" style="text-align:center;color:#888;">لا حركات</td></tr>'}</tbody>
      </table>
      <div class="statement-total">
        <span>الرصيد الحالي:</span>
        <span>${fmt(c.debt)}</span>
      </div>
      <div class="statement-footer">SIC Enterprise © ${new Date().getFullYear()}</div>
    </div>`;

  $('#statementModal').classList.add('show');
}
window.openCustomerStatement = openCustomerStatement;

function openSupplierStatement(id) {
  const s = state.suppliers.find(x => x.id === id);
  if (!s) return;

  const purchases = (state.treasuryLog || []).filter(t =>
    t.relatedId === id && (t.type === 'purchase-cash' || t.type === 'purchase-credit')
  ).sort((a, b) => new Date(a.date) - new Date(b.date));

  const payments = state.payments.filter(p => p.supplierId === id)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const movements = [];
  purchases.forEach(p => movements.push({
    date: p.date, label: p.description,
    debit: 0, credit: p.amount !== 0 ? Math.abs(p.amount) : 0,
    isCredit: p.type === 'purchase-credit'
  }));
  payments.forEach(p => movements.push({
    date: p.date, label: 'تسديد', debit: p.amount, credit: 0
  }));

  movements.sort((a, b) => new Date(a.date) - new Date(b.date));

  let running = 0;
  const rows = movements.map(m => {
    running += m.credit - m.debit;
    return `<tr>
      <td>${formatDateShort(m.date)}</td>
      <td>${m.label}</td>
      <td style="text-align:left">${m.debit > 0 ? fmtNum(m.debit) : '—'}</td>
      <td style="text-align:left">${m.credit > 0 ? fmtNum(m.credit) : (m.isCredit ? 'كريدي' : '—')}</td>
      <td style="text-align:left;font-weight:700">${fmtNum(running)}</td>
    </tr>`;
  }).join('');

  $('#statementTitle').textContent = '📄 كشف حساب: ' + s.name;
  $('#statementContent').innerHTML = `
    <div class="statement-box">
      <h2>◆ ${state.settings.companyName}</h2>
      <div class="sub">كشف حساب المورد</div>
      <div class="statement-info"><span>المورد:</span><b>${s.name}</b></div>
      <div class="statement-info"><span>الرمز:</span><b>${s.code || '—'}</b></div>
      <div class="statement-info"><span>الهاتف:</span><b>${s.phone || '—'}</b></div>
      <div class="statement-info"><span>التاريخ:</span><b>${formatDate(nowISO())}</b></div>
      <table class="statement-table">
        <thead>
          <tr>
            <th>التاريخ</th><th>البيان</th>
            <th style="text-align:left">دفعنا</th>
            <th style="text-align:left">علينا</th>
            <th style="text-align:left">الرصيد</th>
          </tr>
        </thead>
        <tbody>${rows || '<tr><td colspan="5" style="text-align:center;color:#888;">لا حركات</td></tr>'}</tbody>
      </table>
      <div class="statement-total">
        <span>ما علينا له:</span>
        <span>${fmt(s.debt)}</span>
      </div>
      <div class="statement-footer">SIC Enterprise © ${new Date().getFullYear()}</div>
    </div>`;

  $('#statementModal').classList.add('show');
}
window.openSupplierStatement = openSupplierStatement;

// ============================================================
// 💰 الخزينة
// ============================================================
function renderTreasuryBalance() {
  const el = $('#treasuryBalance');
  if (!el) return;
  el.textContent = fmt(state.treasury);
  el.classList.toggle('negative', state.treasury < 0);
}

function renderTreasury() {
  renderTreasuryBalance();

  const search = ($('#searchTreasury')?.value || '').toLowerCase();
  const period = $('#treasuryPeriod')?.value || 'all';
  const typeFilter = $('#treasuryType')?.value || 'all';

  let moves = (state.treasuryLog || []).slice();

  if (period !== 'all') {
    const now = Date.now();
    const days = period === 'today' ? 1 : period === 'week' ? 7 : 30;
    const cutoff = now - days * MS_PER_DAY;
    moves = moves.filter(m => new Date(m.date).getTime() >= cutoff);
  }

  if (typeFilter === 'in') moves = moves.filter(m => m.amount > 0);
  if (typeFilter === 'out') moves = moves.filter(m => m.amount < 0);

  if (search) {
    moves = moves.filter(m => (m.description || '').toLowerCase().includes(search));
  }

  const list = $('#treasuryList');
  if (!list) return;

  list.innerHTML = moves.length
    ? moves.slice(0, 100).map(m => `
        <div class="item">
          <div class="item-info">
            <h4>${m.description}</h4>
            <small>${formatDate(m.date)} • ${m.user || '—'}</small>
          </div>
          <b style="color:${m.amount > 0 ? 'var(--success)' : (m.amount < 0 ? 'var(--danger)' : 'var(--muted)')}">
            ${m.amount === 0 ? '—' : (m.amount > 0 ? '+' : '') + fmt(m.amount)}
          </b>
        </div>
      `).join('')
    : emptyState('لا توجد حركات');

  const alertBox = $('#treasuryAlert');
  const low = state.settings.lowBalanceAlert || 0;
  if (state.treasury < 0) {
    alertBox.style.display = 'flex';
    alertBox.className = 'treasury-alert danger';
    alertBox.innerHTML = '🚨 <span>الرصيد سالب! راجع المصاريف</span>';
  } else if (low > 0 && state.treasury < low) {
    alertBox.style.display = 'flex';
    alertBox.className = 'treasury-alert warning';
    alertBox.innerHTML = `⚠️ <span>الرصيد منخفض (أقل من ${fmt(low)})</span>`;
  } else {
    alertBox.style.display = 'none';
  }
}

function exportTreasury() {
  const rows = [['التاريخ','الوصف','المبلغ','النوع','المستخدم']];
  (state.treasuryLog || []).forEach(m => rows.push([
    m.date, m.description, m.amount,
    m.amount > 0 ? 'دخل' : 'خرج', m.user || ''
  ]));

  const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
  downloadFile('\uFEFF' + csv, 'treasury_' + Date.now() + '.csv', 'text/csv');
  toast('📤 تم التصدير');
}

function adjustBalanceManually() {
  if (!currentUser || currentUser.role !== 'admin') {
    return toast('❌ فقط المدير', 'error');
  }

  const current = state.treasury;
  const input = prompt(`الرصيد الحالي: ${fmt(current)}\n\nأدخل الرصيد الجديد:`);
  if (input === null) return;

  const newVal = +input;
  if (isNaN(newVal)) return toast('قيمة غير صحيحة', 'error');

  const diff = newVal - current;
  state.treasury = newVal;

  addTreasuryMove('manual', diff, `تعديل يدوي للرصيد`);
  logActivity('treasury', `تعديل يدوي للرصيد (${fmt(diff)})`, diff);

  saveAll();
  renderAll();
  toast('✅ تم التعديل');
}

// ============================================================
// 📊 الإحصائيات
// ============================================================
let chartMain = null, chartBar = null, chartPie = null, chartProfit = null;

function setQuickDateRange(range) {
  const now = new Date();
  let from = new Date();

  if (range === 'today') from.setHours(0, 0, 0, 0);
  else if (range === 'week') { from.setDate(now.getDate() - 6); from.setHours(0, 0, 0, 0); }
  else if (range === 'month') { from.setDate(1); from.setHours(0, 0, 0, 0); }
  else if (range === 'year') { from.setMonth(0, 1); from.setHours(0, 0, 0, 0); }

  const toISO = (d) => d.toISOString().split('T')[0];
  $('#statsFrom').value = toISO(from);
  $('#statsTo').value = toISO(now);
}

function getStatsRange() {
  const fromStr = $('#statsFrom')?.value;
  const toStr = $('#statsTo')?.value;

  const from = fromStr ? new Date(fromStr + 'T00:00:00') : new Date(0);
  const to = toStr ? new Date(toStr + 'T23:59:59') : new Date();

  return { from, to };
}

function filterByRange(arr, dateKey = 'date') {
  const { from, to } = getStatsRange();
  return arr.filter(x => {
    const d = new Date(x[dateKey]);
    return !isNaN(d.getTime()) && d >= from && d <= to;
  });
}

function renderReports() {
  const { from, to } = getStatsRange();

  const sales = filterByRange(state.sales);
  const purchases = (state.treasuryLog || []).filter(t => {
    const d = new Date(t.date);
    return d >= from && d <= to && (t.type === 'purchase-cash' || t.type === 'purchase-credit');
  });
  const supPayments = filterByRange(
    (state.payments || []).filter(p => p.type === 'supplier'), 'date');
  const custPayments = filterByRange(
    (state.payments || []).filter(p => p.type === 'customer'), 'date');

  const totalSales = sales.reduce((a, b) => a + b.total, 0);
  const totalPurch = purchases.reduce((a, b) => a + Math.abs(b.amount || 0), 0);
  const totalSupPay = supPayments.reduce((a, b) => a + b.amount, 0);
  const totalCustPay = custPayments.reduce((a, b) => a + b.amount, 0);

  const totalPurchCash = purchases
    .filter(p => p.type === 'purchase-cash')
    .reduce((a, b) => a + Math.abs(b.amount || 0), 0);

  const profit = totalSales - totalPurchCash - totalSupPay + totalCustPay;

  $('#repSales').textContent = fmt(totalSales);
  $('#repPur').textContent = fmt(totalPurch);
  $('#repSupPay').textContent = fmt(totalSupPay);
  $('#repProfit').textContent = fmt(profit);

  const invCount = sales.length;
  const avgInv = invCount > 0 ? totalSales / invCount : 0;
  const newDebts = sales.filter(s => s.payType === 'credit').reduce((a, b) => a + b.total, 0);

  $('#repInvoices').textContent = invCount;
  $('#repAvg').textContent = fmt(avgInv);
  $('#repNewDebts').textContent = fmt(newDebts);
  $('#repPaid').textContent = fmt(totalCustPay);

  drawLineChart(sales, purchases);
  drawBarChart(sales);
  drawPieChart(sales);
  drawProfitChart(sales, purchases);
  renderTopProducts(sales);
}

function drawLineChart(sales, purchases) {
  const ctx = document.getElementById('chartMain');
  if (!ctx) return;

  const { from, to } = getStatsRange();
  const days = Math.min(Math.ceil((to - from) / MS_PER_DAY) + 1, 30);

  const labels = [], salesData = [], purchData = [];

  for (let i = 0; i < days; i++) {
    const d = new Date(from);
    d.setDate(from.getDate() + i);
    d.setHours(0, 0, 0, 0);
    const key = d.toDateString();

    labels.push(d.toLocaleDateString('ar-DZ', { month: '2-digit', day: '2-digit' }));

    salesData.push(state.sales
      .filter(s => new Date(s.date).toDateString() === key)
      .reduce((a, b) => a + b.total, 0));

    purchData.push((state.treasuryLog || [])
      .filter(t => {
        const td = new Date(t.date);
        return td.toDateString() === key &&
          (t.type === 'purchase-cash' || t.type === 'purchase-credit');
      })
      .reduce((a, b) => a + Math.abs(b.amount || 0), 0));
  }

  if (chartMain) chartMain.destroy();

  const textColor = getComputedStyle(document.body).getPropertyValue('--text').trim() || '#000';
  const mutedColor = getComputedStyle(document.body).getPropertyValue('--muted').trim() || '#888';

  chartMain = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets: [
      { label: 'مبيعات', data: salesData, borderColor: '#22c55e', backgroundColor: 'rgba(34,197,94,.15)', tension: .4, fill: true, borderWidth: 2 },
      { label: 'مشتريات', data: purchData, borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,.15)', tension: .4, fill: true, borderWidth: 2 }
    ]},
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: textColor, font: { family: 'Cairo' } } } },
      scales: {
        x: { ticks: { color: mutedColor, font: { size: 10 } }, grid: { display: false } },
        y: { ticks: { color: mutedColor }, grid: { color: 'rgba(139,148,158,.15)' }, beginAtZero: true }
      }
    }
  });
}

function drawBarChart(sales) {
  const ctx = document.getElementById('chartBar');
  if (!ctx) return;

  const { from, to } = getStatsRange();
  const days = Math.ceil((to - from) / MS_PER_DAY) + 1;

  const labels = [], data = [];
  let groupBy;
  if (days <= 14) groupBy = 'day';
  else if (days <= 90) groupBy = 'week';
  else groupBy = 'month';

  const salesMap = {};
  sales.forEach(s => {
    const d = new Date(s.date);
    let key;
    if (groupBy === 'day') key = d.toDateString();
    else if (groupBy === 'week') {
      const w = new Date(d);
      w.setDate(d.getDate() - d.getDay());
      key = 'W-' + w.toDateString();
    } else key = d.getFullYear() + '-' + (d.getMonth() + 1);
    salesMap[key] = (salesMap[key] || 0) + s.total;
  });

  Object.keys(salesMap).sort().slice(-12).forEach(k => {
    if (groupBy === 'day') {
      const d = new Date(k);
      labels.push(d.toLocaleDateString('ar-DZ', { month: '2-digit', day: '2-digit' }));
    } else if (groupBy === 'week') labels.push(k.replace('W-', '').split(' ')[0]);
    else labels.push(k);
    data.push(salesMap[k]);
  });

  if (chartBar) chartBar.destroy();

  const textColor = getComputedStyle(document.body).getPropertyValue('--text').trim() || '#000';
  const mutedColor = getComputedStyle(document.body).getPropertyValue('--muted').trim() || '#888';

  chartBar = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels.length ? labels : ['لا بيانات'],
      datasets: [{
        label: 'المبيعات',
        data: data.length ? data : [0],
        backgroundColor: '#3b82f6', borderRadius: 6
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: mutedColor, font: { size: 10 } }, grid: { display: false } },
        y: { ticks: { color: mutedColor }, grid: { color: 'rgba(139,148,158,.15)' }, beginAtZero: true }
      }
    }
  });
}

function drawPieChart(sales) {
  const ctx = document.getElementById('chartPie');
  if (!ctx) return;

  const cash = sales.filter(s => s.payType === 'cash').reduce((a, b) => a + b.total, 0);
  const credit = sales.filter(s => s.payType === 'credit').reduce((a, b) => a + b.total, 0);

  if (chartPie) chartPie.destroy();

  const textColor = getComputedStyle(document.body).getPropertyValue('--text').trim() || '#000';

  chartPie = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: cash === 0 && credit === 0 ? ['لا مبيعات'] : ['💵 نقدي', '💳 كريدي'],
      datasets: [{
        data: cash === 0 && credit === 0 ? [1] : [cash, credit],
        backgroundColor: cash === 0 && credit === 0 ? ['#6b7280'] : ['#22c55e', '#f59e0b']
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { color: textColor, font: { size: 12, family: 'Cairo' } } } }
    }
  });
}

function drawProfitChart(sales, purchases) {
  const ctx = document.getElementById('chartProfit');
  if (!ctx) return;

  const { from, to } = getStatsRange();
  const days = Math.min(Math.ceil((to - from) / MS_PER_DAY) + 1, 30);

  const labels = [], data = [];

  for (let i = 0; i < days; i++) {
    const d = new Date(from);
    d.setDate(from.getDate() + i);
    d.setHours(0, 0, 0, 0);
    const key = d.toDateString();

    labels.push(d.toLocaleDateString('ar-DZ', { month: '2-digit', day: '2-digit' }));

    const daySales = state.sales
      .filter(s => new Date(s.date).toDateString() === key)
      .reduce((a, b) => a + b.total, 0);

    const dayPurch = (state.treasuryLog || [])
      .filter(t => {
        const td = new Date(t.date);
        return td.toDateString() === key && t.type === 'purchase-cash';
      })
      .reduce((a, b) => a + Math.abs(b.amount || 0), 0);

    data.push(daySales - dayPurch);
  }

  if (chartProfit) chartProfit.destroy();

  const textColor = getComputedStyle(document.body).getPropertyValue('--text').trim() || '#000';
  const mutedColor = getComputedStyle(document.body).getPropertyValue('--muted').trim() || '#888';

  chartProfit = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'الربح', data,
        borderColor: '#8b5cf6', backgroundColor: 'rgba(139,92,246,.15)',
        tension: .4, fill: true, borderWidth: 2
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: textColor, font: { family: 'Cairo' } } } },
      scales: {
        x: { ticks: { color: mutedColor, font: { size: 10 } }, grid: { display: false } },
        y: { ticks: { color: mutedColor }, grid: { color: 'rgba(139,148,158,.15)' } }
      }
    }
  });
}

function renderTopProducts(sales) {
  const counts = {};
  sales.forEach(s => s.items.forEach(it => {
    if (!counts[it.name]) counts[it.name] = { qty: 0, total: 0 };
    counts[it.name].qty += it.qty;
    counts[it.name].total += it.price * it.qty;
  }));

  const top = Object.entries(counts).sort((a, b) => b[1].qty - a[1].qty).slice(0, 5);

  const box = $('#topProducts');
  if (!box) return;

  box.innerHTML = top.length
    ? top.map(([name, d], i) => `
        <div class="item">
          <div class="item-info">
            <h4>${['🥇','🥈','🥉','4️⃣','5️⃣'][i]} ${name}</h4>
            <small>${d.qty} قطعة • ${fmt(d.total)}</small>
          </div>
        </div>
      `).join('')
    : emptyState('لا مبيعات');
}

// ============================================================
// 🧾 الفواتير
// ============================================================
function renderInvoiceList() {
  const search = ($('#searchInvoice')?.value || '').toLowerCase();
  const filter = $('#invoiceFilter')?.value || 'all';

  let sales = state.sales.slice().sort((a, b) => new Date(b.date) - new Date(a.date));

  if (filter !== 'all') sales = sales.filter(s => s.payType === filter);

  if (search) {
    sales = sales.filter(s => {
      const invNo = 'INV-' + String(s.id).slice(-6).toLowerCase();
      return invNo.includes(search) || (s.customerName || '').toLowerCase().includes(search);
    });
  }

  const box = $('#invoiceList');
  if (!box) return;

  box.innerHTML = sales.length
    ? sales.slice(0, 100).map(s => {
        const invNo = 'INV-' + String(s.id).slice(-6);
        const pay = s.payType === 'credit' ? `💳 ${s.customerName || 'كريدي'}` : '💵 نقدي';
        return `
          <div class="item">
            <div class="item-info">
              <h4>${invNo}</h4>
              <small>${pay} • ${formatDate(s.date)}</small>
              <small style="display:block;color:var(--text);font-weight:700;margin-top:4px;">${fmt(s.total)}</small>
            </div>
            <div class="item-actions">
              <button class="icon-btn" onclick="reprintInvoice(${s.id})" title="طباعة">🖨️</button>
              <button class="icon-btn danger" onclick="deleteInvoice(${s.id})" title="إلغاء">✕</button>
            </div>
          </div>`;
      }).join('')
    : emptyState('لا توجد فواتير');
}

function reprintInvoice(id) {
  const sale = state.sales.find(s => s.id === id);
  if (!sale) return toast('الفاتورة غير موجودة', 'error');
  generateReceipt(sale);
}
window.reprintInvoice = reprintInvoice;

function deleteInvoice(id) {
  if (!currentUser || currentUser.role !== 'admin') {
    return toast('❌ فقط المدير', 'error');
  }

  const sale = state.sales.find(s => s.id === id);
  if (!sale) return;
  if (!confirm(`إلغاء INV-${String(id).slice(-6)}؟`)) return;

  sale.items.forEach(it => {
    const p = state.products.find(x => x.id === it.pid);
    if (p) p.qty += it.qty;
  });

  if (sale.payType === 'cash') {
    state.treasury -= sale.total;
    addTreasuryMove('manual', -sale.total, `إلغاء INV-${String(id).slice(-6)}`, id);
  } else if (sale.customerId) {
    const cust = state.customers.find(c => c.id === sale.customerId);
    if (cust) cust.debt = Math.max(0, cust.debt - sale.total);
  }

  state.sales = state.sales.filter(s => s.id !== id);
  logActivity('void', `إلغاء INV-${String(id).slice(-6)}`, -sale.total);

  saveAll();
  renderAll();
  toast('🗑️ تم إلغاء الفاتورة');
}
window.deleteInvoice = deleteInvoice;

// ============================================================
// 🖨️ الفاتورة
// ============================================================
function generateReceipt(sale) {
  const invoiceNo = 'INV-' + String(sale.id).slice(-6);
  const date = formatDate(sale.date);
  const s = state.settings;

  const rows = sale.items.map(it => `
    <tr>
      <td>${it.name}</td>
      <td style="text-align:center">${it.qty}</td>
      <td style="text-align:left">${fmtNum(it.price)}</td>
      <td style="text-align:left">${fmtNum(it.price * it.qty)}</td>
    </tr>
  `).join('');

  const payLabel = sale.payType === 'credit'
    ? `💳 كريدي — ${sale.customerName || ''}` : '💵 نقدي';

  $('#receiptContent').innerHTML = `
    <h2>${s.logo || '◆'} ${s.companyName || 'SIC Enterprise'}</h2>
    <div class="receipt-sub">نظام إدارة المحلات</div>
    ${s.phone ? `<div class="receipt-info"><span>الهاتف:</span><b>${s.phone}</b></div>` : ''}
    <div class="receipt-info"><span>رقم الفاتورة:</span><b>${invoiceNo}</b></div>
    <div class="receipt-info"><span>التاريخ:</span><b>${date}</b></div>
    <div class="receipt-info"><span>نوع الدفع:</span><b>${payLabel}</b></div>
    <div class="receipt-info"><span>الكاشير:</span><b>${sale.user || '—'}</b></div>
    <table class="receipt-table">
      <thead>
        <tr>
          <th>المنتج</th>
          <th style="text-align:center">كمية</th>
          <th style="text-align:left">السعر</th>
          <th style="text-align:left">الإجمالي</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="receipt-total">
      <span>الإجمالي:</span>
      <span>${fmtNum(sale.total)} ${s.currency}</span>
    </div>
    <div class="barcode-wrap"><svg id="receiptBarcode"></svg></div>
    <div class="receipt-footer">
      ${s.receiptFooter || 'شكراً لتعاملكم معنا 🌟'}<br>
      ${s.companyName || 'SIC Enterprise'} © ${new Date().getFullYear()}
    </div>
  `;

  $('#receiptModal').classList.add('show');

  setTimeout(() => {
    try {
      JsBarcode("#receiptBarcode", invoiceNo, {
        format: "CODE128", width: 1.5, height: 40,
        displayValue: true, fontSize: 11, margin: 0
      });
    } catch (e) {}
  }, 50);
}

// ============================================================
// 📷 الماسح
// ============================================================
let html5QrCode = null;
let scannerTarget = null;

function startScanner(target) {
  scannerTarget = target;
  $('#scannerModal').classList.add('show');

  if (!html5QrCode) html5QrCode = new Html5Qrcode("qr-reader");

  const config = { fps: 10, qrbox: { width: 260, height: 160 } };

  html5QrCode.start(
    { facingMode: { exact: "environment" } }, config,
    (d) => { onBarcodeScanned(d); stopScanner(); }, () => {}
  ).catch(() => {
    html5QrCode.start(
      { facingMode: "environment" }, config,
      (d) => { onBarcodeScanned(d); stopScanner(); }, () => {}
    ).catch(() => {
      Html5Qrcode.getCameras().then(devices => {
        if (!devices || !devices.length) throw new Error("No cameras");
        html5QrCode.start(
          devices[devices.length - 1].id, config,
          (d) => { onBarcodeScanned(d); stopScanner(); }, () => {}
        );
      }).catch(() => {
        toast('❌ تأكد من HTTPS + إذن الكاميرا', 'error');
        stopScanner();
      });
    });
  });
}

function stopScanner() {
  if (html5QrCode && html5QrCode.isScanning) {
    html5QrCode.stop().then(() => html5QrCode.clear()).catch(() => {});
  }
  $('#scannerModal').classList.remove('show');
}

function onBarcodeScanned(code) {
  if (scannerTarget === 'inventory') {
    $('#prodBarcode').value = code;
    toast('📷 تم المسح');
    const existing = state.products.find(p => p.barcode === code);
    if (existing) {
      $('#prodName').value = existing.name;
      $('#prodBuy').value = existing.buy;
      $('#prodSell').value = existing.sell;
      toast(`ℹ️ ${existing.name}`);
    }
  } else if (scannerTarget === 'pos') {
    const prod = state.products.find(p => p.barcode === code);
    if (!prod) return toast('❌ غير موجود', 'error');
    if (prod.qty < 1) return toast('⚠️ الكمية غير متوفرة', 'error');
    quickAddToCart(prod.id);
  }
}

// ============================================================
// 🔔 تنبيهات المخزون
// ============================================================
function renderLowStockAlerts() {
  const box = $('#lowStockAlerts');
  if (!box) return;

  const limit = state.settings.lowStockAlert || 5;
  const critical = state.products.filter(p => p.qty <= limit / 2);
  const low = state.products.filter(p => p.qty > limit / 2 && p.qty <= limit);

  if (!critical.length && !low.length) { box.innerHTML = ''; return; }

  let html = '';
  if (critical.length) {
    html += `<div class="alert-item danger" onclick="go('inventory')">
      <span class="a-icon">🚨</span><span>منتجات على وشك النفاد</span>
      <span class="a-count">${critical.length}</span></div>`;
  }
  if (low.length) {
    html += `<div class="alert-item warning" onclick="go('inventory')">
      <span class="a-icon">⚠️</span><span>منتجات كمية منخفضة</span>
      <span class="a-count">${low.length}</span></div>`;
  }
  box.innerHTML = html;
}

// ============================================================
// 📜 سجل العمليات
// ============================================================
function renderActivityLog() {
  const filter = $('#logFilter')?.value || 'all';

  let logs = state.log.slice();
  if (filter !== 'all') logs = logs.filter(l => l.type === filter);

  const box = $('#activityLog');
  if (!box) return;

  box.innerHTML = logs.length
    ? logs.slice(0, 60).map(l => `
        <div class="item">
          <div class="item-info">
            <h4>${l.text}</h4>
            <small>${formatDate(l.date)} • ${l.user || '—'}</small>
          </div>
          ${l.amount ? `<b style="color:${l.amount >= 0 ? 'var(--success)' : 'var(--danger)'}">${l.amount >= 0 ? '+' : ''}${fmt(l.amount)}</b>` : ''}
        </div>
      `).join('')
    : emptyState('لا عمليات');
}

function exportActivityLog() {
  const rows = [['التاريخ','العملية','المبلغ','المستخدم']];
  state.log.forEach(l => rows.push([l.date, l.text, l.amount || 0, l.user || '']));
  const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
  downloadFile('\uFEFF' + csv, 'activity_' + Date.now() + '.csv', 'text/csv');
  toast('📤 تم التصدير');
}

// ============================================================
// 💾 النسخ الاحتياطي
// ============================================================
function exportBackup() {
  const data = {
    version: '1.0.0', exportedAt: nowISO(),
    products: state.products, customers: state.customers, suppliers: state.suppliers,
    sales: state.sales, payments: state.payments,
    treasury: state.treasury, treasuryLog: state.treasuryLog,
    log: state.log, users: state.users, settings: state.settings,
    trial: state.trial, activation: state.activation
  };

  const json = JSON.stringify(data, null, 2);
  downloadFile(json, 'sic_backup_' + Date.now() + '.json', 'application/json');

  state.settings.lastAutoBackup = nowISO();
  DB.set('settings', state.settings);
  renderBackupInfo();

  toast('📤 تم التصدير');
}

function importBackup(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const data = JSON.parse(ev.target.result);
      if (!data.products || !data.settings) throw new Error('ملف غير صالح');
      if (!confirm('سيتم استبدال كل البيانات. متابعة؟')) return;

      state.products = data.products || [];
      state.customers = data.customers || [];
      state.suppliers = data.suppliers || [];
      state.sales = data.sales || [];
      state.payments = data.payments || [];
      state.treasury = data.treasury || 0;
      state.treasuryLog = data.treasuryLog || [];
      state.log = data.log || [];
      state.users = data.users || DEFAULT_USERS;
      state.settings = { ...DEFAULT_SETTINGS, ...(data.settings || {}) };
      state.trial = data.trial || state.trial;
      state.activation = data.activation || state.activation;

      saveAll();
      loadSettings();
      applyTheme();
      renderAll();

      toast('✅ تم الاستيراد بنجاح');
    } catch (err) {
      toast('❌ ملف غير صالح', 'error');
      console.error(err);
    }
  };
  reader.readAsText(file);
  e.target.value = '';
}

function toggleAutoBackup() {
  state.settings.autoBackup = !state.settings.autoBackup;
  DB.set('settings', state.settings);
  renderBackupInfo();
  toast(state.settings.autoBackup ? '✅ النسخ التلقائي مفعّل' : '❌ تم الإيقاف');
}

function checkAutoBackup() {
  const last = state.settings.lastAutoBackup;
  if (!last) { exportBackupSilent(); return; }
  const elapsed = Date.now() - new Date(last).getTime();
  const week = 7 * MS_PER_DAY;
  if (elapsed >= week) exportBackupSilent();
}

function exportBackupSilent() {
  const data = {
    version: '1.0.0', exportedAt: nowISO(), auto: true,
    products: state.products, customers: state.customers, suppliers: state.suppliers,
    sales: state.sales, payments: state.payments, treasury: state.treasury,
    treasuryLog: state.treasuryLog, log: state.log, users: state.users, settings: state.settings
  };
  const json = JSON.stringify(data);
  downloadFile(json, 'auto_backup_' + Date.now() + '.json', 'application/json');
  state.settings.lastAutoBackup = nowISO();
  DB.set('settings', state.settings);
  renderBackupInfo();
  toast('🔄 نسخة احتياطية تلقائية');
}

function renderBackupInfo() {
  const el = $('#lastBackupDate');
  if (!el) return;

  if (state.settings.lastAutoBackup) {
    el.textContent = formatDate(state.settings.lastAutoBackup);
  } else {
    el.textContent = 'لم تُنجَز بعد';
  }

  const btn = $('#backupAutoToggle');
  if (btn) {
    if (state.settings.autoBackup) {
      btn.textContent = '🔄 النسخ التلقائي: ✅ مفعّل';
      btn.classList.remove('warning');
      btn.classList.add('success');
    } else {
      btn.textContent = '🔄 النسخ التلقائي: ❌ موقوف';
      btn.classList.remove('success');
      btn.classList.add('warning');
    }
  }
}

function exportExcelBundle() {
  exportProducts();
  setTimeout(() => exportCustomers(), 400);
  setTimeout(() => {
    const rows = [['رقم الفاتورة','التاريخ','الدفع','الزبون','الإجمالي','عدد المنتجات']];
    state.sales.forEach(s => rows.push([
      'INV-' + String(s.id).slice(-6), s.date, s.payType,
      s.customerName || '', s.total, s.items.length
    ]));
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    downloadFile('\uFEFF' + csv, 'sales_' + Date.now() + '.csv', 'text/csv');
    toast('📊 تم تصدير 3 ملفات');
  }, 800);
}

function resetAllData() {
  if (!currentUser || currentUser.role !== 'admin') {
    return toast('❌ فقط المدير', 'error');
  }

  const pwd = prompt('⚠️ سيتم مسح كل البيانات!\n\nاكتب كلمة "مسح" للتأكيد:');
  if (pwd !== 'مسح') return;

  const session = localStorage.getItem('sic_session');
  const deviceId = localStorage.getItem('sic_device_id');

  DB.clearAll();

  if (session) localStorage.setItem('sic_session', session);
  if (deviceId) localStorage.setItem('sic_device_id', deviceId);

  toast('✅ تم المسح');
  setTimeout(() => location.reload(), 800);
}

// ============================================================
// ⚙️ الإعدادات
// ============================================================
function saveSettings() {
  if (!currentUser || currentUser.role !== 'admin') {
    return toast('❌ فقط المدير', 'error');
  }

  const s = state.settings;

  s.companyName = $('#setCompanyName').value.trim() || 'SIC Enterprise';
  s.logo = $('#setLogo').value.trim() || '◆';
  s.phone = $('#setPhone').value.trim();
  s.email = $('#setEmail').value.trim();
  s.address = $('#setAddress').value.trim();
  s.paperSize = $('#setPaperSize').value;
  s.receiptFooter = $('#setReceiptFooter').value.trim();
  s.invoiceStart = +$('#setInvoiceStart').value || 1;
  s.currency = $('#setCurrency').value;
  s.language = $('#setLanguage').value;
  s.darkMode = $('#setDarkMode').checked;
  s.lowStockAlert = +$('#setLowStockAlert').value || 5;
  s.lowBalanceAlert = +$('#setLowBalanceAlert').value || 0;
  s.sensitivePassword = $('#setSensitivePassword').value.trim();

  DB.set('settings', s);
  applyTheme();
  loadSettings();
  renderAll();

  toast('✅ تم حفظ الإعدادات');
}

// ============================================================
// 👤 المستخدمين
// ============================================================
function addUser() {
  if (!currentUser || currentUser.role !== 'admin') {
    return toast('❌ غير مصرح', 'error');
  }

  const username = $('#newUserName').value.trim().toLowerCase();
  const password = $('#newUserPass').value.trim();
  const role = $('#newUserRole').value;
  const pin = $('#newUserPin').value.trim();

  if (!username || !password) return toast('أكمل الحقول', 'error');
  if (state.users.some(u => u.username === username)) return toast('⚠️ الاسم مستخدم', 'error');
  if (pin && (pin.length !== 4 || isNaN(+pin))) return toast('PIN يجب أن يكون 4 أرقام', 'error');
  if (pin && state.users.some(u => u.pin === pin)) return toast('⚠️ PIN مستعمل', 'error');

  const roleNames = { admin: 'مدير عام', manager: 'مدير مخزن', cashier: 'كاشير' };

  state.users.push({
    id: uid(), username, password, pin: pin || null, role,
    name: roleNames[role] + ' - ' + username
  });

  logActivity('user', `مستخدم جديد: ${username}`, 0);
  saveAll();
  renderAll();

  $('#newUserName').value = '';
  $('#newUserPass').value = '';
  $('#newUserPin').value = '';
  $('#userAddPanel').style.display = 'none';
  $('#toggleAddUser').textContent = '➕ إضافة مستخدم';

  toast('👤 تم الإضافة');
}

function deleteUser(id) {
  if (!currentUser || currentUser.role !== 'admin') {
    return toast('❌ غير مصرح', 'error');
  }
  if (id === currentUser.id) return toast('⚠️ لا يمكن حذف نفسك', 'error');

  const user = state.users.find(u => u.id === id);
  if (!user || !confirm(`حذف "${user.username}"؟`)) return;

  state.users = state.users.filter(u => u.id !== id);
  saveAll();
  renderAll();
  toast('🗑️ تم');
}
window.deleteUser = deleteUser;

// ============================================================
// 🎨 العرض العام
// ============================================================
function renderAll() {
  if (!currentUser) return;

  renderDashboard();
  renderPOS();
  renderProductTable();
  renderCustomerList();
  renderSupplierList();
  renderTreasury();
  renderInvoiceList();
  renderActivityLog();
  renderLowStockAlerts();
  renderBackupInfo();
  renderUserList();
  updateDrawerTrial();

  if ($('#activationStatusText')) renderActivationSection();

  if ($('#page-stats').classList.contains('active')) renderReports();
}

function renderDashboard() {
  $('#dashBalance').textContent = fmt(state.treasury);

  const today = new Date();
  const todaySales = state.sales
    .filter(s => new Date(s.date).toDateString() === today.toDateString())
    .reduce((a, b) => a + b.total, 0);

  const todayExp = (state.treasuryLog || [])
    .filter(t => {
      const d = new Date(t.date);
      return d.toDateString() === today.toDateString() && t.amount < 0;
    })
    .reduce((a, b) => a + Math.abs(b.amount), 0);

  $('#dashTodaySales').textContent = fmt(todaySales);
  $('#dashTodayExp').textContent = fmt(todayExp);
  $('#dashProducts').textContent = state.products.length;

  const hour = today.getHours();
  const greet = hour < 12 ? 'صباح الخير' : hour < 18 ? 'مساء الخير' : 'مساء النور';

  $('#dashGreeting').textContent = `${greet}، ${currentUser.name}`;
  $('#dashCompany').textContent = state.settings.companyName || 'SIC Enterprise';
  $('#dashDate').textContent = today.toLocaleDateString('ar-DZ', {
    weekday: 'short', day: 'numeric', month: 'short'
  });
}

function renderPOS() {
  $('#posProduct').innerHTML = state.products.length
    ? state.products.map(p =>
        `<option value="${p.id}">${p.name} — ${fmtNum(p.sell)} (${p.qty})</option>`
      ).join('')
    : '<option>لا منتجات</option>';

  $('#posCustomer').innerHTML = state.customers.length
    ? state.customers.map(c =>
        `<option value="${c.id}">${c.name} (دين: ${fmtNum(c.debt)})</option>`
      ).join('')
    : '<option>لا زبائن</option>';
}

function renderProductTable() {
  const search = ($('#searchProduct')?.value || '').toLowerCase();
  const filtered = state.products.filter(p =>
    p.name.toLowerCase().includes(search) ||
    (p.barcode || '').includes(search) ||
    (p.ref || '').toLowerCase().includes(search)
  );

  const tbody = $('#productList');
  if (!tbody) return;

  tbody.innerHTML = filtered.length
    ? filtered.map(p => {
        const limit = p.minQty || 5;
        const qtyClass = p.qty <= limit ? 'low-qty' : 'ok-qty';
        return `
          <tr>
            <td style="font-family:monospace;font-size:10px;">${p.barcode}</td>
            <td>
              <b>${p.name}</b>
              ${p.ref ? `<br><small style="color:var(--muted);">${p.ref}</small>` : ''}
            </td>
            <td>${fmtNum(p.buy)}</td>
            <td style="color:var(--success);font-weight:700;">${fmtNum(p.sell)}</td>
            <td class="${qtyClass}">${p.qty}</td>
            <td><small>${p.supplierName || '—'}</small></td>
            <td><small>${p.expiry || '—'}</small></td>
            <td>
              <div style="display:flex;gap:4px;">
                <button class="icon-btn" onclick="editProduct(${p.id})" style="width:32px;height:32px;background:rgba(245,158,11,.15);color:var(--warning);border-color:rgba(245,158,11,.3);" title="تعديل">✏️</button>
                <button class="icon-btn danger" onclick="deleteProduct(${p.id})" style="width:32px;height:32px;" title="حذف">✕</button>
              </div>
            </td>
          </tr>`;
      }).join('')
    : '<tr><td colspan="8" style="text-align:center;color:var(--muted);padding:24px;">لا منتجات</td></tr>';
}

function renderCustomerList() {
  const search = ($('#searchCustomer')?.value || '').toLowerCase();
  let filtered = state.customers.filter(c =>
    !search ||
    c.name.toLowerCase().includes(search) ||
    (c.phone || '').includes(search) ||
    (c.code || '').includes(search)
  );

  filtered.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  const box = $('#customerList');
  if (!box) return;

  box.innerHTML = filtered.length
    ? filtered.map(c => `
        <div class="cust-card">
          <div class="cust-card-header">
            <div class="name-block">
              <h4>${c.name}</h4>
              <small>#${c.code || '—'}${c.phone ? ' • 📞 ' + c.phone : ''}</small>
            </div>
          </div>
          <div class="cust-card-stats">
            <div class="stat-line debt">
              <small>الدين</small>
              <b>${fmt(c.debt || 0)}</b>
            </div>
            <div class="stat-line credit">
              <small>حد الائتمان</small>
              <b>${fmt(c.creditLimit || 0)}</b>
            </div>
          </div>
          <div class="cust-card-actions">
            ${c.phone ? `<button class="call" onclick="window.location.href='tel:${c.phone}'"><span>📞</span>اتصال</button>` : ''}
            ${c.debt > 0 ? `<button class="pay" onclick="openPayDebt(${c.id})"><span>💵</span>تسديد</button>` : ''}
            <button class="statement" onclick="openCustomerHistory(${c.id})"><span>📋</span>سجل</button>
            <button class="statement" onclick="openCustomerStatement(${c.id})"><span>📄</span>كشف</button>
            <button class="edit" onclick="editCustomer(${c.id})"><span>✏️</span>تعديل</button>
            <button class="del" onclick="deleteCustomer(${c.id})"><span>🗑️</span>حذف</button>
          </div>
        </div>
      `).join('')
    : emptyState('لا زبائن');

  $('#custCount').textContent = state.customers.length;
  $('#custWithDebt').textContent = state.customers.filter(c => c.debt > 0).length;
  $('#custTotalDebt').textContent = fmtNum(state.customers.reduce((a, b) => a + (b.debt || 0), 0));
}

function renderSupplierList() {
  const search = ($('#searchSupplier')?.value || '').toLowerCase();
  let filtered = state.suppliers.filter(s =>
    !search ||
    s.name.toLowerCase().includes(search) ||
    (s.phone || '').includes(search) ||
    (s.code || '').includes(search)
  );

  filtered.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  const box = $('#supplierList');
  if (!box) return;

  box.innerHTML = filtered.length
    ? filtered.map(s => `
        <div class="cust-card">
          <div class="cust-card-header">
            <div class="name-block">
              <h4>${s.name}</h4>
              <small>#${s.code || '—'}${s.phone ? ' • 📞 ' + s.phone : ''}${s.address ? ' • 📍 ' + s.address : ''}</small>
            </div>
          </div>
          <div class="cust-card-stats">
            <div class="stat-line debt">
              <small>ما علينا له</small>
              <b>${fmt(s.debt || 0)}</b>
            </div>
          </div>
          <div class="cust-card-actions">
            ${s.phone ? `<button class="call" onclick="window.location.href='tel:${s.phone}'"><span>📞</span>اتصال</button>` : ''}
            ${s.debt > 0 ? `<button class="pay" onclick="openPaySupplierDebt(${s.id})"><span>💵</span>تسديد</button>` : ''}
            <button class="statement" onclick="openSupplierHistory(${s.id})"><span>📋</span>سجل</button>
            <button class="statement" onclick="openSupplierStatement(${s.id})"><span>📄</span>كشف</button>
            <button class="edit" onclick="editSupplier(${s.id})"><span>✏️</span>تعديل</button>
            <button class="del" onclick="deleteSupplier(${s.id})"><span>🗑️</span>حذف</button>
          </div>
        </div>
      `).join('')
    : emptyState('لا موردين');

  $('#supCount').textContent = state.suppliers.length;
  $('#supWithDebt').textContent = state.suppliers.filter(s => s.debt > 0).length;
  $('#supTotalDebt').textContent = fmtNum(state.suppliers.reduce((a, b) => a + (b.debt || 0), 0));
}

function renderUserList() {
  const box = $('#userList');
  if (!box) return;

  box.innerHTML = state.users.length
    ? state.users.map(u => {
        const rn = { admin: '👑 مدير عام', manager: '🧰 مدير مخزن', cashier: '👤 كاشير' };
        const isMe = u.id === currentUser.id;
        return `
          <div class="item">
            <div class="item-info">
              <h4>${u.username} ${isMe ? '(أنت)' : ''}</h4>
              <small>${rn[u.role] || u.role}${u.pin ? ' • PIN محدد' : ''}</small>
            </div>
            ${!isMe ? `<button class="icon-btn danger" onclick="deleteUser(${u.id})">✕</button>` : ''}
          </div>`;
      }).join('')
    : emptyState('لا مستخدمين');
}

// ============================================================
// 🛠️ أدوات
// ============================================================
const emptyState = (msg) => `
  <div class="empty-state">
    <span>📭</span>
    ${msg}
  </div>
`;

function downloadFile(content, filename, mimeType = 'text/plain') {
  const blob = new Blob([content], { type: mimeType + ';charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 100);
}
// ============================================================
// 📲 PWA - Install Prompt
// ============================================================
let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  const installBtn = document.getElementById('installBtn');
  if (installBtn) {
    installBtn.style.display = 'flex';
  }
});

document.addEventListener('click', (e) => {
  if (e.target.closest('#installBtn')) {
    if (!deferredPrompt) {
      toast('التطبيق مثبت مسبقاً أو غير مدعوم', 'warning');
      return;
    }
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === 'accepted') {
        toast('✅ تم تثبيت التطبيق');
      } else {
        toast('❌ تم إلغاء التثبيت');
      }
      deferredPrompt = null;
      document.getElementById('installBtn').style.display = 'none';
    });
  }
});

window.addEventListener('appinstalled', () => {
  console.log('✅ PWA installed');
  toast('🎉 التطبيق مثبت على جهازك');
  deferredPrompt = null;
  const installBtn = document.getElementById('installBtn');
  if (installBtn) installBtn.style.display = 'none';
});

// ============================================================
// 📡 Network Status
// ============================================================
window.addEventListener('online', () => {
  toast('✅ عاد الاتصال بالإنترنت');
  updateNetworkStatus(true);
});

window.addEventListener('offline', () => {
  toast('⚠️ لا يوجد اتصال — التطبيق يعمل بدون إنترنت', 'warning');
  updateNetworkStatus(false);
});

function updateNetworkStatus(isOnline) {
  const badge = document.querySelector('.status-badge');
  if (!badge) return;
  
  if (isOnline) {
    badge.innerHTML = '<span class="dot"></span> متصل';
    badge.style.background = 'rgba(34,197,94,.15)';
    badge.style.color = 'var(--success)';
  } else {
    badge.innerHTML = '<span class="dot" style="background:var(--warning);"></span> بدون إنترنت';
    badge.style.background = 'rgba(245,158,11,.15)';
    badge.style.color = 'var(--warning)';
  }
}

// فحص الحالة عند التحميل
document.addEventListener('DOMContentLoaded', () => {
  updateNetworkStatus(navigator.onLine);
});
/* ============================================================
   SIC Enterprise - Data Layer
   Storage, State, Utilities, Activation System
   ============================================================ */

// ============ LOCAL STORAGE WRAPPER ============
const DB = {
  get(key, def = []) {
    try {
      const v = localStorage.getItem('sic_' + key);
      return v ? JSON.parse(v) : def;
    } catch {
      return def;
    }
  },
  set(key, val) {
    try {
      localStorage.setItem('sic_' + key, JSON.stringify(val));
    } catch (e) {
      console.error('Storage error:', e);
    }
  },
  remove(key) {
    localStorage.removeItem('sic_' + key);
  },
  clearAll() {
    Object.keys(localStorage)
      .filter(k => k.startsWith('sic_'))
      .forEach(k => localStorage.removeItem(k));
  }
};

// ============ DEFAULT USERS ============
const DEFAULT_USERS = [
  { id: 1, username: 'admin',   password: '1234', pin: '1234', role: 'admin',   name: 'المدير العام' },
  { id: 2, username: 'cashier', password: '1111', pin: '1111', role: 'cashier', name: 'كاشير' }
];

// ============ DEFAULT SETTINGS ============
const DEFAULT_SETTINGS = {
  companyName: 'SIC Enterprise',
  logo: '◆',
  phone: '',
  email: '',
  address: '',
  paperSize: '80mm',
  receiptFooter: 'شكراً لتعاملكم معنا 🌟',
  invoiceStart: 1,
  currency: 'دج',
  language: 'ar',
  darkMode: false,
  lowStockAlert: 5,
  lowBalanceAlert: 0,
  sensitivePassword: '',
  autoBackup: false,
  lastAutoBackup: null
};

// ============ STATE ============
let state = {
  products:    DB.get('products'),
  customers:   DB.get('customers'),
  suppliers:   DB.get('suppliers'),
  sales:       DB.get('sales'),
  payments:    DB.get('payments'),
  treasury:    DB.get('treasury', 0),
  treasuryLog: DB.get('treasuryLog'),
  log:         DB.get('log'),
  users:       DB.get('users', DEFAULT_USERS),
  settings:    DB.get('settings', DEFAULT_SETTINGS),
  activation:  DB.get('activation', null),
  trial:       DB.get('trial', null)
};

// ============ SAVE ALL ============
function saveAll() {
  DB.set('products',    state.products);
  DB.set('customers',   state.customers);
  DB.set('suppliers',   state.suppliers);
  DB.set('sales',       state.sales);
  DB.set('payments',    state.payments);
  DB.set('treasury',    state.treasury);
  DB.set('treasuryLog', state.treasuryLog);
  DB.set('log',         state.log);
  DB.set('users',       state.users);
  DB.set('settings',    state.settings);
  DB.set('activation',  state.activation);
  DB.set('trial',       state.trial);
}

// ============ UTILITIES ============
const uid = () => Date.now() + Math.floor(Math.random() * 99999);

const fmtNum = (n) => Number(n || 0).toFixed(2);

const fmt = (n) => {
  const c = (state.settings && state.settings.currency) ? state.settings.currency : 'دج';
  return fmtNum(n) + ' ' + c;
};

const nowISO = () => new Date().toISOString();

const formatDate = (iso) => {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleString('ar-DZ', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit'
    });
  } catch { return iso; }
};

const formatDateShort = (iso) => {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('ar-DZ', {
      year: 'numeric', month: '2-digit', day: '2-digit'
    });
  } catch { return iso; }
};

const todayISO = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
};

// ============================================================
// 🔐 ACTIVATION SYSTEM
// ============================================================

// Hash function (custom hash)
function hashString(str) {
  let h1 = 0xdeadbeef ^ str.length;
  let h2 = 0x41c6ce57 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16).padStart(8, '0') +
         (h1 >>> 0).toString(16).padStart(8, '0');
}

// ✅ كلمة السر الحقيقية: Yt11092004
// البصمة تُحسب فوراً
const REAL_HASH = hashString('Yt11092004');

const TRIAL_DAYS = 10;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// توليد معرّف جهاز فريد
function getDeviceId() {
  let id = localStorage.getItem('sic_device_id');
  if (!id) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let s = '';
    for (let i = 0; i < 12; i++) {
      s += chars[Math.floor(Math.random() * chars.length)];
    }
    id = s.substring(0, 4) + '-' + s.substring(4, 8) + '-' + s.substring(8, 12);
    localStorage.setItem('sic_device_id', id);
  }
  return id;
}

// التحقق من التفعيل
function checkActivation() {
  // مفعّل مسبقاً
  if (state.activation && state.activation.active === true) {
    return { status: 'activated' };
  }

  // لم تبدأ التجربة بعد
  if (!state.trial || !state.trial.startDate) {
    state.trial = {
      startDate: nowISO(),
      lastCheck: nowISO(),
      daysUsed: 0
    };
    saveAll();
    return { status: 'trial', daysLeft: TRIAL_DAYS };
  }

  // حساب الأيام المستخدمة
  const start = new Date(state.trial.startDate).getTime();
  const now = Date.now();
  const elapsed = now - start;

  // حماية: تم تغيير التاريخ للخلف؟
  if (elapsed < 0) {
    return { status: 'expired' };
  }

  const daysUsed = Math.floor(elapsed / MS_PER_DAY);
  const daysLeft = TRIAL_DAYS - daysUsed;

  state.trial.daysUsed = daysUsed;
  state.trial.lastCheck = nowISO();
  saveAll();

  if (daysLeft <= 0) {
    return { status: 'expired' };
  }

  return { status: 'trial', daysLeft: Math.max(0, daysLeft) };
}

// محاولة التفعيل
function tryActivate(inputCode) {
  const code = String(inputCode || '').trim();
  if (!code) return { success: false, message: 'أدخل الكود' };

  const inputHash = hashString(code);
  if (inputHash === REAL_HASH) {
    state.activation = {
      active: true,
      activatedAt: nowISO(),
      deviceId: getDeviceId()
    };
    saveAll();
    return { success: true };
  }

  return { success: false, message: '❌ كود التفعيل غير صحيح' };
}

// ============ CODES ============
function generateCustomerCode() {
  const maxCode = state.customers.reduce((m, c) => {
    const n = parseInt(c.code, 10);
    return !isNaN(n) && n > m ? n : m;
  }, 0);
  return String(maxCode + 1).padStart(4, '0');
}

function generateSupplierCode() {
  const maxCode = state.suppliers.reduce((m, s) => {
    const n = parseInt(s.code, 10);
    return !isNaN(n) && n > m ? n : m;
  }, 0);
  return String(maxCode + 1).padStart(4, '0');
}

// ============ TREASURY LOG ============
function addTreasuryMove(type, amount, description, relatedId = null) {
  if (!state.treasuryLog) state.treasuryLog = [];

  state.treasuryLog.unshift({
    id: uid(),
    type,
    amount,
    description,
    relatedId,
    date: nowISO(),
    user: (typeof currentUser !== 'undefined' && currentUser) ? currentUser.name : '—'
  });

  if (state.treasuryLog.length > 500) {
    state.treasuryLog = state.treasuryLog.slice(0, 500);
  }
}

// ============ ACTIVITY LOG ============
function logActivity(type, text, amount = 0) {
  state.log.unshift({
    id: uid(),
    type,
    text,
    amount,
    date: nowISO(),
    user: (typeof currentUser !== 'undefined' && currentUser) ? currentUser.name : '—'
  });
  if (state.log.length > 300) state.log.pop();
}

// ============ EXPENSE TYPES (for backward compatibility) ============
const EXPENSE_TYPES = {
  'goods':       { icon: '🚚', label: 'شراء بضاعة' },
  'sup-payment': { icon: '💵', label: 'تسديد دين مورد' },
  'daily':       { icon: '💸', label: 'مصروف يومي' },
  'misc':        { icon: '🛒', label: 'مصروف متفرق' },
  'other':       { icon: '📌', label: 'مصروف آخر' }
};
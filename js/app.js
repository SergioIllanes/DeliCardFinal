/* =====================================================
   DELICART - Complete Application Logic
   ===================================================== */

// -------------------- CONSTANTS --------------------
const HUB = { lat: -17.9833, lng: -67.1500, name: "Hub Central Oruro" };

const STORES = [
  { id: 1, name: "Pollos Leo", emoji: "🍗", category: "Comida", rating: 4.7, products: [
    { id: 101, name: "Pollo entero", price: 65 },
    { id: 102, name: "1/2 Pollo + papas", price: 38 },
    { id: 103, name: "Alitas x6", price: 28 }
  ]},
  { id: 2, name: "Farmacia Cruz Verde", emoji: "💊", category: "Farmacia", rating: 4.9, products: [
    { id: 201, name: "Paracetamol 500mg", price: 12 },
    { id: 202, name: "Ibuprofeno", price: 15 },
    { id: 203, name: "Vitamina C", price: 22 }
  ]},
  { id: 3, name: "Panadería El Trigal", emoji: "🥖", category: "Panadería", rating: 4.6, products: [
    { id: 301, name: "Pan francés x10", price: 10 },
    { id: 302, name: "Torta de chocolate", price: 85 },
    { id: 303, name: "Empanadas x6", price: 24 }
  ]},
  { id: 4, name: "Minimarket 24h", emoji: "🛒", category: "Minimarket", rating: 4.5, products: [
    { id: 401, name: "Agua 2L", price: 8 },
    { id: 402, name: "Leche 1L", price: 9 },
    { id: 403, name: "Snack pack", price: 15 }
  ]}
];

// -------------------- STATE --------------------
let currentUser = null;
let cart = [];
let orders = [];
let users = [];
let employees = [];
let userLocation = null;
let map = null;
let userMarker = null;
let currentStoreId = null;
let pendingOrder = null;
let selectedPaymentMethod = 'efectivo';

// -------------------- STORAGE HELPERS --------------------
function loadData() {
  users = JSON.parse(localStorage.getItem('deli_users') || '[]');
  employees = JSON.parse(localStorage.getItem('deli_employees') || '[]');
  orders = JSON.parse(localStorage.getItem('deli_orders') || '[]');
  cart = JSON.parse(localStorage.getItem('deli_cart') || '[]');
  
  // Default admin if none exists
  if (!users.find(u => u.role === 'admin')) {
    users.push({
      id: 1,
      name: 'Administrador',
      email: 'admin@delicat.bo',
      password: 'admin123',
      role: 'admin',
      phone: '',
      createdAt: new Date().toISOString()
    });
    saveUsers();
  }
  
  const session = localStorage.getItem('deli_session');
  if (session) {
    currentUser = JSON.parse(session);
  }
}

function saveUsers() { localStorage.setItem('deli_users', JSON.stringify(users)); }
function saveEmployees() { localStorage.setItem('deli_employees', JSON.stringify(employees)); }
function saveOrders() { localStorage.setItem('deli_orders', JSON.stringify(orders)); }
function saveCart() { localStorage.setItem('deli_cart', JSON.stringify(cart)); }
function saveSession() {
  if (currentUser) localStorage.setItem('deli_session', JSON.stringify(currentUser));
  else localStorage.removeItem('deli_session');
}

// -------------------- UTILS --------------------
function showToast(msg, duration = 3000) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), duration);
}

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function formatDate(iso) {
  return new Date(iso).toLocaleString('es-BO', { dateStyle: 'short', timeStyle: 'short' });
}

// -------------------- AUTH --------------------
function showAuth() {
  document.getElementById('appRoot').classList.add('hidden');
  document.getElementById('authRoot').classList.remove('hidden');
}

function showApp() {
  document.getElementById('authRoot').classList.add('hidden');
  document.getElementById('appRoot').classList.remove('hidden');
  updateUIForRole();
  showSection('home');
  renderUserBadge();
}

function login(email, password) {
  const user = users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
  if (!user) {
    showToast('Credenciales incorrectas');
    return false;
  }
  currentUser = { id: user.id, name: user.name, email: user.email, role: user.role };
  saveSession();
  showApp();
  showToast(`Bienvenido, ${user.name}`);
  return true;
}

function register(name, email, password, role, phone = '') {
  if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
    showToast('Este correo ya está registrado');
    return false;
  }
  const newUser = {
    id: Date.now(),
    name,
    email,
    password,
    role: role || 'cliente',
    phone,
    createdAt: new Date().toISOString()
  };
  users.push(newUser);
  saveUsers();
  currentUser = { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role };
  saveSession();
  showApp();
  showToast('Cuenta creada exitosamente');
  return true;
}

function logout() {
  currentUser = null;
  saveSession();
  showAuth();
  showToast('Sesión cerrada');
}

// -------------------- GEOLOCATION --------------------
function getMyLocation() {
  if (!navigator.geolocation) {
    showToast('Tu navegador no soporta geolocalización');
    return;
  }
  const statusEl = document.getElementById('locationStatus');
  if (statusEl) statusEl.innerHTML = '🔄 Obteniendo ubicación GPS...';
  
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      userLocation = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: Math.round(pos.coords.accuracy)
      };
      localStorage.setItem('deli_user_loc', JSON.stringify(userLocation));
      updateLocationUI();
      showToast('Ubicación obtenida correctamente');
    },
    (err) => {
      if (statusEl) statusEl.innerHTML = `❌ Error: ${err.message}`;
      showToast('No se pudo obtener la ubicación');
    },
    { enableHighAccuracy: true, timeout: 12000 }
  );
}

function updateLocationUI() {
  const statusEl = document.getElementById('locationStatus');
  if (!statusEl || !userLocation) return;
  
  const dist = haversine(userLocation.lat, userLocation.lng, HUB.lat, HUB.lng);
  const time = Math.round(dist * 3.8 + 14);
  
  statusEl.innerHTML = `
    <strong>✅ Ubicación activa</strong><br>
    Lat: ${userLocation.lat.toFixed(5)} · Lng: ${userLocation.lng.toFixed(5)} · ±${userLocation.accuracy}m<br>
    📏 Distancia al Hub: <strong>${dist.toFixed(2)} km</strong> · 
    ⏱ Tiempo estimado: <strong>~${time} min</strong>
  `;
  
  if (map) {
    if (userMarker) map.removeLayer(userMarker);
    userMarker = L.marker([userLocation.lat, userLocation.lng]).addTo(map)
      .bindPopup('📍 Tu ubicación actual').openPopup();
    map.setView([userLocation.lat, userLocation.lng], 14);
  }
}

function initMap() {
  const mapEl = document.getElementById('map');
  if (!mapEl || map) return;
  
  map = L.map('map').setView([HUB.lat, HUB.lng], 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap'
  }).addTo(map);
  
  L.marker([HUB.lat, HUB.lng]).addTo(map)
    .bindPopup('🏢 Hub Central DeliCart').openPopup();
  
  const saved = localStorage.getItem('deli_user_loc');
  if (saved) {
    userLocation = JSON.parse(saved);
    updateLocationUI();
  }
}

// -------------------- NAVIGATION --------------------
function showSection(id) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  const el = document.getElementById('section-' + id);
  if (el) el.classList.add('active');
  
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const nav = document.querySelector(`.nav-item[data-section="${id}"]`);
  if (nav) nav.classList.add('active');
  
  // Update topbar title
  const titles = {
    home: 'Inicio',
    pedir: 'Pedir',
    carrito: 'Carrito',
    seguimiento: 'Seguimiento',
    delipass: 'DeliPass',
    comercio: 'Panel Comercio',
    repartidor: 'Panel Repartidor',
    admin: 'Administración',
    empleados: 'Empleados',
    usuarios: 'Usuarios'
  };
  const titleEl = document.getElementById('topbarTitle');
  if (titleEl) titleEl.textContent = titles[id] || 'DeliCart';
  
  // Render content
  if (id === 'pedir') renderStores();
  if (id === 'carrito') renderCart();
  if (id === 'seguimiento') renderOrders();
  if (id === 'comercio') renderComercioOrders();
  if (id === 'repartidor') renderDriverOrders();
  if (id === 'admin') renderAdminDashboard();
  if (id === 'empleados') renderEmployees();
  if (id === 'usuarios') renderUsers();
  if (id === 'delipass') updatePassUI();
  if (id === 'home') setTimeout(initMap, 100);
  
  // Close mobile sidebar
  document.getElementById('sidebar')?.classList.remove('open');
  document.getElementById('sidebarOverlay')?.classList.remove('open');
}

function updateUIForRole() {
  const role = currentUser?.role || 'cliente';
  
  // Show/hide nav items by role
  document.querySelectorAll('[data-roles]').forEach(el => {
    const allowed = el.dataset.roles.split(',');
    el.style.display = allowed.includes(role) ? '' : 'none';
  });
}

function renderUserBadge() {
  const el = document.getElementById('userBadge');
  if (!el || !currentUser) return;
  const initial = currentUser.name.charAt(0).toUpperCase();
  el.innerHTML = `
    <div class="user-badge">
      <div class="user-avatar">${initial}</div>
      <span>${currentUser.name}</span>
    </div>
  `;
}

// -------------------- STORES & CART --------------------
function renderStores() {
  const grid = document.getElementById('storesGrid');
  if (!grid) return;
  grid.innerHTML = STORES.map(s => `
    <div class="store-card" onclick="openStore(${s.id})">
      <div class="store-img">${s.emoji}</div>
      <div class="store-body">
        <h3>${s.name}</h3>
        <span class="badge">${s.category}</span>
        <div class="mt-1 text-sm text-muted">★ ${s.rating}</div>
      </div>
    </div>
  `).join('');
}

function openStore(id) {
  currentStoreId = id;
  const store = STORES.find(s => s.id === id);
  const content = document.getElementById('storeDetailContent');
  content.innerHTML = `
    <button class="btn btn-ghost btn-sm mb-2" onclick="showSection('pedir')">← Volver a comercios</button>
    <div class="card">
      <h2 style="font-size:1.4rem;margin-bottom:0.25rem">${store.emoji} ${store.name}</h2>
      <p class="text-muted text-sm mb-2">${store.category} · ★ ${store.rating}</p>
      <div class="grid">
        ${store.products.map(p => `
          <div class="card" style="margin:0;padding:1.1rem">
            <h3 style="font-size:1rem">${p.name}</h3>
            <div class="price mt-1">Bs ${p.price}</div>
            <button class="btn btn-primary btn-sm btn-block mt-2"
              onclick="addToCart(${store.id}, ${p.id}, '${p.name}', ${p.price})">
              Agregar al carrito
            </button>
          </div>
        `).join('')}
      </div>
    </div>
  `;
  showSection('storeDetail');
}

function addToCart(storeId, productId, name, price) {
  cart.push({ storeId, productId, name, price, qty: 1 });
  saveCart();
  updateCartCount();
  showToast(`${name} agregado`);
}

function updateCartCount() {
  const el = document.getElementById('cartCount');
  if (el) el.textContent = cart.length;
}

function renderCart() {
  const el = document.getElementById('cartContent');
  if (!el) return;
  
  if (cart.length === 0) {
    el.innerHTML = `<div class="empty-state"><div class="icon">🛒</div>Tu carrito está vacío</div>`;
    return;
  }
  
  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const hasPass = localStorage.getItem('deli_pass') === 'true';
  const shipping = hasPass ? 0 : (userLocation ? Math.min(25, Math.max(8, Math.round(haversine(userLocation.lat, userLocation.lng, HUB.lat, HUB.lng) * 3))) : 12);
  
  el.innerHTML = `
    ${cart.map((item, idx) => `
      <div class="flex justify-between items-center" style="padding:0.85rem 0;border-bottom:1px solid var(--gray-200)">
        <div>
          <strong>${item.name}</strong><br>
          <span class="price">Bs ${item.price}</span>
        </div>
        <button class="btn btn-danger btn-sm" onclick="removeFromCart(${idx})">✕</button>
      </div>
    `).join('')}
    <div class="mt-2">
      <div class="flex justify-between mb-1"><span>Subtotal</span><strong>Bs ${total}</strong></div>
      <div class="flex justify-between mb-1"><span>Envío ${hasPass ? '(DeliPass ✓)' : ''}</span><strong>Bs ${shipping}</strong></div>
      <div class="flex justify-between" style="font-size:1.15rem;margin-top:0.75rem">
        <span>Total</span><strong class="price">Bs ${total + shipping}</strong>
      </div>
    </div>
    <div class="form-group mt-2">
      <label>Dirección de entrega</label>
      <input type="text" class="form-control" id="deliveryAddress" 
        placeholder="Calle, número, zona o referencia..." 
        value="${userLocation ? 'Ubicación GPS actual' : ''}">
    </div>
    <button class="btn btn-primary btn-block mt-1" onclick="placeOrder(${shipping})">
      Confirmar pedido · Bs ${total + shipping}
    </button>
  `;
}

function removeFromCart(idx) {
  cart.splice(idx, 1);
  saveCart();
  updateCartCount();
  renderCart();
}

function placeOrder(shipping) {
  if (cart.length === 0) return;
  const address = document.getElementById('deliveryAddress')?.value || 'Sin dirección';
  const storeId = cart[0].storeId;
  const store = STORES.find(s => s.id === storeId);
  
  pendingOrder = {
    id: Date.now(),
    customerId: currentUser?.id,
    customerName: currentUser?.name || 'Cliente',
    items: [...cart],
    storeId,
    storeName: store.name,
    address,
    shipping,
    subtotal: cart.reduce((s, i) => s + i.price * i.qty, 0),
    total: cart.reduce((s, i) => s + i.price * i.qty, 0) + shipping,
    status: 'pending',
    createdAt: new Date().toISOString(),
    customerLoc: userLocation,
    rating: null,
    paymentMethod: null,
    paymentStatus: 'pending'
  };
  
  openPaymentModal();
}

// -------------------- PAYMENT SYSTEM --------------------
function openPaymentModal() {
  if (!pendingOrder) return;
  selectedPaymentMethod = 'efectivo';
  
  // Reset UI
  document.querySelectorAll('.payment-method').forEach(el => {
    el.classList.toggle('selected', el.dataset.method === 'efectivo');
  });
  document.querySelectorAll('.payment-details').forEach(el => el.classList.remove('active'));
  document.getElementById('details-efectivo').classList.add('active');
  
  // Summary
  document.getElementById('paymentSummary').innerHTML = `
    <div class="row"><span>Subtotal</span><span>Bs ${pendingOrder.subtotal}</span></div>
    <div class="row"><span>Envío</span><span>Bs ${pendingOrder.shipping}</span></div>
    <div class="row total"><span>Total a pagar</span><span>Bs ${pendingOrder.total}</span></div>
  `;
  
  document.getElementById('processingOverlay').classList.add('hidden');
  document.getElementById('paymentModal').classList.add('open');
}

function closePaymentModal() {
  document.getElementById('paymentModal').classList.remove('open');
  pendingOrder = null;
}

function selectPaymentMethod(method) {
  selectedPaymentMethod = method;
  document.querySelectorAll('.payment-method').forEach(el => {
    el.classList.toggle('selected', el.dataset.method === method);
  });
  document.querySelectorAll('.payment-details').forEach(el => el.classList.remove('active'));
  const details = document.getElementById('details-' + method);
  if (details) details.classList.add('active');
}

function confirmPayment() {
  if (!pendingOrder) return;
  
  // Basic validation for card
  if (selectedPaymentMethod === 'tarjeta') {
    const num = document.getElementById('cardNumber')?.value.replace(/\s/g, '') || '';
    const exp = document.getElementById('cardExpiry')?.value || '';
    const cvv = document.getElementById('cardCvv')?.value || '';
    const name = document.getElementById('cardName')?.value || '';
    if (num.length < 13 || !exp || cvv.length < 3 || !name) {
      showToast('Completa los datos de la tarjeta');
      return;
    }
  }
  
  // Show processing
  const overlay = document.getElementById('processingOverlay');
  overlay.classList.remove('hidden');
  
  // Simulate processing delay
  setTimeout(() => {
    const isOnlinePayment = selectedPaymentMethod === 'tarjeta' || selectedPaymentMethod === 'qr';
    
    pendingOrder.paymentMethod = selectedPaymentMethod;
    pendingOrder.paymentStatus = isOnlinePayment ? 'paid' : 'pending'; // cash = pending until delivery
    pendingOrder.paymentRef = isOnlinePayment ? 'PAY-' + Date.now().toString(36).toUpperCase() : null;
    
    orders.unshift(pendingOrder);
    saveOrders();
    
    cart = [];
    saveCart();
    updateCartCount();
    
    overlay.classList.add('hidden');
    closePaymentModal();
    
    const methodLabels = {
      efectivo: 'Efectivo (contra entrega)',
      qr: 'QR / Transferencia',
      tarjeta: 'Tarjeta'
    };
    
    showToast(`¡Pedido confirmado! Pago: ${methodLabels[selectedPaymentMethod]}`);
    showSection('seguimiento');
  }, selectedPaymentMethod === 'tarjeta' ? 1800 : 900);
}

// -------------------- ORDERS --------------------
function renderOrders() {
  const el = document.getElementById('ordersList');
  if (!el) return;
  
  const myOrders = currentUser?.role === 'admin' 
    ? orders 
    : orders.filter(o => o.customerId === currentUser?.id);
  
  if (myOrders.length === 0) {
    el.innerHTML = `<div class="empty-state"><div class="icon">📦</div>Aún no tienes pedidos</div>`;
    return;
  }
  
  const steps = ['pending', 'preparing', 'assigned', 'onway', 'delivered'];
  const labels = ['Recibido', 'Preparando', 'Asignado', 'En camino', 'Entregado'];
  
  el.innerHTML = myOrders.map(o => {
    const currentIdx = steps.indexOf(o.status);
    return `
      <div class="card">
        <div class="flex justify-between flex-wrap gap-1">
          <div>
            <strong>#${String(o.id).slice(-6)}</strong> · ${o.storeName}<br>
            <span class="text-sm text-muted">${formatDate(o.createdAt)}</span>
          </div>
          <div class="price">Bs ${o.total}</div>
        </div>
        <div class="status-bar">
          ${steps.map((s, i) => `
            <div class="status-step ${i < currentIdx ? 'done' : ''} ${i === currentIdx ? 'active' : ''}">
              <div class="status-dot">${i < currentIdx ? '✓' : i+1}</div>
              <small>${labels[i]}</small>
            </div>
          `).join('')}
        </div>
        <p class="text-sm text-muted">📍 ${o.address}</p>
        <p class="text-sm mt-1">
          💳 ${({efectivo:'Efectivo',qr:'QR/Transferencia',tarjeta:'Tarjeta'}[o.paymentMethod] || '—')}
          ${o.paymentStatus === 'paid' 
            ? '<span class="badge-paid">Pagado</span>' 
            : '<span class="badge-pending">Pendiente</span>'}
          ${o.paymentRef ? ` · Ref: ${o.paymentRef}` : ''}
        </p>
        ${o.status === 'delivered' && !o.rating ? `
          <div class="mt-2">
            <label class="text-sm">Califica tu experiencia:</label>
            <div class="flex gap-1 mt-1">
              ${[1,2,3,4,5].map(n => `
                <button class="btn btn-outline btn-sm" onclick="rateOrder(${o.id}, ${n})">${n} ★</button>
              `).join('')}
            </div>
          </div>
        ` : o.rating ? `<p class="mt-1 text-sm">Tu calificación: ${'★'.repeat(o.rating)}</p>` : ''}
      </div>
    `;
  }).join('');
}

function rateOrder(id, stars) {
  const o = orders.find(x => x.id === id);
  if (o) {
    o.rating = stars;
    saveOrders();
    showToast(`¡Gracias! Calificaste con ${stars} estrellas`);
    renderOrders();
  }
}

function updateOrderStatus(id, status) {
  const o = orders.find(x => x.id === id);
  if (o) {
    o.status = status;
    saveOrders();
    showToast(`Pedido actualizado → ${status}`);
    // Refresh relevant views
    const active = document.querySelector('.section.active')?.id?.replace('section-', '');
    if (active === 'comercio') renderComercioOrders();
    if (active === 'repartidor') renderDriverOrders();
    if (active === 'admin') renderAdminDashboard();
    if (active === 'seguimiento') renderOrders();
  }
}

// -------------------- ROLE PANELS --------------------
function renderComercioOrders() {
  const el = document.getElementById('comercioOrders');
  if (!el) return;
  const list = orders.filter(o => ['pending', 'preparing'].includes(o.status));
  
  if (list.length === 0) {
    el.innerHTML = `<div class="empty-state">No hay pedidos pendientes</div>`;
    return;
  }
  
  el.innerHTML = list.map(o => `
    <div class="order-item">
      <strong>#${String(o.id).slice(-6)}</strong> · ${o.items.map(i => i.name).join(', ')}<br>
      <span class="meta">Cliente: ${o.customerName} · Total: Bs ${o.total} · ${o.status}</span>
      <div class="flex gap-1 mt-1 flex-wrap">
        ${o.status === 'pending' ? `
          <button class="btn btn-primary btn-sm" onclick="updateOrderStatus(${o.id}, 'preparing')">Aceptar y preparar</button>
        ` : ''}
        ${o.status === 'preparing' ? `
          <button class="btn btn-success btn-sm" onclick="updateOrderStatus(${o.id}, 'assigned')">Listo para recojo</button>
        ` : ''}
      </div>
    </div>
  `).join('');
}

function renderDriverOrders() {
  const el = document.getElementById('driverOrders');
  if (!el) return;
  const list = orders.filter(o => ['assigned', 'onway'].includes(o.status));
  
  if (list.length === 0) {
    el.innerHTML = `<div class="empty-state">No hay pedidos asignados</div>`;
    return;
  }
  
  el.innerHTML = list.map(o => `
    <div class="order-item">
      <strong>#${String(o.id).slice(-6)}</strong> · ${o.storeName}<br>
      <span class="meta">📍 ${o.address}</span><br>
      <span class="meta">Estado: <strong>${o.status}</strong></span>
      <div class="flex gap-1 mt-1 flex-wrap">
        ${o.status === 'assigned' ? `
          <button class="btn btn-primary btn-sm" onclick="updateOrderStatus(${o.id}, 'onway')">Ya recogí el pedido</button>
        ` : ''}
        ${o.status === 'onway' ? `
          <button class="btn btn-success btn-sm" onclick="updateOrderStatus(${o.id}, 'delivered')">Marcar entregado</button>
        ` : ''}
      </div>
    </div>
  `).join('');
}

function updateDriverLocation() {
  if (!navigator.geolocation) return showToast('Geolocalización no disponible');
  navigator.geolocation.getCurrentPosition(pos => {
    const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    localStorage.setItem('deli_driver_loc', JSON.stringify(loc));
    document.getElementById('driverLocation').innerHTML = `
      ✅ Ubicación actualizada · Lat: ${loc.lat.toFixed(5)} · Lng: ${loc.lng.toFixed(5)}
    `;
    showToast('Ubicación del repartidor actualizada');
  }, () => showToast('Error al obtener ubicación'));
}

// -------------------- ADMIN --------------------
function renderAdminDashboard() {
  const total = orders.length;
  const delivered = orders.filter(o => o.status === 'delivered').length;
  const revenue = orders.reduce((s, o) => s + o.total, 0);
  const rated = orders.filter(o => o.rating);
  const avgRating = rated.length ? (rated.reduce((s, o) => s + o.rating, 0) / rated.length).toFixed(1) : '—';
  
  document.getElementById('adminStats').innerHTML = `
    <div class="stat-card"><div class="stat-value">${total}</div><div class="stat-label">Pedidos totales</div></div>
    <div class="stat-card"><div class="stat-value">${delivered}</div><div class="stat-label">Entregados</div></div>
    <div class="stat-card"><div class="stat-value">Bs ${revenue}</div><div class="stat-label">Ingresos</div></div>
    <div class="stat-card"><div class="stat-value">${avgRating}</div><div class="stat-label">Calificación media</div></div>
  `;
  
  const el = document.getElementById('adminOrders');
  el.innerHTML = orders.length === 0 
    ? '<div class="empty-state">Sin pedidos aún</div>'
    : orders.slice(0, 15).map(o => `
      <div class="order-item">
        #${String(o.id).slice(-6)} · ${o.storeName} · <strong>${o.status}</strong> · Bs ${o.total}
        ${o.paymentStatus === 'paid' ? '<span class="badge-paid">Pagado</span>' : '<span class="badge-pending">Pendiente</span>'}
        ${o.status === 'preparing' ? `
          <button class="btn btn-primary btn-sm" style="margin-left:0.75rem" 
            onclick="updateOrderStatus(${o.id}, 'assigned')">Asignar repartidor</button>
        ` : ''}
      </div>
    `).join('');
}

// -------------------- EMPLOYEES (Admin) --------------------
function renderEmployees() {
  const el = document.getElementById('employeesList');
  if (!el) return;
  
  if (employees.length === 0) {
    el.innerHTML = `<div class="empty-state">No hay empleados registrados</div>`;
  } else {
    el.innerHTML = `
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Cargo</th>
              <th>Teléfono</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${employees.map(e => `
              <tr>
                <td><strong>${e.name}</strong></td>
                <td>${e.role}</td>
                <td>${e.phone || '—'}</td>
                <td><span class="badge">${e.active ? 'Activo' : 'Inactivo'}</span></td>
                <td>
                  <button class="btn btn-ghost btn-sm" onclick="toggleEmployee(${e.id})">
                    ${e.active ? 'Desactivar' : 'Activar'}
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }
}

function addEmployee(name, role, phone) {
  if (!name || !role) {
    showToast('Completa los campos obligatorios');
    return;
  }
  employees.push({
    id: Date.now(),
    name,
    role,
    phone: phone || '',
    active: true,
    createdAt: new Date().toISOString()
  });
  saveEmployees();
  showToast(`Empleado ${name} registrado`);
  document.getElementById('empForm')?.reset();
  renderEmployees();
}

function toggleEmployee(id) {
  const e = employees.find(x => x.id === id);
  if (e) {
    e.active = !e.active;
    saveEmployees();
    renderEmployees();
  }
}

// -------------------- USERS (Admin) --------------------
function renderUsers() {
  const el = document.getElementById('usersList');
  if (!el) return;
  
  el.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Email</th>
            <th>Rol</th>
            <th>Registro</th>
          </tr>
        </thead>
        <tbody>
          ${users.map(u => `
            <tr>
              <td><strong>${u.name}</strong></td>
              <td>${u.email}</td>
              <td><span class="badge">${u.role}</span></td>
              <td class="text-sm text-muted">${formatDate(u.createdAt)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// -------------------- DELIPASS --------------------
function subscribeDeliPass() {
  localStorage.setItem('deli_pass', 'true');
  updatePassUI();
  showToast('¡Bienvenido a DeliPass!');
}

function updatePassUI() {
  const has = localStorage.getItem('deli_pass') === 'true';
  const btn = document.getElementById('subscribeBtn');
  const status = document.getElementById('passStatus');
  if (btn && status) {
    if (has) {
      btn.classList.add('hidden');
      status.textContent = '✅ Ya tienes DeliPass activo';
      status.style.color = 'var(--success)';
    } else {
      btn.classList.remove('hidden');
      status.textContent = '';
    }
  }
}

// -------------------- INIT --------------------
document.addEventListener('DOMContentLoaded', () => {
  loadData();
  updateCartCount();
  
  // Auth form handlers
  document.getElementById('loginForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const pass = document.getElementById('loginPassword').value;
    login(email, pass);
  });
  
  document.getElementById('registerForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('regName').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const pass = document.getElementById('regPassword').value;
    const role = document.getElementById('regRole').value;
    const phone = document.getElementById('regPhone')?.value.trim() || '';
    register(name, email, pass, role, phone);
  });
  
  // Auth tabs
  document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const target = tab.dataset.tab;
      document.getElementById('loginForm').classList.toggle('hidden', target !== 'login');
      document.getElementById('registerForm').classList.toggle('hidden', target !== 'register');
    });
  });
  
  // Employee form
  document.getElementById('empForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    addEmployee(
      document.getElementById('empName').value.trim(),
      document.getElementById('empRole').value,
      document.getElementById('empPhone').value.trim()
    );
  });
  
  // Mobile menu
  document.getElementById('menuToggle')?.addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('sidebarOverlay').classList.toggle('open');
  });
  document.getElementById('sidebarOverlay')?.addEventListener('click', () => {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarOverlay').classList.remove('open');
  });
  
  // Start
  if (currentUser) {
    showApp();
  } else {
    showAuth();
  }
});

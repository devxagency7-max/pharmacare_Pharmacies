/**
 * app.js - Pharmacy Dashboard Logic
 * All sections now connected to the real API.
 */

const OWNER_ONLY_SECTIONS = ['dashboard', 'orders', 'reports', 'branches', 'settings'];

// Global state — populated after GET /users/me
let _pharmacyId  = null;
let _branchId    = null;
let _currentUser = null;
let _pollInterval = null;

// ─────────────────────────────────────────────────────────────
// Bootstrap
// ─────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
    // Guard: redirect to login if no token
    if (!localStorage.getItem('firebase_token')) {
        window.location.href = 'login.html';
        return;
    }

    const sidebar       = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const navItems      = document.querySelectorAll('.nav-item');
    const sections      = document.querySelectorAll('.section-content');

    // 1. Load fresh user profile from backend
    await loadCurrentUser();

    const userInfo = JSON.parse(localStorage.getItem('user_info') || '{}');
    const roles    = userInfo.roles || [];
    const isOwner  = roles.includes('PharmacyOwner');

    // 2. Role-based nav — hide owner-only items from pharmacists
    if (!isOwner) {
        navItems.forEach(item => {
            const sec = item.getAttribute('data-section');
            if (OWNER_ONLY_SECTIONS.includes(sec)) item.closest('li').style.display = 'none';
        });
    }

    // 3. Sidebar toggle
    sidebarToggle.addEventListener('click', () => sidebar.classList.toggle('close'));

    // 4. Routing
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const sectionName = item.getAttribute('data-section');
            navItems.forEach(n => n.classList.remove('active'));
            item.classList.add('active');
            sections.forEach(s => {
                s.classList.remove('active');
                if (s.id === sectionName) s.classList.add('active');
            });
            initSection(sectionName);
        });
    });

    function initSection(name) {
        if (name === 'dashboard')     initDashboard();
        if (name === 'orders')        renderOrders();
        if (name === 'prescriptions') renderPrescriptions();
        if (name === 'branches')      renderBranches();
        if (name === 'notifications') renderNotifications();
        if (name === 'reports')       renderReports();
        if (name === 'settings')      initSettings();
    }

    // 5. Default landing
    const defaultSection = isOwner ? 'dashboard' : 'prescriptions';
    navItems.forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('data-section') === defaultSection) item.classList.add('active');
    });
    sections.forEach(s => {
        s.classList.remove('active');
        if (s.id === defaultSection) s.classList.add('active');
    });
    initSection(defaultSection);

    // 6. Start polling (unread count every 30s, orders refresh every 20s)
    startPolling();
});

// ─────────────────────────────────────────────────────────────
// User / Topbar
// ─────────────────────────────────────────────────────────────

async function loadCurrentUser() {
    const result = await apiGetMe();
    // Token expired or revoked — force re-login
    if (result.status === 401 || result.status === 403) {
        logout();
        return;
    }
    if (!result.success || !result.data) return;

    const d = result.data;
    _currentUser = d;
    _pharmacyId  = d.pharmacyId || null;
    _branchId    = d.branchId   || null;

    localStorage.setItem('user_info', JSON.stringify(d));

    // Update topbar
    const nameEl = document.querySelector('.profile-info .name');
    if (nameEl) nameEl.textContent = d.name || 'Pharmacy';

    const imgEl = document.querySelector('.profile img');
    if (imgEl && d.avatarUrl) imgEl.src = d.avatarUrl;

    // Unread count badge
    updateNotificationBadge();
}

async function updateNotificationBadge() {
    const res = await apiGetUnreadCount();
    const badge = document.querySelector('.notification-icon .badge');
    if (!badge) return;
    if (res.success && res.data > 0) {
        badge.textContent = res.data;
        badge.style.display = 'flex';
    } else {
        badge.style.display = 'none';
    }
}

function startPolling() {
    if (_pollInterval) clearInterval(_pollInterval);
    _pollInterval = setInterval(() => {
        updateNotificationBadge();
        // Refresh orders if that tab is currently visible
        const ordersSection = document.getElementById('orders');
        if (ordersSection && ordersSection.classList.contains('active')) {
            renderOrders(false); // silent refresh (no loading flash)
        }
    }, 20000);
}

// ─────────────────────────────────────────────────────────────
// Dashboard
// ─────────────────────────────────────────────────────────────

async function initDashboard() {
    // Stats cards from real API
    await loadDashboardStats();

    // Charts — use top-medications for doughnut, fulfillment-trend for line
    const ctxTrend   = document.getElementById('ordersTrendChart');
    const ctxSelling = document.getElementById('topSellingChart');
    if (!ctxTrend || !ctxSelling) return;

    if (window._dashTrendChart)   { window._dashTrendChart.destroy();   window._dashTrendChart   = null; }
    if (window._dashSellingChart) { window._dashSellingChart.destroy(); window._dashSellingChart = null; }

    if (!_pharmacyId) return;

    const token   = localStorage.getItem('firebase_token');
    const headers = { 'Authorization': `Bearer ${token}` };
    const BASE    = API_BASE;

    try {
        const [trendRes, topRes] = await Promise.all([
            safeJson(await fetch(`${BASE}/pharmacy/dashboard/fulfillment-trend?pharmacyId=${_pharmacyId}&months=7`, { headers })),
            safeJson(await fetch(`${BASE}/pharmacy/dashboard/top-medications?pharmacyId=${_pharmacyId}&limit=3`, { headers }))
        ]);

        if (trendRes.success) {
            const labels = trendRes.data.map(p => `${p.month}/${p.year}`);
            const counts = trendRes.data.map(p => p.completedCount);
            window._dashTrendChart = new Chart(ctxTrend.getContext('2d'), {
                type: 'line',
                data: {
                    labels,
                    datasets: [{
                        label: 'Completed Orders',
                        data: counts,
                        borderColor: '#0057d1',
                        backgroundColor: 'rgba(0,87,209,0.1)',
                        tension: 0.4,
                        fill: true
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false }
            });
        }

        if (topRes.success && topRes.data.length) {
            const medLabels = topRes.data.map(m => m.name);
            const medCounts = topRes.data.map(m => m.orderItemCount);
            window._dashSellingChart = new Chart(ctxSelling.getContext('2d'), {
                type: 'doughnut',
                data: {
                    labels: medLabels,
                    datasets: [{ data: medCounts, backgroundColor: ['#0057d1', '#10B981', '#F59E0B'] }]
                },
                options: { responsive: true, maintainAspectRatio: false }
            });
        }
    } catch (err) {
        console.error('initDashboard charts error:', err);
    }
}

async function loadDashboardStats() {
    if (!_branchId) {
        // Fallback: try to read from localStorage
        const u = JSON.parse(localStorage.getItem('user_info') || '{}');
        _branchId   = u.branchId   || null;
        _pharmacyId = u.pharmacyId || null;
    }

    if (!_branchId) return;

    const BASE    = API_BASE;
    const token   = localStorage.getItem('firebase_token');
    const headers = { 'Authorization': `Bearer ${token}` };

    try {
        const res = await safeJson(await fetch(`${BASE}/orders/summary?branchId=${_branchId}`, { headers }));
        if (!res.success) return;

        const d = res.data;
        const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        set('stat-pending-orders',    d.pending    ?? 0);
        set('stat-processing-orders', d.accepted   ?? 0);
        set('stat-confirmed-orders',  d.completed  ?? 0);
        set('stat-rejected-orders',   (d.rejected ?? 0) + (d.cancelled ?? 0));
    } catch (err) {
        console.error('loadDashboardStats error:', err);
    }
}

// ─────────────────────────────────────────────────────────────
// Orders
// ─────────────────────────────────────────────────────────────

async function renderOrders(showLoading = true) {
    const tableNew        = document.getElementById('table-new-orders');
    const tableProcessing = document.getElementById('table-processing-orders');
    const tableHistory    = document.getElementById('table-history-orders');
    if (!tableNew) return;

    const bid = _branchId || JSON.parse(localStorage.getItem('user_info') || '{}').branchId;
    if (!bid) {
        tableNew.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#EF4444">Branch ID not found. Please re-login.</td></tr>';
        return;
    }

    if (showLoading) {
        const placeholder = '<tr><td colspan="5" style="text-align:center">Loading...</td></tr>';
        tableNew.innerHTML = placeholder;
        tableProcessing.innerHTML = '<tr><td colspan="4" style="text-align:center">Loading...</td></tr>';
        tableHistory.innerHTML    = '<tr><td colspan="4" style="text-align:center">Loading...</td></tr>';
    }

    const BASE    = API_BASE;
    const token   = localStorage.getItem('firebase_token');
    const headers = { 'Authorization': `Bearer ${token}` };

    try {
        const res = await safeJson(await fetch(
            `${BASE}/orders/branch/${bid}?pageSize=100&sortDirection=desc`, { headers }
        ));

        if (!res.success) {
            tableNew.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#EF4444">${res.message || 'Failed to load orders'}</td></tr>`;
            return;
        }

        const all       = res.data.items || [];
        const pending   = all.filter(o => o.orderStatus === 'Pending');
        const accepted  = all.filter(o => o.orderStatus === 'Accepted');
        const history   = all.filter(o => ['Completed', 'Rejected', 'Cancelled'].includes(o.orderStatus));

        // Tab 1 — Incoming (Pending)
        tableNew.innerHTML = pending.map(o => `
            <tr>
                <td>#${o.id.slice(0,8)}</td>
                <td>${o.customerName}</td>
                <td>${(o.items || []).map(i => `${i.name} ×${i.quantity}`).join(', ') || '—'}</td>
                <td>${formatTime(o.createdAt)}</td>
                <td class="table-actions">
                    <button class="action-btn approve" onclick="promptAccept('${o.id}')">Accept</button>
                    <button class="action-btn reject"  onclick="promptReject('${o.id}')">Reject</button>
                </td>
            </tr>
        `).join('') || '<tr><td colspan="5" style="text-align:center">No new orders</td></tr>';

        // Tab 2 — Processing (Accepted)
        tableProcessing.innerHTML = accepted.map(o => `
            <tr>
                <td>#${o.id.slice(0,8)}</td>
                <td>${o.customerName}</td>
                <td>${o.deliveryNotes || '—'}</td>
                <td class="table-actions">
                    <button class="action-btn approve" onclick="handleOrderAction('${o.id}','complete')">Complete (Done)</button>
                </td>
            </tr>
        `).join('') || '<tr><td colspan="4" style="text-align:center">No orders in process</td></tr>';

        // Tab 3 — History
        tableHistory.innerHTML = history.map(o => `
            <tr>
                <td>#${o.id.slice(0,8)}</td>
                <td>${o.customerName}</td>
                <td><span class="status-badge ${getStatusClass(o.orderStatus)}">${o.orderStatus}</span></td>
                <td><span class="status-badge ${getPaymentClass(o.paymentStatus)}">${o.paymentStatus || '—'}</span></td>
                <td>${o.finalPrice != null ? o.finalPrice + ' EGP' : '—'}</td>
                <td>${formatTime(o.createdAt)}</td>
            </tr>
        `).join('') || '<tr><td colspan="6" style="text-align:center">History is empty</td></tr>';

        // Update dashboard stat cards too
        loadDashboardStats();

    } catch (err) {
        console.error('renderOrders error:', err);
        tableNew.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#EF4444">Network error. Please try again.</td></tr>';
    }
}

async function handleOrderAction(orderId, action, notes = '', finalPrice = null) {
    const BASE    = API_BASE;
    const token   = localStorage.getItem('firebase_token');
    const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

    try {
        let res;

        if (action === 'accept') {
            res = await safeJson(await fetch(`${BASE}/orders/${orderId}/respond`, {
                method: 'POST', headers,
                body: JSON.stringify({ action: 'accept', notes, finalPrice })
            }));

        } else if (action === 'reject-confirm') {
            res = await safeJson(await fetch(`${BASE}/orders/${orderId}/respond`, {
                method: 'POST', headers,
                body: JSON.stringify({ action: 'reject', notes })
            }));

        } else if (action === 'complete') {
            res = await safeJson(await fetch(`${BASE}/orders/${orderId}/complete`, {
                method: 'POST', headers
            }));
        }

        if (res && res.success) {
            if (action === 'accept')         switchQueueTab('processing');
            if (action === 'complete')        switchQueueTab('history');
            if (action === 'reject-confirm')  switchQueueTab('history');
            await renderOrders(false);
        } else {
            alert(res?.message || 'Action failed. Please try again.');
        }

    } catch (err) {
        console.error('handleOrderAction error:', err);
        alert('Network error. Please check your connection.');
    }
}

function promptAccept(orderId) {
    const priceStr = prompt('Enter the total price for the patient (EGP):', '');
    if (priceStr === null) return; // cancelled
    const price = parseFloat(priceStr);
    if (isNaN(price) || price < 0) {
        alert('Please enter a valid price (e.g. 150 or 75.50)');
        return;
    }
    handleOrderAction(orderId, 'accept', '', price);
}

function promptReject(orderId) {
    const reason = prompt('Enter rejection reason for the patient:', 'Items out of stock');
    if (reason !== null && reason.trim()) {
        handleOrderAction(orderId, 'reject-confirm', reason.trim());
    }
}

function switchQueueTab(tab) {
    document.querySelectorAll('.q-tab').forEach(t  => t.classList.remove('active'));
    document.querySelectorAll('.q-pane').forEach(p => p.classList.remove('active'));
    const activeTab  = Array.from(document.querySelectorAll('.q-tab')).find(t => t.getAttribute('onclick').includes(`'${tab}'`));
    if (activeTab) activeTab.classList.add('active');
    const activePane = document.getElementById(`q-${tab}-content`);
    if (activePane) activePane.classList.add('active');
}

// ─────────────────────────────────────────────────────────────
// Prescriptions
// ─────────────────────────────────────────────────────────────

// Session-level cache for approved/rejected during current session
window._rxSessionHistory = window._rxSessionHistory || [];

async function renderPrescriptions() {
    const tableNew        = document.getElementById('table-new-rxs');
    const tableProcessing = document.getElementById('table-processing-rxs');
    const tableHistory    = document.getElementById('table-history-rxs');
    if (!tableNew) return;

    tableNew.innerHTML        = '<tr><td colspan="5" style="text-align:center">Loading...</td></tr>';
    tableProcessing.innerHTML = '<tr><td colspan="3" style="text-align:center">—</td></tr>';
    tableHistory.innerHTML    = '<tr><td colspan="4" style="text-align:center">Loading...</td></tr>';

    try {
        const res = await apiGetPendingPrescriptions();

        if (!res.success) {
            tableNew.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#EF4444">${res.message || 'Failed to load'}</td></tr>`;
            return;
        }

        const pending = res.data.items || [];

        // Tab 1 — Incoming (Pending)
        tableNew.innerHTML = pending.map(rx => `
            <tr>
                <td>#${rx.id.slice(0,8)}</td>
                <td>${rx.patientName}</td>
                <td>${rx.doctorName || '—'}</td>
                <td>${(rx.imageUrls && rx.imageUrls[0])
                    ? `<a href="${rx.imageUrls[0]}" target="_blank" class="rx-view-btn"><i class='bx bx-image'></i> View RX</a>`
                    : '—'}</td>
                <td class="table-actions">
                    <button class="action-btn approve" onclick="approveRx('${rx.id}','${rx.patientName}')">Approve</button>
                    <button class="action-btn reject"  onclick="promptRxReject('${rx.id}','${rx.patientName}')">Reject</button>
                </td>
            </tr>
        `).join('') || '<tr><td colspan="5" style="text-align:center">No pending prescriptions</td></tr>';

        // Tab 2 — Approved this session
        const approved = window._rxSessionHistory.filter(r => r.status === 'Approved');
        tableProcessing.innerHTML = approved.map(rx => `
            <tr>
                <td>#${rx.id.slice(0,8)}</td>
                <td>${rx.patientName}</td>
                <td><span class="status-badge success">Approved</span></td>
            </tr>
        `).join('') || '<tr><td colspan="3" style="text-align:center">No approved prescriptions this session</td></tr>';

        // Tab 3 — History this session (Approved + Rejected)
        const histRxs = window._rxSessionHistory;
        tableHistory.innerHTML = histRxs.map(rx => `
            <tr>
                <td>#${rx.id.slice(0,8)}</td>
                <td>${rx.patientName}</td>
                <td><span class="status-badge ${getStatusClass(rx.status)}">${rx.status}</span></td>
                <td>${formatTime(rx.processedAt)}</td>
            </tr>
        `).join('') || '<tr><td colspan="4" style="text-align:center">No history this session</td></tr>';

        // Unread count badge on prescriptions
        const elRx = document.getElementById('stat-pending-prescriptions');
        if (elRx) elRx.textContent = pending.length;

    } catch (err) {
        console.error('renderPrescriptions error:', err);
        tableNew.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#EF4444">Network error.</td></tr>';
    }
}

async function approveRx(rxId, patientName) {
    const notes = prompt('Add approval notes (optional):', '') ?? '';
    const res   = await apiApprovePrescription(rxId, notes);

    if (res.success) {
        window._rxSessionHistory.unshift({ id: rxId, patientName, status: 'Approved', processedAt: new Date().toISOString() });
        switchRxQueueTab('history');
        await renderPrescriptions();
    } else {
        alert(res.message || 'Approval failed.');
    }
}

async function promptRxReject(rxId, patientName) {
    const reason = prompt('Enter rejection reason (required):', 'Prescription image is not legible');
    if (!reason || !reason.trim()) return;

    const res = await apiRejectPrescription(rxId, reason.trim());

    if (res.success) {
        window._rxSessionHistory.unshift({ id: rxId, patientName, status: 'Rejected', processedAt: new Date().toISOString() });
        switchRxQueueTab('history');
        await renderPrescriptions();
    } else {
        alert(res.message || 'Rejection failed.');
    }
}

function switchRxQueueTab(tab) {
    document.querySelectorAll('.rx-q-tab').forEach(t  => t.classList.remove('active'));
    document.querySelectorAll('.rx-q-pane').forEach(p => p.classList.remove('active'));
    const activeTab  = Array.from(document.querySelectorAll('.rx-q-tab')).find(t => t.getAttribute('onclick').includes(`'${tab}'`));
    if (activeTab) activeTab.classList.add('active');
    const activePane = document.getElementById(`rx-q-${tab}-content`);
    if (activePane) activePane.classList.add('active');
}

// ─────────────────────────────────────────────────────────────
// Branches
// ─────────────────────────────────────────────────────────────

async function renderBranches() {
    const container = document.getElementById('branches-container');
    if (!container) return;

    container.innerHTML = '<p style="text-align:center;grid-column:1/-1">Loading branches...</p>';

    const pid = _pharmacyId || JSON.parse(localStorage.getItem('user_info') || '{}').pharmacyId;
    if (!pid) {
        container.innerHTML = '<p style="text-align:center;grid-column:1/-1;color:#EF4444">Pharmacy ID not found. Please re-login.</p>';
        return;
    }

    try {
        const res = await apiGetPharmacyBranches(pid);

        if (!res.success) {
            container.innerHTML = `<p style="text-align:center;grid-column:1/-1;color:#EF4444">${res.message || 'Failed to load branches'}</p>`;
            return;
        }

        const branches = res.data.items || [];

        if (!branches.length) {
            container.innerHTML = '<p style="text-align:center;grid-column:1/-1">No branches found. Add your first branch!</p>';
            return;
        }

        container.innerHTML = branches.map(br => `
            <div class="card branch-card">
                <div class="branch-card-header">
                    <h3>${br.name}</h3>
                    <span class="status-badge ${br.isActive ? 'success' : 'danger'}">
                        ${br.isActive ? 'Active' : 'Inactive'}
                    </span>
                </div>
                <div class="branch-card-body">
                    <p><i class='bx bx-map'></i> ${br.address || '—'}</p>
                    <p><i class='bx bx-building'></i> ${br.city || '—'}</p>
                </div>
                <div class="branch-card-actions">
                    <button
                        class="action-btn ${br.isActive ? 'reject' : 'approve'}"
                        onclick="toggleBranchStatus('${br.id}', ${!br.isActive})">
                        ${br.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                </div>
            </div>
        `).join('');

    } catch (err) {
        console.error('renderBranches error:', err);
        container.innerHTML = '<p style="text-align:center;grid-column:1/-1;color:#EF4444">Network error.</p>';
    }
}

async function toggleBranchStatus(branchId, isActive) {
    const action = isActive ? 'activate' : 'deactivate';
    if (!confirm(`Are you sure you want to ${action} this branch?`)) return;

    const res = await apiSetBranchStatus(branchId, isActive);
    if (res.success) {
        await renderBranches();
    } else {
        alert(res.message || 'Failed to update branch status.');
    }
}

function openAddBranchModal() {
    document.getElementById('branch-modal').style.display = 'block';
}

function closeAddBranchModal() {
    document.getElementById('branch-modal').style.display = 'none';
    document.getElementById('add-branch-form').reset();
}

async function handleAuthAddBranch(event) {
    event.preventDefault();

    const name    = document.getElementById('branch-name').value;
    const city    = document.getElementById('branch-city').value;
    const phone   = document.getElementById('branch-phone').value;
    const address = document.getElementById('branch-address').value;
    const lat     = document.getElementById('branch-lat').value;
    const lng     = document.getElementById('branch-lng').value;

    const pid = _pharmacyId || JSON.parse(localStorage.getItem('user_info') || '{}').pharmacyId;
    if (!pid) { alert('Pharmacy ID not found. Please re-login.'); return; }

    const btn = event.target.querySelector('button[type="submit"]');
    btn.disabled = true; btn.textContent = 'Creating...';

    const branchData = { name, city, address };
    if (phone) branchData.phone     = phone;
    if (lat)   branchData.latitude  = parseFloat(lat);
    if (lng)   branchData.longitude = parseFloat(lng);

    const result = await apiAddBranch(pid, branchData);

    btn.disabled = false; btn.textContent = 'Create Branch';

    if (result.success) {
        await renderBranches();
        closeAddBranchModal();
        alert('Branch added successfully!');
    } else {
        alert('Failed to add branch: ' + (result.message || result.error || 'Unknown error'));
    }
}

// ─────────────────────────────────────────────────────────────
// Notifications
// ─────────────────────────────────────────────────────────────

async function renderNotifications() {
    const container = document.getElementById('notification-container');
    if (!container) return;

    container.innerHTML = '<p style="text-align:center">Loading notifications...</p>';

    try {
        const res = await apiGetNotifications(1, 30);

        if (!res.success) {
            container.innerHTML = `<p style="text-align:center;color:#EF4444">${res.message || 'Failed to load'}</p>`;
            return;
        }

        const notifs = res.data.items || [];

        if (!notifs.length) {
            container.innerHTML = '<p style="text-align:center">No notifications yet.</p>';
            return;
        }

        container.innerHTML = notifs.map(n => `
            <div
                class="notification-item ${n.isRead ? '' : 'unread'}"
                onclick="markNotifRead('${n.id}', this)"
                style="cursor:pointer; ${!n.isRead ? 'border-left:3px solid #0057d1; padding-left:12px;' : ''}">
                <div class="notification-info">
                    <h4>${n.title}</h4>
                    <p>${n.body}</p>
                    <small>${formatTime(n.createdAt)}</small>
                </div>
            </div>
        `).join('');

        // Reset badge after viewing
        updateNotificationBadge();

    } catch (err) {
        console.error('renderNotifications error:', err);
        container.innerHTML = '<p style="text-align:center;color:#EF4444">Network error.</p>';
    }
}

async function markNotifRead(id, el) {
    await apiMarkNotificationRead(id);
    if (el) {
        el.style.borderLeft = 'none';
        el.style.paddingLeft = '';
        el.classList.remove('unread');
    }
    updateNotificationBadge();
}

// ─────────────────────────────────────────────────────────────
// Reports / Analytics
// ─────────────────────────────────────────────────────────────

async function renderReports() {
    const userInfo   = JSON.parse(localStorage.getItem('user_info') || '{}');
    const pharmacyId = _pharmacyId || userInfo.pharmacyId;

    const BASE    = API_BASE;
    const token   = localStorage.getItem('firebase_token');
    const headers = { 'Authorization': `Bearer ${token}` };

    ['sourceChart', 'trendChart', 'topMedsChart'].forEach(k => {
        if (window[k]) { window[k].destroy(); window[k] = null; }
    });

    if (!pharmacyId) { console.warn('renderReports: pharmacyId not found'); return; }

    try {
        const [srcRes, trendRes, topRes] = await Promise.all([
            safeJson(await fetch(`${BASE}/pharmacy/dashboard/order-source?pharmacyId=${pharmacyId}`, { headers })),
            safeJson(await fetch(`${BASE}/pharmacy/dashboard/fulfillment-trend?pharmacyId=${pharmacyId}&months=3`, { headers })),
            safeJson(await fetch(`${BASE}/pharmacy/dashboard/top-medications?pharmacyId=${pharmacyId}&limit=5`, { headers }))
        ]);

        const ctxSource = document.getElementById('orderSourceChart');
        if (ctxSource && srcRes.success) {
            window.sourceChart = new Chart(ctxSource.getContext('2d'), {
                type: 'pie',
                data: {
                    labels: ['With Prescription (Rx)', 'Direct Request'],
                    datasets: [{ data: [srcRes.data.withPrescription, srcRes.data.withoutPrescription], backgroundColor: ['#0057d1', '#10B981'] }]
                },
                options: { responsive: true, maintainAspectRatio: false }
            });
        }

        const ctxTrend = document.getElementById('fulfillmentTrendChart');
        if (ctxTrend && trendRes.success) {
            window.trendChart = new Chart(ctxTrend.getContext('2d'), {
                type: 'bar',
                data: {
                    labels: trendRes.data.map(p => `${p.month}/${p.year}`),
                    datasets: [{ label: 'Fulfilled Orders', data: trendRes.data.map(p => p.completedCount), backgroundColor: '#0057d1' }]
                },
                options: { responsive: true, maintainAspectRatio: false }
            });
        }

        const ctxTop = document.getElementById('inventoryGapsChart');
        if (ctxTop && topRes.success) {
            window.topMedsChart = new Chart(ctxTop.getContext('2d'), {
                type: 'bar',
                data: {
                    labels: topRes.data.map(m => m.name),
                    datasets: [{ label: 'Requests', data: topRes.data.map(m => m.orderItemCount), backgroundColor: '#10B981' }]
                },
                options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false }
            });
            const h = ctxTop.closest('.card')?.querySelector('h3');
            if (h) h.textContent = 'Top Requested Medications';
        }

        const summaryRes = await safeJson(await fetch(`${BASE}/pharmacy/dashboard/summary?pharmacyId=${pharmacyId}`, { headers }));
        if (summaryRes.success) {
            const d = summaryRes.data;
            const totalEl = document.querySelector('.summary-item:nth-child(1) h2');
            const rateEl  = document.querySelector('.summary-item:nth-child(2) h2');
            const rejEl   = document.querySelector('.summary-item:nth-child(3) h2');
            if (totalEl) totalEl.textContent = d.totalRequests.toLocaleString();
            if (rateEl)  rateEl.textContent  = d.successRate.toFixed(1) + '%';
            if (rejEl)   rejEl.textContent   = d.rejectedOrdersCount + ' Orders';
        }

        const notesRes = await safeJson(await fetch(`${BASE}/pharmacy/dashboard/rejection-notes?pharmacyId=${pharmacyId}&limit=10`, { headers }));
        if (notesRes.success) {
            const list = document.getElementById('rejection-notes-list');
            if (list) {
                list.innerHTML = notesRes.data.map(n => {
                    const date = new Date(n.rejectedAt).toLocaleDateString('en-EG');
                    return `<li><span class="note-date">${date}</span><p>"${n.reason}"</p></li>`;
                }).join('') || '<li><p>No rejection notes yet.</p></li>';
            }
        }

    } catch (err) {
        console.error('renderReports error:', err);
    }
}

// ─────────────────────────────────────────────────────────────
// Settings
// ─────────────────────────────────────────────────────────────

function initSettings() {
    const userInfo = JSON.parse(localStorage.getItem('user_info') || '{}');
    const nameEl   = document.getElementById('set-pharmacy-name');
    if (nameEl && userInfo.name) nameEl.value = userInfo.name;

    const checkbox = document.getElementById('pharmacy-status-check');
    if (checkbox && typeof userInfo.isOpen === 'boolean') {
        checkbox.checked = userInfo.isOpen;
        updatePharmacyStatus();
    }
}

function updatePharmacyStatus() {
    const checkbox   = document.getElementById('pharmacy-status-check');
    const statusText = document.getElementById('status-text');
    if (!checkbox || !statusText) return;
    if (checkbox.checked) {
        statusText.textContent = 'Your Pharmacy is currently OPEN';
        statusText.style.color = '#10B981';
    } else {
        statusText.textContent = 'Your Pharmacy is currently CLOSED';
        statusText.style.color = '#EF4444';
    }
}

function previewPharmacyLogo(event) {
    const input = event.target;
    if (input.files && input.files[0]) {
        const file = input.files[0];
        window.pendingLogoFile = file;
        const reader = new FileReader();
        reader.onload = e => {
            document.getElementById('profile-logo-preview').src = e.target.result;
            window.pendingLogoData = e.target.result;
        };
        reader.readAsDataURL(file);
    }
}

async function savePharmacyProfile(event) {
    event.preventDefault();

    const name    = document.getElementById('set-pharmacy-name').value;
    const gov     = document.getElementById('set-pharmacy-gov').value;
    const address = document.getElementById('set-pharmacy-address').value;
    const hours   = document.getElementById('set-pharmacy-hours').value;
    const isOpen  = document.getElementById('pharmacy-status-check').checked;
    const btn     = event.target.querySelector('button[type="submit"]');

    btn.disabled = true; btn.textContent = 'Saving...';

    try {
        let logoUrl = '';

        if (window.pendingLogoFile) {
            const uploadResult = await apiUploadLogo(window.pendingLogoFile);
            if (!uploadResult.success) {
                alert('Logo upload failed: ' + (uploadResult.message || 'Please try again.'));
                return;
            }
            logoUrl = uploadResult.data?.url || uploadResult.data?.fileUrl || '';
            window.pendingLogoFile = null;
        }

        const result = await apiUpdatePharmacyProfile({ name, governorate: gov, address, workingHoursDescription: hours, isOpen, logoUrl });

        if (result.success) {
            const headerName = document.querySelector('.profile-info .name');
            if (headerName) headerName.textContent = name;

            const headerImg = document.querySelector('.profile img');
            if (headerImg) {
                headerImg.src = logoUrl || window.pendingLogoData ||
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0D8ABC&color=fff`;
            }

            const userInfo = JSON.parse(localStorage.getItem('user_info') || '{}');
            localStorage.setItem('user_info', JSON.stringify({ ...userInfo, name, isOpen }));

            alert('Pharmacy profile updated successfully!');
        } else {
            alert('Save failed: ' + (result.message || 'Unknown error'));
        }
    } finally {
        btn.disabled = false; btn.textContent = 'Save Changes';
    }
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function getStatusClass(status) {
    const s = (status || '').toLowerCase();
    if (['completed', 'approved'].includes(s)) return 'success';
    if (['pending', 'accepted'].includes(s))   return 'warning';
    if (['rejected', 'cancelled'].includes(s)) return 'danger';
    return 'primary';
}

function getPaymentClass(status) {
    const s = (status || '').toLowerCase();
    if (s === 'paid')      return 'success';
    if (s === 'pending')   return 'warning';
    if (s === 'cancelled') return 'danger';
    return 'primary';
}

function formatTime(dateStr) {
    if (!dateStr) return '—';
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1)   return 'Just now';
    if (mins < 60)  return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)   return `${hrs}h ago`;
    return new Date(dateStr).toLocaleDateString('en-EG');
}

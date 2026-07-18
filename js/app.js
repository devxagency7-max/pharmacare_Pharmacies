/**
 * app.js - Pharmacy Dashboard Logic
 */

// Sections that require PharmacyOwner role.
// Pharmacist / PharmacyIntern can only access: prescriptions, notifications.
const OWNER_ONLY_SECTIONS = ['dashboard', 'orders', 'reports', 'branches', 'settings'];

document.addEventListener('DOMContentLoaded', () => {
    const sidebar      = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const navItems     = document.querySelectorAll('.nav-item');
    const sections     = document.querySelectorAll('.section-content');

    // --- Role-based navigation ---
    const userInfo = JSON.parse(localStorage.getItem('user_info') || '{}');
    const roles    = userInfo.roles || [];
    const isOwner  = roles.includes('PharmacyOwner');

    if (!isOwner) {
        // Hide nav items the pharmacist cannot access
        navItems.forEach(item => {
            const sec = item.getAttribute('data-section');
            if (OWNER_ONLY_SECTIONS.includes(sec)) {
                item.closest('li').style.display = 'none';
            }
        });
    }

    // Sidebar Toggle
    sidebarToggle.addEventListener('click', () => {
        sidebar.classList.toggle('close');
    });

    // Simple Routing Logic
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const sectionName = item.getAttribute('data-section');

            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');

            sections.forEach(section => {
                section.classList.remove('active');
                if (section.id === sectionName) section.classList.add('active');
            });

            initSection(sectionName);
        });
    });

    function initSection(sectionName) {
        if (sectionName === 'dashboard')     initDashboard();
        if (sectionName === 'orders')        renderOrders();
        if (sectionName === 'prescriptions') renderPrescriptions();
        if (sectionName === 'branches')      renderBranches();
        if (sectionName === 'notifications') renderNotifications();
        if (sectionName === 'reports')       renderReports();
        if (sectionName === 'settings')      initSettings();
    }

    // Default landing: owner → dashboard, pharmacist → prescriptions
    initSection(isOwner ? 'dashboard' : 'prescriptions');

    // Activate the correct nav item visually
    const defaultSection = isOwner ? 'dashboard' : 'prescriptions';
    navItems.forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('data-section') === defaultSection) item.classList.add('active');
    });
    sections.forEach(section => {
        section.classList.remove('active');
        if (section.id === defaultSection) section.classList.add('active');
    });
});

/**
 * Reports / Business Insights
 * Data source: GET /api/v1/pharmacy/dashboard/* (5 endpoints, all need pharmacyId)
 * No inventory module exists in backend — inventory gaps chart removed.
 */
async function renderReports() {
    const userInfo   = JSON.parse(localStorage.getItem('user_info') || '{}');
    const pharmacyId = userInfo.pharmacyId;

    const BASE = 'http://204.168.149.185/api/v1';
    const token = localStorage.getItem('firebase_token');
    const headers = { 'Authorization': `Bearer ${token}` };

    // Destroy old charts
    ['sourceChart', 'trendChart', 'topMedsChart'].forEach(k => {
        if (window[k]) { window[k].destroy(); window[k] = null; }
    });

    if (!pharmacyId) {
        console.warn('renderReports: pharmacyId not found in user_info');
        return;
    }

    try {
        // Fetch all 3 datasets in parallel
        const [srcRes, trendRes, topRes] = await Promise.all([
            fetch(`${BASE}/pharmacy/dashboard/order-source?pharmacyId=${pharmacyId}`, { headers }).then(r => r.json()),
            fetch(`${BASE}/pharmacy/dashboard/fulfillment-trend?pharmacyId=${pharmacyId}&months=3`, { headers }).then(r => r.json()),
            fetch(`${BASE}/pharmacy/dashboard/top-medications?pharmacyId=${pharmacyId}&limit=5`, { headers }).then(r => r.json())
        ]);

        // Chart 1: Order Source — Pie (with prescription vs without)
        const ctxSource = document.getElementById('orderSourceChart');
        if (ctxSource && srcRes.success) {
            window.sourceChart = new Chart(ctxSource.getContext('2d'), {
                type: 'pie',
                data: {
                    labels: ['With Prescription (Rx)', 'Direct Request'],
                    datasets: [{
                        data: [srcRes.data.withPrescription, srcRes.data.withoutPrescription],
                        backgroundColor: ['#0057d1', '#10B981']
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false }
            });
        }

        // Chart 2: Fulfillment Trend — Bar (completed per month)
        const ctxTrend = document.getElementById('fulfillmentTrendChart');
        if (ctxTrend && trendRes.success) {
            const labels = trendRes.data.map(p => `${p.month}/${p.year}`);
            const counts = trendRes.data.map(p => p.completedCount);
            window.trendChart = new Chart(ctxTrend.getContext('2d'), {
                type: 'bar',
                data: {
                    labels,
                    datasets: [{
                        label: 'Fulfilled Orders',
                        data: counts,
                        backgroundColor: '#0057d1'
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false }
            });
        }

        // Chart 3: Top Medications — Horizontal Bar
        const ctxTop = document.getElementById('inventoryGapsChart'); // reuse canvas
        if (ctxTop && topRes.success) {
            const medNames  = topRes.data.map(m => m.name);
            const medCounts = topRes.data.map(m => m.orderItemCount);
            window.topMedsChart = new Chart(ctxTop.getContext('2d'), {
                type: 'bar',
                data: {
                    labels: medNames,
                    datasets: [{
                        label: 'Order Line Items',
                        data: medCounts,
                        backgroundColor: '#10B981'
                    }]
                },
                options: {
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: false
                }
            });
            // Update the card header to reflect the new chart
            const gapsHeader = ctxTop.closest('.card')?.querySelector('h3');
            if (gapsHeader) gapsHeader.textContent = 'Top Requested Medications';
        }

        // Summary stats
        const summaryRes = await fetch(
            `${BASE}/pharmacy/dashboard/summary?pharmacyId=${pharmacyId}`, { headers }
        ).then(r => r.json());

        if (summaryRes.success) {
            const el = id => document.querySelector(`[data-report="${id}"]`);
            const totalEl = document.querySelector('.summary-item:nth-child(1) h2');
            const rateEl  = document.querySelector('.summary-item:nth-child(2) h2');
            const rejEl   = document.querySelector('.summary-item:nth-child(3) h2');
            if (totalEl) totalEl.textContent = summaryRes.data.totalRequests.toLocaleString();
            if (rateEl)  rateEl.textContent  = summaryRes.data.successRate.toFixed(1) + '%';
            if (rejEl)   rejEl.textContent   = summaryRes.data.rejectedOrdersCount + ' Orders';
        }

        // Rejection notes list
        const notesRes = await fetch(
            `${BASE}/pharmacy/dashboard/rejection-notes?pharmacyId=${pharmacyId}&limit=10`, { headers }
        ).then(r => r.json());

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

/**
 * Initialize Dashboard Charts and Stats
 */
function initDashboard() {
    const ctxTableTrend = document.getElementById('ordersTrendChart');
    const ctxTableSelling = document.getElementById('topSellingChart');

    if (!ctxTableTrend || !ctxTableSelling) return;

    const ctxTrend = ctxTableTrend.getContext('2d');
    const ctxSelling = ctxTableSelling.getContext('2d');

    // Clean up existing charts if any
    if (window.trendChart) window.trendChart.destroy();
    if (window.sellingChart) window.sellingChart.destroy();

    window.trendChart = new Chart(ctxTrend, {
        type: 'line',
        data: {
            labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
            datasets: [{
                label: 'Orders',
                data: [12, 19, 3, 5, 2, 3, 15],
                borderColor: '#0057d1',
                backgroundColor: 'rgba(0, 87, 209, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });

    window.sellingChart = new Chart(ctxSelling, {
        type: 'doughnut',
        data: {
            labels: ['Paracetamol', 'Ibuprofen', 'Amoxicillin'],
            datasets: [{
                data: [300, 50, 100],
                backgroundColor: ['#0057d1', '#10B981', '#F59E0B']
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

/**
 * Update Dashboard Stats dynamically based on mock data
 */
function updateDashboardStats() {
    if (!window.mockOrders) return;

    const pending = window.mockOrders.filter(o => o.orderStatus === 'Pending').length;
    const processing = window.mockOrders.filter(o => o.orderStatus === 'Accepted').length;
    const completed = window.mockOrders.filter(o => o.orderStatus === 'Completed').length;
    const rejected = window.mockOrders.filter(o => ['Rejected', 'Cancelled'].includes(o.orderStatus)).length;

    document.getElementById('stat-pending-orders').textContent = pending;
    document.getElementById('stat-processing-orders').textContent = processing;
    document.getElementById('stat-confirmed-orders').textContent = completed;
    document.getElementById('stat-rejected-orders').textContent = rejected;
}

/**
 * Switch Queue Tabs
 */
function switchQueueTab(tab) {
    const tabs = document.querySelectorAll('.q-tab');
    const panes = document.querySelectorAll('.q-pane');

    tabs.forEach(t => t.classList.remove('active'));
    panes.forEach(p => p.classList.remove('active'));

    const activeTab = Array.from(tabs).find(t => t.getAttribute('onclick').includes(tab));
    if (activeTab) activeTab.classList.add('active');

    const activePane = document.getElementById(`q-${tab}-content`);
    if (activePane) activePane.classList.add('active');
}

/**
 * Render Orders Queue
 */
function renderOrders() {
    // Initialize mock data if not exists
    if (!window.mockOrders) {
        window.mockOrders = [
            { id: 'ORD-1001', customerName: 'Ahmed Ali', phone: '01012345678', items: ['Panadol 500mg', 'Vitamin C'], orderStatus: 'Pending', createdAt: '10:00 AM' },
            { id: 'ORD-1002', customerName: 'Sara Mohamed', phone: '01198765432', items: ['Ibuprofen 400mg'], orderStatus: 'Accepted', createdAt: '09:30 AM' },
            { id: 'ORD-1003', customerName: 'Youssef Hassan', phone: '01233445566', items: ['Amoxicillin 500mg'], orderStatus: 'Completed', createdAt: '08:45 AM' },
            { id: 'ORD-1004', customerName: 'Mona Ibrahim', phone: '01511223344', items: ['Antinal'], orderStatus: 'Rejected', createdAt: 'Yesterday' }
        ];
    }

    const tableNew = document.getElementById('table-new-orders');
    const tableProcessing = document.getElementById('table-processing-orders');
    const tableHistory = document.getElementById('table-history-orders');

    if (!tableNew) return;

    // 1. Render NEW Orders (Pending)
    const newOrders = window.mockOrders.filter(o => o.orderStatus === 'Pending');
    tableNew.innerHTML = newOrders.map(o => `
        <tr>
            <td>${o.id}</td>
            <td>${o.customerName}</td>
            <td>${o.items.join(', ')}</td>
            <td>${o.createdAt}</td>
            <td class="table-actions">
                <button class="action-btn approve" onclick="handleOrderAction('${o.id}', 'accept')">Accept</button>
                <button class="action-btn reject" onclick="promptReject('${o.id}')">Reject</button>
            </td>
        </tr>
    `).join('') || '<tr><td colspan="5" style="text-align:center">No new orders</td></tr>';

    // 2. Render PROCESSING Orders (Accepted)
    const procOrders = window.mockOrders.filter(o => o.orderStatus === 'Accepted');
    tableProcessing.innerHTML = procOrders.map(o => `
        <tr>
            <td>${o.id}</td>
            <td>${o.customerName}</td>
            <td><a href="tel:${o.phone}" class="phone-btn"><i class='bx bx-phone'></i> ${o.phone}</a></td>
            <td class="table-actions">
                <button class="action-btn approve" onclick="handleOrderAction('${o.id}', 'complete')">Complete (Done)</button>
                <button class="action-btn reject" onclick="handleOrderAction('${o.id}', 'cancel')">Cancel</button>
            </td>
        </tr>
    `).join('') || '<tr><td colspan="4" style="text-align:center">No orders in process</td></tr>';

    // 3. Render HISTORY (Completed, Rejected, Cancelled)
    const histOrders = window.mockOrders.filter(o => ['Completed', 'Rejected', 'Cancelled'].includes(o.orderStatus));
    tableHistory.innerHTML = histOrders.map(o => `
        <tr>
            <td>${o.id}</td>
            <td>${o.customerName}</td>
            <td><span class="status-badge ${getStatusClass(o.orderStatus)}">${o.orderStatus}</span></td>
            <td>${o.createdAt}</td>
        </tr>
    `).join('') || '<tr><td colspan="4" style="text-align:center">History is empty</td></tr>';

    updateDashboardStats();
}

/**
 * Handle Order Actions (Accept, Complete, Cancel)
 */
async function handleOrderAction(orderId, action) {
    console.log(`Action: ${action} for Order: ${orderId}`);
    
    // In a real app, we would call the API:
    // let response;
    // if (action === 'accept') response = await apiRespondToOrder(orderId, 'accept');
    // if (action === 'reject') response = await apiRespondToOrder(orderId, 'reject');
    // if (action === 'complete') response = await apiCompleteOrder(orderId);

    // For now, we update mock data:
    const order = window.mockOrders.find(o => o.id === orderId);
    if (order) {
        if (action === 'accept') {
            order.orderStatus = 'Accepted';
            switchQueueTab('processing');
        } else if (action === 'complete') {
            order.orderStatus = 'Completed';
            switchQueueTab('history');
        } else if (action === 'cancel') {
            order.orderStatus = 'Cancelled';
            switchQueueTab('history');
        } else if (action === 'reject-confirm') {
            order.orderStatus = 'Rejected';
            switchQueueTab('history');
        }
        renderOrders();
    }
}

// updateOrderStatus was replaced by handleOrderAction

function promptReject(orderId) {
    const reason = prompt("Enter rejection reason for the patient:", "Items out of stock");
    if (reason !== null) {
        handleOrderAction(orderId, 'reject-confirm');
    }
}

/**
 * Switch RX Queue Tabs
 */
function switchRxQueueTab(tab) {
    const tabs = document.querySelectorAll('.rx-q-tab');
    const panes = document.querySelectorAll('.rx-q-pane');

    tabs.forEach(t => t.classList.remove('active'));
    panes.forEach(p => p.classList.remove('active'));

    const activeTab = Array.from(tabs).find(t => t.getAttribute('onclick').includes(tab));
    if (activeTab) activeTab.classList.add('active');

    const activePane = document.getElementById(`rx-q-${tab}-content`);
    if (activePane) activePane.classList.add('active');
}

/**
 * Render Prescriptions Queue
 */
function renderPrescriptions() {
    // Initialize mock data if not exists
    if (!window.mockRxs) {
        window.mockRxs = [
            { id: 'RX-5001', patientName: 'Ahmed Ali', phone: '01012345678', doctorName: 'Dr. Omar', status: 'Pending', createdAt: '10:00 AM' },
            { id: 'RX-5002', patientName: 'Mona Hassan', phone: '01198765432', doctorName: 'Dr. Khaled', status: 'Accepted', createdAt: '09:30 AM' },
            { id: 'RX-5003', patientName: 'Youssef Ali', phone: '01233445566', doctorName: 'Dr. Ahmed', status: 'Confirmed', createdAt: '08:45 AM' }
        ];
    }

    const tableNew = document.getElementById('table-new-rxs');
    const tableProcessing = document.getElementById('table-processing-rxs');
    const tableHistory = document.getElementById('table-history-rxs');

    if (!tableNew) return;

    // 1. Render NEW Rxs
    const newRxs = window.mockRxs.filter(r => r.status === 'Pending');
    tableNew.innerHTML = newRxs.map(r => `
        <tr>
            <td>${r.id}</td>
            <td>${r.patientName}</td>
            <td>${r.doctorName}</td>
            <td><a href="#" class="rx-view-btn" onclick="viewPrescriptionImage('${r.id}')"><i class='bx bx-image'></i> View RX</a></td>
            <td class="table-actions">
                <button class="action-btn approve" onclick="updateRxStatus('${r.id}', 'Accepted')">Accept</button>
                <button class="action-btn reject" onclick="promptRxReject('${r.id}')">Reject</button>
            </td>
        </tr>
    `).join('') || '<tr><td colspan="5" style="text-align:center">No new prescriptions</td></tr>';

    // 2. Render PROCESSING Rxs
    const procRxs = window.mockRxs.filter(r => r.status === 'Accepted');
    tableProcessing.innerHTML = procRxs.map(r => `
        <tr>
            <td>${r.id}</td>
            <td>${r.patientName}</td>
            <td><a href="tel:${r.phone}" class="phone-btn"><i class='bx bx-phone'></i> ${r.phone}</a></td>
            <td class="table-actions">
                <button class="action-btn approve" onclick="updateRxStatus('${r.id}', 'Confirmed')">Confirm (Done)</button>
                <button class="action-btn reject" onclick="updateRxStatus('${r.id}', 'Cancelled')">Cancel</button>
            </td>
        </tr>
    `).join('') || '<tr><td colspan="4" style="text-align:center">No prescriptions in process</td></tr>';

    // 3. Render HISTORY Rxs
    const histRxs = window.mockRxs.filter(r => ['Confirmed', 'Rejected', 'Cancelled'].includes(r.status));
    tableHistory.innerHTML = histRxs.map(r => `
        <tr>
            <td>${r.id}</td>
            <td>${r.patientName}</td>
            <td><span class="status-badge ${getStatusClass(r.status)}">${r.status}</span></td>
            <td>${r.createdAt}</td>
        </tr>
    `).join('') || '<tr><td colspan="4" style="text-align:center">History is empty</td></tr>';

    // Update RX count in stats
    const elRx = document.getElementById('stat-pending-prescriptions');
    if (elRx) elRx.textContent = newRxs.length;
}

function updateRxStatus(rxId, newStatus) {
    const rx = window.mockRxs.find(r => r.id === rxId);
    if (rx) {
        rx.status = newStatus;
        renderPrescriptions();

        // Auto-switch tab for better UX
        if (newStatus === 'Accepted') switchRxQueueTab('processing');
        if (['Confirmed', 'Cancelled', 'Rejected'].includes(newStatus)) switchRxQueueTab('history');
    }
}

function promptRxReject(rxId) {
    const reason = prompt("Enter rejection reason for this prescription:", "Incomplete data");
    if (reason !== null) {
        updateRxStatus(rxId, 'Rejected');
    }
}

function viewPrescriptionImage(rxId) {
    alert('Viewing image for ' + rxId + '\n(Here we would show the prescription photo)');
}

/**
 * Render Notifications
 */
function renderNotifications() {
    const container = document.getElementById('notification-container');
    if (!container) return;

    // Sample notifications matching API
    const mockNotifications = [
        { title: 'New Order', message: 'Ahmed Ali placed a prescription order', time: '10 mins ago' },
        { title: 'Order Confirmed', message: 'Sara Mohamed confirmed the price', time: '1 hour ago' }
    ];

    container.innerHTML = mockNotifications.map(n => `
        <div class="notification-item">
            <div class="notification-info">
                <h4>${n.title}</h4>
                <p>${n.message}</p>
                <small>${n.time}</small>
            </div>
        </div>
    `).join('');
}

/**
 * Helper to get CSS class for status
 */
function getStatusClass(status) {
    status = status.toLowerCase();
    // API Statuses
    if (['completed', 'approved', 'confirmed'].includes(status)) return 'success';
    if (['pending', 'accepted'].includes(status)) return 'warning';
    if (['rejected', 'cancelled'].includes(status)) return 'danger';
    return 'primary';
}



/**
 * API Wrapper Templates (Coming soon)
 */
async function apiGetDashboardStats() { }
async function apiUpdateOrderStatus(orderId, status) { }

/**
 * Update Pharmacy Status (Open/Closed)
 */
function updatePharmacyStatus() {
    const checkbox = document.getElementById('pharmacy-status-check');
    const statusText = document.getElementById('status-text');
    
    if (checkbox.checked) {
        statusText.textContent = "Your Pharmacy is currently OPEN";
        statusText.style.color = "#10B981";
        console.log('Pharmacy is now OPEN');
    } else {
        statusText.textContent = "Your Pharmacy is currently CLOSED";
        statusText.style.color = "#EF4444";
        console.log('Pharmacy is now CLOSED');
    }
}/**
 * Render Branches Management
 */
function renderBranches() {
    const container = document.getElementById('branches-container');
    if (!container) return;

    // Mock data if not loaded
    if (!window.mockBranches) {
        window.mockBranches = [
            { id: 'BR-01', name: 'Main Branch - Cairo', phone: '01011223344', address: '123 Tahrir St, Cairo', status: 'Active' },
            { id: 'BR-02', name: 'Giza Branch', phone: '01155667788', address: '45 Pyramids Rd, Giza', status: 'Active' }
        ];
    }

    container.innerHTML = window.mockBranches.map(br => `
        <div class="card branch-card">
            <div class="branch-card-header">
                <h3>${br.name}</h3>
                <span class="status-badge success">Active</span>
            </div>
            <div class="branch-card-body">
                <p><i class='bx bx-phone'></i> ${br.phone}</p>
                <p><i class='bx bx-map'></i> ${br.address}</p>
            </div>
            <div class="branch-card-actions">
                <button class="action-btn view" onclick="alert('Viewing branch ${br.id}')">View Details</button>
                <button class="action-btn reject" onclick="alert('Closing branch ${br.id}')">Deactivate</button>
            </div>
        </div>
    `).join('') || '<p style="text-align:center; grid-column: 1/-1;">No branches found. Add your first branch!</p>';
}

/**
 * Branch Modal Logic
 */
function openAddBranchModal() {
    document.getElementById('branch-modal').style.display = 'block';
}

function closeAddBranchModal() {
    document.getElementById('branch-modal').style.display = 'none';
    document.getElementById('add-branch-form').reset();
}

/**
 * Handle Branch Creation
 */
async function handleAuthAddBranch(event) {
    event.preventDefault();

    const name    = document.getElementById('branch-name').value;
    const city    = document.getElementById('branch-city').value;   // Required by backend
    const phone   = document.getElementById('branch-phone').value;
    const address = document.getElementById('branch-address').value;
    const lat     = document.getElementById('branch-lat').value;
    const lng     = document.getElementById('branch-lng').value;

    const userInfo   = JSON.parse(localStorage.getItem('user_info') || '{}');
    const pharmacyId = userInfo.pharmacyId;

    if (!pharmacyId) {
        alert('Cannot add branch: pharmacy ID not found. Please re-login.');
        return;
    }

    const branchData = { name, city, address };
    if (phone)  branchData.phone     = phone;
    if (lat)    branchData.latitude  = parseFloat(lat);
    if (lng)    branchData.longitude = parseFloat(lng);

    const result = await apiAddBranch(pharmacyId, branchData);

    if (result.success) {
        renderBranches();
        closeAddBranchModal();
        alert('Branch added successfully!');
    } else {
        alert('Failed to add branch: ' + (result.message || result.error || 'Unknown error'));
    }
}

/**
 * Preview selected pharmacy logo and store the File for upload
 */
function previewPharmacyLogo(event) {
    const input = event.target;
    if (input.files && input.files[0]) {
        const file = input.files[0];
        window.pendingLogoFile = file;   // The actual File object — sent to /api/files/upload
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('profile-logo-preview').src = e.target.result;
            window.pendingLogoData = e.target.result; // base64 preview only
        };
        reader.readAsDataURL(file);
    }
}

/**
 * Initialize Settings section — populate form from stored user_info
 */
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

/**
 * Save Pharmacy Profile Settings
 * Calls PUT /api/v1/pharmacies/profile (backend resolves pharmacy via token OwnerId).
 * If a new logo was selected, uploads it first via POST /api/files/upload then saves the URL.
 */
async function savePharmacyProfile(event) {
    event.preventDefault();

    const name    = document.getElementById('set-pharmacy-name').value;
    const gov     = document.getElementById('set-pharmacy-gov').value;
    const address = document.getElementById('set-pharmacy-address').value;
    const hours   = document.getElementById('set-pharmacy-hours').value;
    const isOpen  = document.getElementById('pharmacy-status-check').checked;
    const btn     = event.target.querySelector('button[type="submit"]');

    btn.disabled    = true;
    btn.textContent = 'Saving...';

    try {
        let logoUrl = '';

        // Step 1: Upload new logo if the user selected one
        if (window.pendingLogoFile) {
            const uploadResult = await apiUploadLogo(window.pendingLogoFile);
            if (!uploadResult.success) {
                alert('Logo upload failed: ' + (uploadResult.message || 'Please try again.'));
                return;
            }
            logoUrl = uploadResult.data?.url || uploadResult.data?.fileUrl || '';
            window.pendingLogoFile = null;
        }

        // Step 2: Update pharmacy profile
        const profileData = {
            name,
            governorate: gov,
            address,
            workingHoursDescription: hours,
            isOpen,
            logoUrl
        };

        const result = await apiUpdatePharmacyProfile(profileData);

        if (result.success) {
            // Update topbar name
            const headerName = document.querySelector('.profile-info .name');
            if (headerName) headerName.textContent = name;

            // Update topbar avatar
            const headerImg = document.querySelector('.profile img');
            if (headerImg) {
                const src = logoUrl || window.pendingLogoData ||
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0D8ABC&color=fff`;
                headerImg.src = src;
            }

            // Persist updated info locally
            const userInfo = JSON.parse(localStorage.getItem('user_info') || '{}');
            localStorage.setItem('user_info', JSON.stringify({ ...userInfo, name, isOpen }));

            alert('Pharmacy profile updated successfully!');
        } else {
            alert('Save failed: ' + (result.message || 'Unknown error'));
        }
    } finally {
        btn.disabled    = false;
        btn.textContent = 'Save Changes';
    }
}

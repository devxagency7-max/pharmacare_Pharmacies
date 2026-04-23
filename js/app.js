/**
 * app.js - Pharmacy Dashboard Logic
 */

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const navItems = document.querySelectorAll('.nav-item');
    const sections = document.querySelectorAll('.section-content');

    // Sidebar Toggle
    sidebarToggle.addEventListener('click', () => {
        sidebar.classList.toggle('close');
    });

    // Simple Routing Logic
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const sectionName = item.getAttribute('data-section');

            // Update Navbar
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');

            // Update Sections
            sections.forEach(section => {
                section.classList.remove('active');
                if (section.id === sectionName) {
                    section.classList.add('active');
                }
            });

            // Initialize Section Data
            initSection(sectionName);
        });
    });

    // Initialize Section Data Function
    function initSection(sectionName) {
        if (sectionName === 'dashboard') initDashboard();
        if (sectionName === 'orders') renderOrders();
        if (sectionName === 'prescriptions') renderPrescriptions();
        if (sectionName === 'inventory') renderInventory();
        if (sectionName === 'notifications') renderNotifications();
        if (sectionName === 'reports') renderReports();
    }

    // Initialize Dashboard on load
    initSection('dashboard');
});

/**
 * Initialize Reports Charts (Volume & Quantity Based)
 */
function renderReports() {
    const ctxTableSource = document.getElementById('orderSourceChart');
    const ctxTableTrend = document.getElementById('fulfillmentTrendChart');
    const ctxTableGaps = document.getElementById('inventoryGapsChart');

    if (!ctxTableSource || !ctxTableTrend || !ctxTableGaps) return;

    const ctxSource = ctxTableSource.getContext('2d');
    const ctxTrend = ctxTableTrend.getContext('2d');
    const ctxGaps = ctxTableGaps.getContext('2d');

    if (window.sourceChart) window.sourceChart.destroy();
    if (window.trendChart) window.trendChart.destroy();
    if (window.gapsChart) window.gapsChart.destroy();

    // Chart 1: Order Source (Prescription vs Direct Request)
    window.sourceChart = new Chart(ctxSource, {
        type: 'pie',
        data: {
            labels: ['Prescriptions (Rx)', 'Direct Medication Requests'],
            datasets: [{
                data: [450, 798],
                backgroundColor: ['#0057d1', '#10B981']
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });

    // Chart 2: Fulfillment Trend (How many orders fulfilled per month)
    window.trendChart = new Chart(ctxTrend, {
        type: 'bar',
        data: {
            labels: ['Feb', 'Mar', 'Apr'],
            datasets: [{
                label: 'Fulfilled Orders',
                data: [380, 490, 610],
                backgroundColor: '#0057d1'
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });

    // Chart 3: Inventory Gaps (Rejected items count)
    window.gapsChart = new Chart(ctxGaps, {
        type: 'line',
        data: {
            labels: ['Feb', 'Mar', 'Apr'],
            datasets: [{
                label: 'Rejected Items (Units)',
                data: [150, 220, 450],
                borderColor: '#EF4444',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                fill: true,
                tension: 0.3
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
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
    const confirmed = window.mockOrders.filter(o => o.orderStatus === 'Confirmed').length;
    const rejected = window.mockOrders.filter(o => o.orderStatus === 'Rejected' || o.orderStatus === 'Cancelled').length;

    document.getElementById('stat-pending-orders').textContent = pending;
    document.getElementById('stat-processing-orders').textContent = processing;
    document.getElementById('stat-confirmed-orders').textContent = confirmed;
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
            { id: 'ORD-1003', customerName: 'Youssef Hassan', phone: '01233445566', items: ['Amoxicillin 500mg'], orderStatus: 'Confirmed', createdAt: '08:45 AM' },
            { id: 'ORD-1004', customerName: 'Mona Ibrahim', phone: '01511223344', items: ['Antinal'], orderStatus: 'Rejected', createdAt: 'Yesterday' }
        ];
    }

    const tableNew = document.getElementById('table-new-orders');
    const tableProcessing = document.getElementById('table-processing-orders');
    const tableHistory = document.getElementById('table-history-orders');

    if (!tableNew) return;

    // 1. Render NEW Orders
    const newOrders = window.mockOrders.filter(o => o.orderStatus === 'Pending');
    tableNew.innerHTML = newOrders.map(o => `
        <tr>
            <td>${o.id}</td>
            <td>${o.customerName}</td>
            <td>${o.items.join(', ')}</td>
            <td>${o.createdAt}</td>
            <td class="table-actions">
                <button class="action-btn approve" onclick="updateOrderStatus('${o.id}', 'Accepted')">Accept</button>
                <button class="action-btn reject" onclick="promptReject('${o.id}')">Reject</button>
            </td>
        </tr>
    `).join('') || '<tr><td colspan="5" style="text-align:center">No new orders</td></tr>';

    // 2. Render PROCESSING Orders
    const procOrders = window.mockOrders.filter(o => o.orderStatus === 'Accepted');
    tableProcessing.innerHTML = procOrders.map(o => `
        <tr>
            <td>${o.id}</td>
            <td>${o.customerName}</td>
            <td><a href="tel:${o.phone}" class="phone-btn"><i class='bx bx-phone'></i> ${o.phone}</a></td>
            <td class="table-actions">
                <button class="action-btn approve" onclick="updateOrderStatus('${o.id}', 'Confirmed')">Confirm (Done)</button>
                <button class="action-btn reject" onclick="updateOrderStatus('${o.id}', 'Cancelled')">Cancel</button>
            </td>
        </tr>
    `).join('') || '<tr><td colspan="4" style="text-align:center">No orders in process</td></tr>';

    // 3. Render HISTORY
    const histOrders = window.mockOrders.filter(o => ['Confirmed', 'Rejected', 'Cancelled'].includes(o.orderStatus));
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

function updateOrderStatus(orderId, newStatus) {
    const order = window.mockOrders.find(o => o.id === orderId);
    if (order) {
        order.orderStatus = newStatus;
        renderOrders();

        // Auto-switch tab for better UX
        if (newStatus === 'Accepted') switchQueueTab('processing');
        if (['Confirmed', 'Cancelled', 'Rejected'].includes(newStatus)) switchQueueTab('history');
    }
}

function promptReject(orderId) {
    const reason = prompt("Enter rejection reason for the patient:", "Items out of stock");
    if (reason !== null) {
        updateOrderStatus(orderId, 'Rejected');
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
    if (['pending', 'pricingresponded', 'accepted'].includes(status)) return 'warning';
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
}

/**
 * Save Pharmacy Profile Settings
 */
function savePharmacyProfile(event) {
    event.preventDefault();
    
    const name = document.getElementById('set-pharmacy-name').value;
    const gov = document.getElementById('set-pharmacy-gov').value;
    const phone = document.getElementById('set-pharmacy-phone').value;
    const address = document.getElementById('set-pharmacy-address').value;
    const hours = document.getElementById('set-pharmacy-hours').value;
    
    // In a real app, send this to API
    console.log('Saving Profile:', { name, gov, phone, address, hours });
    
    // Update Header Name
    const headerName = document.querySelector('.profile-info .name');
    if (headerName) headerName.textContent = name;
    
    alert('Pharmacy profile updated successfully and will be visible to patients!');
}

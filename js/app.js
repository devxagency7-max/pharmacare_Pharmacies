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
 * Initialize Reports Charts
 */
function renderReports() {
    const ctxTableRev = document.getElementById('revenueChart');
    const ctxTableMonth = document.getElementById('monthlyOrdersChart');

    if (!ctxTableRev || !ctxTableMonth) return;

    const ctxRev = ctxTableRev.getContext('2d');
    const ctxMonth = ctxTableMonth.getContext('2d');

    if (window.revenueChart) window.revenueChart.destroy();
    if (window.monthlyChart) window.monthlyChart.destroy();

    window.revenueChart = new Chart(ctxRev, {
        type: 'bar',
        data: {
            labels: ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5'],
            datasets: [{
                label: 'Revenue',
                data: [500, 700, 450, 800, 600],
                backgroundColor: '#10B981'
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });

    window.monthlyChart = new Chart(ctxMonth, {
        type: 'line',
        data: {
            labels: ['Jan', 'Feb', 'Mar'],
            datasets: [{
                label: 'Monthly Orders',
                data: [1200, 1500, 1800],
                borderColor: '#F59E0B',
                fill: false
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
 * Render Orders Table
 */
function renderOrders() {
    const tableBody = document.getElementById('orders-table-body');
    if (!tableBody) return;

    tableBody.innerHTML = window.mockData.orders.map(order => `
        <tr>
            <td>${order.id}</td>
            <td>${order.patient}</td>
            <td>${order.prescription}</td>
            <td>${order.total}</td>
            <td><span class="status-badge ${getStatusClass(order.status)}">${order.status}</span></td>
            <td>${order.date}</td>
            <td><button class="action-btn view">View</button></td>
        </tr>
    `).join('');
}

/**
 * Render Prescriptions Table
 */
function renderPrescriptions() {
    const tableBody = document.getElementById('prescriptions-table-body');
    if (!tableBody) return;

    tableBody.innerHTML = window.mockData.prescriptions.map(p => `
        <tr>
            <td>${p.id}</td>
            <td>${p.patient}</td>
            <td><img src="${p.image}" alt="p" style="border-radius: 4px;"></td>
            <td><span class="status-badge ${getStatusClass(p.status)}">${p.status}</span></td>
            <td>${p.date}</td>
            <td class="table-actions">
                <button class="action-btn approve">Approve</button>
                <button class="action-btn reject">Reject</button>
            </td>
        </tr>
    `).join('');
}

/**
 * Render Inventory Table
 */
function renderInventory() {
    const tableBody = document.getElementById('inventory-table-body');
    if (!tableBody) return;

    tableBody.innerHTML = window.mockData.inventory.map(item => `
        <tr>
            <td>${item.name}</td>
            <td>${item.stock}</td>
            <td>${item.price}</td>
            <td>${item.expiry}</td>
            <td><span class="status-badge ${getStatusClass(item.status)}">${item.status}</span></td>
            <td><button class="action-btn view">Edit</button></td>
        </tr>
    `).join('');
}

/**
 * Render Notifications
 */
function renderNotifications() {
    const container = document.getElementById('notification-container');
    if (!container) return;

    container.innerHTML = window.mockData.notifications.map(n => `
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
    if (['delivered', 'approved', 'in stock'].includes(status)) return 'success';
    if (['preparing', 'pending', 'low stock'].includes(status)) return 'warning';
    if (['cancelled', 'rejected', 'out of stock'].includes(status)) return 'danger';
    if (['ready', 'accepted'].includes(status)) return 'primary';
    return '';
}

/**
 * API Wrapper Templates (for later .NET Backend integration)
 */
async function apiGetDashboardStats() {
    // return await fetch('/api/pharmacy/stats').then(res => res.json());
}
async function apiUpdateOrderStatus(orderId, status) {
    // return await fetch(\`/api/orders/\${orderId}\`, { method: 'PUT', body: JSON.stringify({status}) });
}

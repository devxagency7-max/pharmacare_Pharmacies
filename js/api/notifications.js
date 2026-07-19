/**
 * notifications.js - API Client for Notifications
 * API_BASE, safeJson come from config.js
 */

function _notifHeaders() {
    const token = localStorage.getItem('firebase_token');
    return { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function apiGetNotifications(page = 1, pageSize = 20) {
    try {
        const response = await fetch(`${API_BASE}/notifications?page=${page}&pageSize=${pageSize}`, {
            method: 'GET', headers: authHeader()
        });
        return await safeJson(response);
    } catch (e) {
        console.error('apiGetNotifications:', e);
        return { success: false, error: e.message };
    }
}

async function apiGetUnreadCount() {
    try {
        const response = await fetch(`${API_BASE}/notifications/unread-count`, {
            method: 'GET', headers: authHeader()
        });
        return await safeJson(response);
    } catch (e) {
        console.error('apiGetUnreadCount:', e);
        return { success: false, error: e.message };
    }
}

async function apiMarkNotificationRead(id) {
    try {
        const response = await fetch(`${API_BASE}/notifications/${id}/read`, {
            method: 'PUT', headers: authHeader()
        });
        return await safeJson(response);
    } catch (e) {
        console.error('apiMarkNotificationRead:', e);
        return { success: false, error: e.message };
    }
}

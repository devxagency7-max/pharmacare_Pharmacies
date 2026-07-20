/**
 * orders.js - API Client for Order Management
 * API_BASE, safeJson, jsonAuthHeaders come from config.js
 */

async function apiGetBranchOrders(branchId, status = '') {
    const token = localStorage.getItem('firebase_token');
    try {
        let url = `${API_BASE}/orders/branch/${branchId}?pageSize=100&sortDirection=desc`;
        if (status) url += `&status=${status}`;
        const response = await fetch(url, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        return await safeJson(response);
    } catch (error) {
        console.error('Error fetching branch orders:', error);
        return { success: false, error: error.message };
    }
}

async function apiRespondToOrder(orderId, action, notes = '', finalPrice = null) {
    const token = localStorage.getItem('firebase_token');
    try {
        const body = { action, notes };
        if (action === 'accept' && finalPrice !== null) body.finalPrice = finalPrice;
        const response = await fetch(`${API_BASE}/orders/${orderId}/respond`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        return await safeJson(response);
    } catch (error) {
        console.error('Error responding to order:', error);
        return { success: false, error: error.message };
    }
}

async function apiCompleteOrder(orderId) {
    const token = localStorage.getItem('firebase_token');
    try {
        const response = await fetch(`${API_BASE}/orders/${orderId}/complete`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        return await safeJson(response);
    } catch (error) {
        console.error('Error completing order:', error);
        return { success: false, error: error.message };
    }
}

async function apiGetOrderDetails(orderId) {
    const token = localStorage.getItem('firebase_token');
    try {
        const response = await fetch(`${API_BASE}/orders/${orderId}`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        return await safeJson(response);
    } catch (error) {
        console.error('Error fetching order details:', error);
        return { success: false, error: error.message };
    }
}

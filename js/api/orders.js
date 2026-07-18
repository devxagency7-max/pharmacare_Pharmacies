/**
 * orders.js - API Client for Order Management
 */

// API_BASE comes from js/api/config.js

/**
 * Helper to get headers with Auth
 */
function getHeaders() {
    const token = localStorage.getItem('firebase_token');
    return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };
}

/**
 * Fetch orders for a specific branch
 */
async function apiGetBranchOrders(branchId, status = '') {
    try {
        let url = `${API_BASE}/orders/branch/${branchId}`;
        if (status) url += `?status=${status}`;
        
        const response = await fetch(url, {
            method: 'GET',
            headers: getHeaders()
        });
        
        return await response.json();
    } catch (error) {
        console.error('Error fetching branch orders:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Respond to a pending order (Accept or Reject)
 */
async function apiRespondToOrder(orderId, action, notes = '') {
    try {
        const response = await fetch(`${API_BASE}/orders/${orderId}/respond`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({
                action: action, // 'accept' or 'reject'
                notes: notes
            })
        });
        
        return await response.json();
    } catch (error) {
        console.error('Error responding to order:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Mark order as completed
 * Backend POST /orders/{id}/complete takes no body
 */
async function apiCompleteOrder(orderId) {
    try {
        const response = await fetch(`${API_BASE}/orders/${orderId}/complete`, {
            method: 'POST',
            headers: getHeaders()
        });

        return await response.json();
    } catch (error) {
        console.error('Error completing order:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get order details by ID
 */
async function apiGetOrderDetails(orderId) {
    try {
        const response = await fetch(`${API_BASE}/orders/${orderId}`, {
            method: 'GET',
            headers: getHeaders()
        });
        
        return await response.json();
    } catch (error) {
        console.error('Error fetching order details:', error);
        return { success: false, error: error.message };
    }
}

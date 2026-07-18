/**
 * auth.js - API Client for Authentication & User Sync
 * API_BASE, safeJson, authHeader, jsonAuthHeaders come from config.js
 */

async function apiSyncUser(firebaseToken, userData) {
    try {
        const response = await fetch(`${API_BASE}/users/sync`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${firebaseToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(userData)
        });
        return await safeJson(response);
    } catch (error) {
        console.error('Error syncing user:', error);
        return { success: false, error: error.message };
    }
}

async function apiGetMe() {
    const token = localStorage.getItem('firebase_token');
    if (!token) return { success: false, message: 'Not authenticated' };
    try {
        const response = await fetch(`${API_BASE}/users/me`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        return await safeJson(response);
    } catch (error) {
        console.error('Error fetching profile:', error);
        return { success: false, error: error.message };
    }
}

function isAuthenticated() {
    return !!localStorage.getItem('firebase_token');
}

function logout() {
    localStorage.removeItem('firebase_token');
    localStorage.removeItem('user_info');
    window.location.href = 'login.html';
}

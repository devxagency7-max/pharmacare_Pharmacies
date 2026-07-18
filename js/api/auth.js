/**
 * auth.js - API Client for Authentication & User Sync
 * Base URL comes from js/api/config.js (API_BASE)
 */

/**
 * Sync Firebase User with Backend
 * @param {string} firebaseToken 
 * @param {Object} userData { email, name, displayName, phoneNumber }
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
        return await response.json();
    } catch (error) {
        console.error('Error syncing user:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get Logged-in User Profile
 */
async function apiGetMe() {
    const token = localStorage.getItem('firebase_token');
    try {
        const response = await fetch(`${API_BASE}/users/me`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        return await response.json();
    } catch (error) {
        console.error('Error fetching profile:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Helper to check if user is logged in
 */
function isAuthenticated() {
    return !!localStorage.getItem('firebase_token');
}

/**
 * Logout
 */
function logout() {
    localStorage.removeItem('firebase_token');
    localStorage.removeItem('user_info');
    window.location.href = 'login.html';
}

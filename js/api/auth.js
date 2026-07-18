/**
 * auth.js - API Client for Authentication & User Sync
 */

const BASE_URL = 'http://204.168.149.185/api/v1';

/**
 * Sync Firebase User with Backend
 * @param {string} firebaseToken 
 * @param {Object} userData { email, name, displayName, phoneNumber }
 */
async function apiSyncUser(firebaseToken, userData) {
    try {
        const response = await fetch(`${BASE_URL}/users/sync`, {
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
        const response = await fetch(`${BASE_URL}/users/me`, {
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

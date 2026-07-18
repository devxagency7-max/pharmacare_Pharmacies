/**
 * config.js — Single source of truth for all API base URLs.
 *
 * Requests go through Vercel rewrites (/backend → backend server)
 * so the browser always calls HTTPS and avoids Mixed-Content blocks.
 *
 * If running locally (not on Vercel), change these to the full URL:
 *   const API_BASE   = 'http://204.168.149.185/api/v1';
 *   const FILES_BASE = 'http://204.168.149.185/api/files';
 */
const API_BASE   = '/backend';
const FILES_BASE = '/backend-files';

/**
 * Safe JSON parse — handles empty bodies and non-JSON error responses.
 * Replace every `return await response.json()` with this.
 */
async function safeJson(response) {
    const text = await response.text();
    if (!text || !text.trim()) {
        return { success: false, status: response.status, message: `HTTP ${response.status}` };
    }
    try {
        return JSON.parse(text);
    } catch (_) {
        // Backend returned HTML error page or plain-text — treat as failure
        return { success: false, status: response.status, message: text.slice(0, 150) };
    }
}

/**
 * Returns the Bearer auth header object.
 * Returns null if the user is not logged in.
 */
function authHeader() {
    const token = localStorage.getItem('firebase_token');
    if (!token) return null;
    return { 'Authorization': `Bearer ${token}` };
}

/**
 * Returns auth + JSON content-type headers.
 * Returns null if the user is not logged in.
 */
function jsonAuthHeaders() {
    const token = localStorage.getItem('firebase_token');
    if (!token) return null;
    return { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
}

/**
 * prescriptions.js - API Client for Prescription Review
 * API_BASE, safeJson come from config.js
 *
 * Only /approve and /reject change Prescription.Status.
 * /review does NOT change status — never call it.
 */

function _rxHeaders() {
    const token = localStorage.getItem('firebase_token');
    return { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function apiGetPharmacyPendingPrescriptions(page = 1, pageSize = 50) {
    try {
        const response = await fetch(`${API_BASE}/prescriptions/pharmacy/pending?page=${page}&pageSize=${pageSize}`, {
            method: 'GET', headers: authHeader()
        });
        return await safeJson(response);
    } catch (e) {
        console.error('apiGetPharmacyPendingPrescriptions:', e);
        return { success: false, error: e.message };
    }
}

async function apiGetPharmacyReviewCallPrescriptions(page = 1, pageSize = 50) {
    try {
        const response = await fetch(`${API_BASE}/prescriptions/pharmacy/review-call?page=${page}&pageSize=${pageSize}`, {
            method: 'GET', headers: authHeader()
        });
        return await safeJson(response);
    } catch (e) {
        console.error('apiGetPharmacyReviewCallPrescriptions:', e);
        return { success: false, error: e.message };
    }
}

async function apiGetPharmacyPrescriptionHistory(page = 1, pageSize = 50) {
    try {
        const response = await fetch(`${API_BASE}/prescriptions/pharmacy/history?page=${page}&pageSize=${pageSize}`, {
            method: 'GET', headers: authHeader()
        });
        return await safeJson(response);
    } catch (e) {
        console.error('apiGetPharmacyPrescriptionHistory:', e);
        return { success: false, error: e.message };
    }
}

async function apiApprovePrescription(id, notes = '') {
    try {
        const response = await fetch(`${API_BASE}/prescriptions/${id}/approve`, {
            method: 'POST',
            headers: _rxHeaders(),
            body: JSON.stringify({ notes })
        });
        return await safeJson(response);
    } catch (e) {
        console.error('apiApprovePrescription:', e);
        return { success: false, error: e.message };
    }
}

async function apiRejectPrescription(id, reason) {
    try {
        const response = await fetch(`${API_BASE}/prescriptions/${id}/reject`, {
            method: 'POST',
            headers: _rxHeaders(),
            body: JSON.stringify({ reason })
        });
        return await safeJson(response);
    } catch (e) {
        console.error('apiRejectPrescription:', e);
        return { success: false, error: e.message };
    }
}

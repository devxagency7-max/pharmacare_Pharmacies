/**
 * prescriptions.js - API Client for Prescription Review
 *
 * IMPORTANT: Only /approve and /reject are wired.
 * /review does NOT change Prescription.Status — never use it.
 */

// API_BASE comes from js/api/config.js
const RX_BASE = API_BASE;

function _rxHeaders() {
    const token = localStorage.getItem('firebase_token');
    return { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
}

/**
 * Get pending prescriptions waiting for pharmacist review (FIFO — oldest first)
 */
async function apiGetPendingPrescriptions(page = 1, pageSize = 50) {
    try {
        const res = await fetch(`${RX_BASE}/prescriptions/pending?page=${page}&pageSize=${pageSize}`, {
            method: 'GET', headers: _rxHeaders()
        });
        return await res.json();
    } catch (e) {
        console.error('apiGetPendingPrescriptions:', e);
        return { success: false, error: e.message };
    }
}

/**
 * Approve a prescription
 * @param {string} id
 * @param {string} [notes]
 */
async function apiApprovePrescription(id, notes = '') {
    try {
        const res = await fetch(`${RX_BASE}/prescriptions/${id}/approve`, {
            method: 'POST',
            headers: _rxHeaders(),
            body: JSON.stringify({ notes })
        });
        return await res.json();
    } catch (e) {
        console.error('apiApprovePrescription:', e);
        return { success: false, error: e.message };
    }
}

/**
 * Reject a prescription
 * @param {string} id
 * @param {string} reason  Required by backend
 */
async function apiRejectPrescription(id, reason) {
    try {
        const res = await fetch(`${RX_BASE}/prescriptions/${id}/reject`, {
            method: 'POST',
            headers: _rxHeaders(),
            body: JSON.stringify({ reason })
        });
        return await res.json();
    } catch (e) {
        console.error('apiRejectPrescription:', e);
        return { success: false, error: e.message };
    }
}

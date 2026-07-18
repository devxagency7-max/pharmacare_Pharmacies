/**
 * pharmacies.js - API Client for Pharmacy & Branch Management
 *
 * Base URL: http://148.230.114.124:8080/api/v1
 * Auth:     Bearer firebase_token (from localStorage)
 *
 * NOTE on routes confirmed from backend source:
 *   - Profile update  → PUT  /pharmacies/profile  (no pharmacyId in URL)
 *   - isOpen toggle   → same PUT /pharmacies/profile  (isOpen field)
 *   - Logo upload     → POST /api/files/upload  (NOT /api/v1/files/upload)
 *   - Branch add      → POST /pharmacies/{pharmacyId}/branches  (city field REQUIRED)
 *   - Branch toggle   → PUT  /pharmacies/branches/{branchId}/status
 */

const BASE_URL = 'http://148.230.114.124:8080/api/v1';
const FILES_URL = 'http://148.230.114.124:8080/api/files';

function getHeaders() {
    const token = localStorage.getItem('firebase_token');
    return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };
}

function getAuthHeader() {
    const token = localStorage.getItem('firebase_token');
    return { 'Authorization': `Bearer ${token}` };
}

// ---------------------------------------------------------------------------
// Pharmacy Profile
// ---------------------------------------------------------------------------

/**
 * Get pharmacy public details by ID
 */
async function apiGetPharmacyProfile(pharmacyId) {
    try {
        const response = await fetch(`${BASE_URL}/pharmacies/${pharmacyId}`, {
            method: 'GET',
            headers: getHeaders()
        });
        return await response.json();
    } catch (error) {
        console.error('Error fetching pharmacy profile:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Update pharmacy public profile (name, logo, governorate, address, hours, isOpen).
 * Backend resolves "which pharmacy" from the Bearer token (OwnerId match) — no ID in URL.
 *
 * @param {Object} profileData
 * @param {string} profileData.name            Required
 * @param {string} profileData.governorate     Required
 * @param {string} profileData.address         Required
 * @param {string} [profileData.logoUrl]       Pass "" to leave existing logo unchanged
 * @param {string} [profileData.workingHoursDescription]
 * @param {boolean} [profileData.isOpen]
 */
async function apiUpdatePharmacyProfile(profileData) {
    try {
        const response = await fetch(`${BASE_URL}/pharmacies/profile`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(profileData)
        });
        return await response.json();
    } catch (error) {
        console.error('Error updating pharmacy profile:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Toggle pharmacy open / closed status.
 * Wraps apiUpdatePharmacyProfile — backend handles it in the same endpoint.
 * Caller must supply the full current profile to avoid overwriting other fields.
 *
 * @param {boolean} isOpen
 * @param {Object}  currentProfile  Existing profile fields (name, governorate, address, ...)
 */
async function apiSetPharmacyOpenStatus(isOpen, currentProfile) {
    return apiUpdatePharmacyProfile({ ...currentProfile, isOpen });
}

// ---------------------------------------------------------------------------
// Logo Upload
// ---------------------------------------------------------------------------

/**
 * Upload pharmacy logo.
 * Step 1: POST to /api/files/upload (note: NOT /api/v1/...).
 * Step 2: Take returned URL and call apiUpdatePharmacyProfile({ logoUrl: url, ...rest }).
 *
 * Rate limit: 10 requests / minute on this endpoint.
 * Max file size: 5 MB. Accepted types: JPG, PNG (magic-byte validated server-side).
 *
 * @param {File} file  The image File object from an <input type="file">
 * @returns {Promise<{success: boolean, data?: {url: string}}>}
 */
async function apiUploadLogo(file) {
    try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('fileType', 'Other');

        const response = await fetch(`${FILES_URL}/upload`, {
            method: 'POST',
            headers: getAuthHeader(),
            body: formData
        });
        return await response.json();
    } catch (error) {
        console.error('Error uploading logo:', error);
        return { success: false, error: error.message };
    }
}

// ---------------------------------------------------------------------------
// Branches
// ---------------------------------------------------------------------------

/**
 * Get all branches for a pharmacy (paginated, public endpoint)
 */
async function apiGetPharmacyBranches(pharmacyId, page = 1, pageSize = 20) {
    try {
        const response = await fetch(
            `${BASE_URL}/pharmacies/${pharmacyId}/branches?page=${page}&pageSize=${pageSize}`,
            { method: 'GET', headers: getHeaders() }
        );
        return await response.json();
    } catch (error) {
        console.error('Error fetching branches:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get details of a single branch
 */
async function apiGetBranchDetails(branchId) {
    try {
        const response = await fetch(`${BASE_URL}/pharmacies/branches/${branchId}`, {
            method: 'GET',
            headers: getHeaders()
        });
        return await response.json();
    } catch (error) {
        console.error('Error fetching branch details:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Add a new branch to a pharmacy.
 * `city` is REQUIRED by the backend — omitting it returns 400.
 *
 * @param {string} pharmacyId
 * @param {Object} branchData
 * @param {string} branchData.name      Required, max 150
 * @param {string} branchData.address   Required, max 250
 * @param {string} branchData.city      Required, max 100
 * @param {string} [branchData.phone]
 * @param {number} [branchData.latitude]
 * @param {number} [branchData.longitude]
 */
async function apiAddBranch(pharmacyId, branchData) {
    try {
        const response = await fetch(`${BASE_URL}/pharmacies/${pharmacyId}/branches`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(branchData)
        });
        return await response.json();
    } catch (error) {
        console.error('Error adding branch:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Toggle a branch active / inactive.
 * NOTE: As of current backend build, this is display-only —
 * deactivating a branch does NOT currently block new orders from arriving.
 *
 * @param {string}  branchId
 * @param {boolean} isActive
 */
async function apiSetBranchStatus(branchId, isActive) {
    try {
        const response = await fetch(`${BASE_URL}/pharmacies/branches/${branchId}/status`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify({ isActive })
        });
        return await response.json();
    } catch (error) {
        console.error('Error updating branch status:', error);
        return { success: false, error: error.message };
    }
}

// ---------------------------------------------------------------------------
// List of governorates (for profile form dropdown)
// ---------------------------------------------------------------------------

/**
 * Get distinct governorate names among Active pharmacies.
 * Public endpoint, cached 30 min server-side.
 */
async function apiGetGovernorates() {
    try {
        const response = await fetch(`${BASE_URL}/pharmacies/governorates`, {
            method: 'GET',
            headers: getHeaders()
        });
        return await response.json();
    } catch (error) {
        console.error('Error fetching governorates:', error);
        return { success: false, error: error.message };
    }
}

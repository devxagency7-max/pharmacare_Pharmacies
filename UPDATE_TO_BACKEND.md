# Frontend Update — Pharmacy Dashboard (Tamenny)
**To:** Backend Team
**From:** Frontend Team (Abdallah Mohamed Fathy)
**Date:** 2026-07-18

---

## TL;DR

We reviewed your backend guide (`PHARMACY_DASHBOARD_GUIDE.md`) in detail, cross-referenced it against our source code, and applied all required fixes on our side. The dashboard is now aligned with your real API. We have **two open questions** at the bottom of this document — please answer them so we can finalize the integration.

---

## What We Fixed (Our Side)

### 1. Complete Order — removed the body

**Problem we had:** `POST /orders/{id}/complete` was sending `{ "comments": "..." }` in the body.
**Your backend:** Takes no body at all.
**Fix applied:** Body removed from `apiCompleteOrder()` in `js/api/orders.js`.

---

### 2. Order Status State Machine — corrected

**Problem we had:** Our old internal API doc described a 6-status flow:
```
Pending → PricingResponded → Confirmed → Completed
```
`PricingResponded` and `Confirmed` do not exist in your backend.

**Your actual flow:**
```
Pending → Accepted → Completed
          Pending → Rejected
          Pending or Accepted → Cancelled (by patient)
```

**Fix applied:** Frontend UI, mock data, and all internal documentation updated to match the real statuses. Processing tab now shows `Accepted` orders only. No pricing/confirmation step anywhere in the UI.

---

### 3. No Price Field When Accepting — confirmed

**Problem we had:** Our old API doc said `price` was required when `action = "accept"`.
**Your backend:** No payment system. `POST /orders/{id}/respond` body is `{ action, notes? }` only.
**Fix applied:** `apiRespondToOrder()` was already correct (never sent a price). Old documentation updated.

---

### 4. Dashboard Analytics — routes corrected

**Problem we had:** We planned to call `/api/v1/reports/*` endpoints.
**Your backend:** Routes are `/api/v1/pharmacy/dashboard/*`.

**Fix applied:** `renderReports()` in `app.js` now calls the correct endpoints:

| Data | Endpoint called |
|---|---|
| Summary stats | `GET /api/v1/pharmacy/dashboard/summary?pharmacyId=` |
| Order source pie chart | `GET /api/v1/pharmacy/dashboard/order-source?pharmacyId=` |
| Fulfillment trend bar chart | `GET /api/v1/pharmacy/dashboard/fulfillment-trend?pharmacyId=&months=3` |
| Top medications chart | `GET /api/v1/pharmacy/dashboard/top-medications?pharmacyId=&limit=5` |
| Rejection notes list | `GET /api/v1/pharmacy/dashboard/rejection-notes?pharmacyId=&limit=10` |

All 5 calls use `pharmacyId` read from `localStorage` (`user_info.pharmacyId` — set after `POST /users/sync`).

---

### 5. Inventory Gaps Chart — removed

**Problem we had:** We had an "Inventory Gaps" chart expecting rejected item counts per month.
**Your backend:** No inventory module exists.
**Fix applied:** Chart replaced with "Top Requested Medications" (horizontal bar) — sourced from `GET /pharmacy/dashboard/top-medications`. The 3rd canvas (`#inventoryGapsChart`) is reused with the new chart and its heading updated dynamically.

---

### 6. Pharmacy Profile Update — route corrected

**Problem we had:** We planned `PATCH /pharmacies/{pharmacyId}` (with ID in URL).
**Your backend:** `PUT /pharmacies/profile` (no ID — resolved from Bearer token).

**Fix applied:** `apiUpdatePharmacyProfile()` in `js/api/pharmacies.js` now calls `PUT /pharmacies/profile`.

Request body:
```json
{
  "name": "Draya Pharmacy",
  "logoUrl": "https://...",
  "governorate": "Cairo",
  "address": "New Cairo, District 5",
  "workingHoursDescription": "Daily 9AM–11PM",
  "isOpen": true
}
```

---

### 7. Open/Closed Toggle — merged into profile endpoint

**Problem we had:** We planned a separate `PUT /pharmacies/{id}/status` endpoint for the open/closed toggle.
**Your backend:** `isOpen` is a field inside `PUT /pharmacies/profile`.
**Fix applied:** Toggle in Settings now calls `apiUpdatePharmacyProfile()` with `isOpen` included. No separate endpoint needed.

---

### 8. Logo Upload — two-step flow implemented

**Problem we had:** We planned `POST /pharmacies/{id}/logo` as a dedicated endpoint.
**Your backend:** Upload via `POST /api/files/upload` then save the URL in `PUT /pharmacies/profile`.

**Fix applied:** `apiUploadLogo()` in `js/api/pharmacies.js` calls `POST /api/files/upload` (note: NOT `/api/v1/files/upload` — no version segment, confirmed from your guide). On success the URL is saved via the profile endpoint.

Important: `previewPharmacyLogo()` now stores the actual `File` object (not just base64) so it can be sent as `multipart/form-data`.

---

### 9. Branch Creation — `city` field added

**Problem we had:** Our Add Branch form was missing the `city` field. Your backend requires it (`[Required]`, max 100 chars).
**Fix applied:**
- `city` input added to the form in `index.html`
- `handleAuthAddBranch()` in `app.js` now reads the `city` value and includes it in the API call
- `apiAddBranch()` in `pharmacies.js` passes it through

---

### 10. Branch Status Toggle — endpoint wired

**Your backend:** `PUT /api/v1/pharmacies/branches/{branchId}/status` — body: `{ "isActive": false }`.
**Fix applied:** `apiSetBranchStatus()` added to `pharmacies.js`. The Deactivate/Activate button in the Branches section is now ready to call this endpoint.

**Note from your guide:** Branch deactivation is currently **display-only** — it does not block new orders from arriving on that branch. We have updated our UI copy to say "Mark as temporarily closed" rather than implying orders will stop. Please notify us if this enforcement is added in a future backend release.

---

### 11. Prescription `/review` endpoint — NOT wired

**Your backend guide (§9.5):** `POST /prescriptions/{id}/review` creates a review record but **does NOT transition `Prescription.Status`**. Only `/approve` and `/reject` do.
**Fix applied:** `/review` is not wired anywhere in our UI. We use `/approve` and `/reject` exclusively.

---

### 12. Role-Based Navigation — implemented

**Your backend (§1.4):** `Pharmacist` / `PharmacyIntern` accounts have no FK to a pharmacy — they cannot access Orders, Branches, Profile, or Analytics (all return 403).

**Fix applied:** On `DOMContentLoaded`, the app reads `user_info.roles` from `localStorage`. If the user is NOT `PharmacyOwner`, the following sidebar items are hidden:
- Dashboard (Analytics)
- Orders
- Reports
- Branches
- Settings

The default landing page for a non-owner is **Prescriptions**. For a `PharmacyOwner` it remains **Dashboard**.

---

### 13. File Upload Route — corrected

**Your backend:** File upload is at `/api/files/upload` — **no `/v1/` version segment**.
**Fix applied:** `FILES_URL` in `pharmacies.js` is set to `http://148.230.114.124:8080/api/files` (not `/api/v1/files`).

---

## What We Still Need From You — 2 Open Questions

### ❓ Question 1 — Logo URL persistence after signed URL expires

When we upload a logo via `POST /api/files/upload`, the response includes a **pre-signed URL valid for 10 minutes**. We save this URL into the pharmacy's `logoUrl` field via `PUT /pharmacies/profile`.

**Question:** After the 10-minute signed URL expires, does `GET /pharmacies/{id}` still return a working `logoUrl`? Or do we need to save a stable/public URL separately?

If the signed URL is what gets stored, the logo will break after 10 minutes in every `GET /pharmacies/{id}` response. Please confirm how the backend handles this — we need to know what URL format to expect in `logoUrl` after saving.

---

### ❓ Question 2 — `pharmacyId` and `branchId` in `GET /users/me`

Your guide (§1.4) states that `GET /users/me` returns `pharmacyId` and `branchId` for `PharmacyOwner` accounts. We read these from `user_info` in `localStorage` (set after `POST /users/sync`).

**Question:** Please confirm the exact JSON field names returned in the `/users/me` response for a `PharmacyOwner`. Specifically:

- Is it `pharmacyId` (camelCase)?
- Is it `branchId` (the "main" branch), or an array `branchIds[]`?
- Is this field included in the `/users/sync` response too, or only in `/users/me`?

We rely on `user_info.pharmacyId` for all 5 analytics endpoints and for the Branches section. If the field name differs, nothing will load.

---

## Current Status of All Endpoints

| Endpoint | Status from our side |
|---|---|
| `POST /api/v1/users/sync` | ✅ Implemented |
| `GET /api/v1/users/me` | ✅ Implemented |
| `GET /api/v1/orders/branch/{branchId}` | ✅ Implemented |
| `GET /api/v1/orders/summary?branchId=` | ✅ Implemented |
| `GET /api/v1/orders/{id}` | ✅ Implemented |
| `POST /api/v1/orders/{id}/respond` | ✅ Implemented — `{ action, notes? }` |
| `POST /api/v1/orders/{id}/complete` | ✅ Implemented — no body |
| `GET /api/v1/prescriptions/pending` | ✅ Implemented |
| `GET /api/v1/prescriptions/{id}` | ✅ Implemented |
| `POST /api/v1/prescriptions/{id}/approve` | ✅ Implemented |
| `POST /api/v1/prescriptions/{id}/reject` | ✅ Implemented |
| `GET /api/v1/notifications` | ✅ Implemented |
| `GET /api/v1/notifications/unread-count` | ✅ Implemented |
| `PUT /api/v1/notifications/{id}/read` | ✅ Implemented |
| `GET /api/v1/pharmacies/{pharmacyId}/branches` | ✅ Implemented |
| `POST /api/v1/pharmacies/{pharmacyId}/branches` | ✅ Implemented — includes `city` |
| `PUT /api/v1/pharmacies/branches/{branchId}/status` | ✅ Implemented |
| `PUT /api/v1/pharmacies/profile` | ✅ Implemented |
| `POST /api/files/upload` | ✅ Implemented |
| `GET /api/v1/pharmacy/dashboard/summary` | ✅ Implemented |
| `GET /api/v1/pharmacy/dashboard/order-source` | ✅ Implemented |
| `GET /api/v1/pharmacy/dashboard/fulfillment-trend` | ✅ Implemented |
| `GET /api/v1/pharmacy/dashboard/top-medications` | ✅ Implemented |
| `GET /api/v1/pharmacy/dashboard/rejection-notes` | ✅ Implemented |
| `GET /api/v1/pharmacists/pending-requests` | 🔲 UI not built yet |
| `PUT /api/v1/pharmacists/requests/{id}/respond` | 🔲 UI not built yet |
| `GET /api/v1/pharmacists/my-patients` | 🔲 UI not built yet |
| `GET /api/v1/pharmacists/patients/{id}` | 🔲 UI not built yet |
| `PUT /api/v1/pharmacists/patients/{id}/terminate` | 🔲 UI not built yet |

---

Please reply with answers to the 2 questions above and we can start live testing.

**Frontend Team — Tamenny Pharmacy Dashboard**

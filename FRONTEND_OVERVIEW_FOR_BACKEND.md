# Tamenny — Pharmacy Dashboard: Complete Frontend Overview for Backend Team

> **Purpose of this document:** Full description of what the frontend (Web Dashboard) currently builds, displays, and needs from the backend API. Read this before building or debugging any endpoint that serves the pharmacy side.

**Base URL:** `http://204.168.149.185/api/v1`
**Auth:** Firebase JWT — `Authorization: Bearer {firebase_id_token}`
**Required Role:** `Pharmacist` or `PharmacyOwner`

---

## Table of Contents

1. [Project Summary](#1-project-summary)
2. [Tech Stack](#2-tech-stack)
3. [Authentication Flow](#3-authentication-flow)
4. [Section: Dashboard (Analysis)](#4-section-dashboard-analysis)
5. [Section: Orders (Order Management)](#5-section-orders-order-management)
6. [Section: Prescriptions](#6-section-prescriptions)
7. [Section: Reports (Business Insights)](#7-section-reports-business-insights)
8. [Section: Notifications](#8-section-notifications)
9. [Section: Branches](#9-section-branches)
10. [Section: Settings](#10-section-settings)
11. [Topbar (Header)](#11-topbar-header)
12. [FCM Push Notifications](#12-fcm-push-notifications)
13. [Full Endpoint Checklist](#13-full-endpoint-checklist)
14. [Missing Endpoints (Not Yet Defined)](#14-missing-endpoints-not-yet-defined)
15. [Mismatches & Issues to Resolve](#15-mismatches--issues-to-resolve)
16. [Order Status State Machine](#16-order-status-state-machine)

---

## 1. Project Summary

The Pharmacy Dashboard is a **web application** (HTML/CSS/JS — no framework) used exclusively by pharmacists and pharmacy owners (NOT patients). It is the operator-facing side of the Tamenny platform.

**Who uses it:** A pharmacist or pharmacy owner opens it in a desktop/tablet browser at their pharmacy.

**What they do with it:**
- Log in once per day using their pharmacy email & password
- Monitor and respond to incoming medication orders from patients
- Review and approve/reject prescription images uploaded by patients
- Manage their pharmacy branches
- View business performance reports
- Receive real-time push notifications about order events
- Update their pharmacy's public profile (name, logo, governorate, working hours)
- Toggle their pharmacy open/closed status

**Current state of the frontend:** All UI screens are fully built. All sections currently run on **local mock data** (hardcoded arrays in JavaScript). The API client files (`auth.js`, `orders.js`, `pharmacies.js`) exist with the correct function signatures but are **not yet wired** into the main app logic. The next step is replacing mock data calls with real API calls.

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Language | Vanilla HTML + CSS + JavaScript (no framework) |
| Charts | Chart.js (loaded from CDN) |
| Icons | Boxicons 2.1.4 |
| Fonts | Google Fonts — Inter |
| Authentication | Firebase Identity Toolkit REST API (no Firebase JS SDK) |
| Deployment | Vercel (`vercel.json` present) |
| Backend Communication | `fetch()` with Bearer token in Authorization header |
| Token Storage | `localStorage` — key: `firebase_token` |
| User Info Storage | `localStorage` — key: `user_info` (JSON of backend sync response) |

---

## 3. Authentication Flow

### Step 1 — Firebase Login (already implemented in `login.html`)

The frontend calls Firebase directly using the REST Identity Toolkit (no SDK):

```
POST https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={FIREBASE_API_KEY}
Body: { email, password, returnSecureToken: true }
```

Firebase returns `idToken` (JWT, valid for 1 hour).

### Step 2 — Backend Sync (`auth.js` → `apiSyncUser`)

```
POST /api/v1/users/sync
Authorization: Bearer {firebase_id_token}
Content-Type: application/json

Body:
{
  "email": "pharmacist@example.com",
  "name": "Dr. Khaled Hassan",
  "displayName": "Dr. Khaled",
  "phoneNumber": ""
}
```

**Expected response (200):**
```json
{
  "success": true,
  "data": {
    "id": "user-guid",
    "firebaseUid": "firebase_uid",
    "email": "pharmacist@example.com",
    "name": "Dr. Khaled Hassan",
    "roles": ["Pharmacist"],
    "status": "Active",
    "isNewUser": false
  },
  "errors": []
}
```

> If `success` is false, the user sees: "Backend Sync Failed: {errors[0]}" and stays on login.
> If role is NOT `Pharmacist` or `PharmacyOwner`, return 403.

### Step 3 — Store & Redirect

On success:
- `localStorage.setItem('firebase_token', idToken)`
- `localStorage.setItem('user_info', JSON.stringify(syncResult.data))`
- Redirect to `index.html` (the dashboard)

### Step 4 — Get Profile (`auth.js` → `apiGetMe`)

```
GET /api/v1/users/me
Authorization: Bearer {token}
```

**Expected response fields used by the frontend:**

| Field | Where displayed |
|---|---|
| `data.name` | Topbar profile name + Settings form default value |
| `data.roles` | Topbar subtitle ("Pharmacy") |
| `data.avatarUrl` | Topbar profile image (fallback: ui-avatars.com) |
| `data.phone` | Settings form (if shown) |

---

## 4. Section: Dashboard (Analysis)

**Route:** Default page on load (`id="dashboard"`)

### 4.1 Stats Cards

Four stat cards at the top. Values are currently calculated by counting mock order data. Once connected to real API, these should come from an aggregation endpoint or from the orders list.

| HTML Element ID | Stat Displayed | Source |
|---|---|---|
| `stat-pending-orders` | Count of orders where `orderStatus === "Pending"` | Orders list or summary endpoint |
| `stat-processing-orders` | Count where `orderStatus === "PricingResponded"` or `"Confirmed"` | Orders list or summary endpoint |
| `stat-confirmed-orders` | Count where `orderStatus === "Completed"` | Orders list or summary endpoint |
| `stat-rejected-orders` | Count where `orderStatus === "Rejected"` or `"Cancelled"` | Orders list or summary endpoint |

> **Missing endpoint:** There is currently no dedicated `/dashboard/summary` or `/orders/stats` endpoint. The frontend currently calculates these by filtering the local mock orders array. The backend team needs to either provide a summary endpoint OR the frontend will calculate it from the orders list response.

### 4.2 Charts

Two charts on the dashboard (Chart.js):

| Canvas ID | Chart Type | What it shows | Current data |
|---|---|---|---|
| `ordersTrendChart` | Line chart | Orders per day of the week (Mon–Sun) | Hardcoded mock: [12, 19, 3, 5, 2, 3, 15] |
| `topSellingChart` | Doughnut chart | Top 3 requested medication categories | Hardcoded mock: Paracetamol, Ibuprofen, Amoxicillin |

> **Missing endpoint:** No API endpoint exists for these chart datasets. See Section 14.

### 4.3 Workflow Guide Card

Static informational card — no API data needed.

---

## 5. Section: Orders (Order Management)

**Route:** `id="orders"` — accessible from sidebar

This is the most critical section. It uses a 3-tab queue UI:

| Tab | HTML Element | Orders Shown |
|---|---|---|
| **Incoming** | `#table-new-orders` | `orderStatus === "Pending"` |
| **Processing (Need Call)** | `#table-processing-orders` | `orderStatus === "PricingResponded"` or `"Confirmed"` |
| **History** | `#table-history-orders` | `orderStatus` in `["Completed", "Rejected", "Cancelled"]` |

### 5.1 Incoming Tab (Pending Orders)

**Columns displayed:**

| Column | Data Field |
|---|---|
| Order ID | `order.id` |
| Customer Name | `order.customerName` |
| Items | `order.items` (array of drug names joined by comma) |
| Time | `order.createdAt` |
| Actions | Accept button + Reject button |

**Accept button action:**
```
POST /api/v1/orders/{orderId}/respond
Body: { "action": "accept", "price": 125.50, "notes": "..." }
```

> **Note:** The current frontend accepts the order without a price input (just calls `handleOrderAction('accept')`). The modal version (in the Order Details Modal) has a rejection reason textarea. If the backend `respond` endpoint requires `price` when `action === "accept"`, the frontend will need a price input field added before this can go live. **Clarify with frontend team.**

**Reject button action:**
```
POST /api/v1/orders/{orderId}/respond
Body: { "action": "reject", "price": null, "notes": "reason from prompt dialog" }
```

### 5.2 Processing Tab (PricingResponded / Confirmed Orders)

**Columns displayed:**

| Column | Data Field |
|---|---|
| Order ID | `order.id` |
| Customer Name | `order.customerName` |
| Phone Number | `order.phone` (clickable `tel:` link) |
| Actions | "Complete (Done)" button + "Cancel" button |

**Complete Order button:**
```
PUT /api/v1/orders/{orderId}/status
Body: { "status": "Completed", "comments": "Delivered to patient." }
```

> **Important:** This should only work when `orderStatus === "Confirmed"` (patient confirmed the price). If pharmacist tries to complete a `PricingResponded` order before patient confirms, backend should return 422.

**Cancel button:**
> Currently updates local mock to "Cancelled". No backend endpoint defined for pharmacist-side cancellation. See Section 15.

### 5.3 History Tab

**Columns displayed:**

| Column | Data Field |
|---|---|
| Order ID | `order.id` |
| Customer Name | `order.customerName` |
| Status | Status badge (`Completed` = green, `Rejected` = red, `Cancelled` = red) |
| Date | `order.createdAt` |

No actions on this tab — read only.

### 5.4 Order Details Modal

Triggered by clicking an order row (not yet wired to real data). Shows:

| Field | HTML Element | Data Needed |
|---|---|---|
| Order ID | `#modal-order-id` | `order.id` |
| Patient Name | `#modal-patient-name` | `order.customerName` |
| Phone Number | `#modal-patient-phone` | `order.phone` |
| Items List | `#modal-items-list` | Array of `{ drugName, dosage, quantity }` |
| Rejection Note | `#rejection-note` (textarea) | Sent as `notes` in respond endpoint |

**Modal action stages:**
- `#stage-new` — Accept / Reject buttons (shown when status is `Pending`)
- `#stage-reject` — Rejection text area + Confirm Rejection button
- `#stage-call` — "Confirm Order (Done)" + "Cancel Order" (shown after accept)

**API call for Order Details:**
```
GET /api/v1/orders/{id}
```

### 5.5 API Endpoint Summary for Orders Section

```
GET  /api/v1/orders/branch/{branchId}?status=Pending&page=1&pageSize=50
GET  /api/v1/orders/summary?branchId={id}
GET  /api/v1/orders/{id}
POST /api/v1/orders/{id}/respond        ← { action: "accept"|"reject", notes? }  (no price field)
POST /api/v1/orders/{id}/complete       ← no body
```

---

## 6. Section: Prescriptions

**Route:** `id="prescriptions"` — accessible from sidebar

Same 3-tab queue layout as Orders, but for prescription review.

| Tab | HTML Element | Prescriptions Shown |
|---|---|---|
| **Incoming Rxs** | `#table-new-rxs` | `status === "Pending"` |
| **Review & Call** | `#table-processing-rxs` | `status === "Approved"` (after pharmacist approves) |
| **Rx History** | `#table-history-rxs` | status in `["Approved", "Rejected"]` |

### 6.1 Incoming Rxs Tab

**Columns displayed:**

| Column | Data Field |
|---|---|
| RX ID | `rx.id` |
| Patient Name | `rx.patientName` |
| RX Image | Link to view prescription image (`rx.imageUrls[0]`) |
| Actions | Accept + Reject buttons |

**Accept:**
```
POST /api/v1/prescriptions/{id}/approve
Body: { "notes": "Valid prescription. All items dispensable." }
```

**Reject:**
```
POST /api/v1/prescriptions/{id}/reject
Body: { "reason": "reason from prompt dialog" }
```

### 6.2 Review & Call Tab

**Columns displayed:**

| Column | Data Field |
|---|---|
| RX ID | `rx.id` |
| Patient Name | `rx.patientName` |
| Phone Number | `rx.phone` (clickable `tel:` link) |
| Actions | "Confirm (Done)" + "Cancel" buttons |

**Confirm Done:** No additional action needed — once approved the prescription is in Approved state and the patient can place an order. This tab is read-only after approval.

> ⚠️ **IMPORTANT:** Do NOT use `POST /prescriptions/{id}/review` — this endpoint creates a review record but does NOT change `Prescription.Status`. Only `/approve` and `/reject` actually transition the status.

### 6.3 Rx History Tab

| Column | Data Field |
|---|---|
| RX ID | `rx.id` |
| Patient Name | `rx.patientName` |
| Final Status | Badge — `Approved` (green), `Rejected` (red) |
| Date | `rx.createdAt` |

### 6.4 Stat Updated

The pending prescriptions count updates the element `#stat-pending-prescriptions` (in the dashboard stats if connected).

### 6.5 API Endpoint Summary for Prescriptions Section

```
GET  /api/v1/prescriptions/pending
GET  /api/v1/prescriptions/{id}
POST /api/v1/prescriptions/{id}/approve    ← { notes? }
POST /api/v1/prescriptions/{id}/reject     ← { reason* (required) }
```
> ⚠️ `/review` is NOT wired — it doesn't transition Prescription.Status (see §6.2 warning).

---

## 7. Section: Reports (Business Insights)

**Route:** `id="reports"` — accessible from sidebar

**Status: Connected to real API.** Routes updated to `/api/v1/pharmacy/dashboard/*`.

### 7.1 Summary Stats Row

Three summary numbers at the top — sourced from `GET /api/v1/pharmacy/dashboard/summary?pharmacyId=`:

| Display Text | Backend field |
|---|---|
| Total Requests | `data.totalRequests` |
| Order Success Rate | `data.successRate` (%) |
| Rejected Orders Count | `data.rejectedOrdersCount` |

> Note: "Missing Meds Count" label has been replaced with "Rejected Orders Count" — there is no inventory module in the backend.

### 7.2 Charts

| Canvas ID | Chart Type | What it shows | API endpoint |
|---|---|---|---|
| `orderSourceChart` | Pie | With prescription vs without | `GET /pharmacy/dashboard/order-source` |
| `fulfillmentTrendChart` | Bar | Completed orders per month (last 3 months) | Monthly completed count |
| `inventoryGapsChart` | Line | Rejected items (units) per month | Monthly rejected item count |

### 7.3 Rejection Feedback Notes

List of the most recent rejection `notes` from `POST /orders/{id}/respond` calls where `action === "reject"`. Currently hardcoded with 3 sample notes in Arabic.

| Element | Data Needed |
|---|---|
| `#rejection-notes-list` | Last 5–10 rejection notes with date and text |

### 7.4 Most Requested Medications

A list of the top requested drug names with a count and a visual progress bar. Currently hardcoded with 3 items (Panadol Extra, August 1g, Concor 5mg).

| Element | Data Needed |
|---|---|
| `#top-requested-list` | Array of `{ medicineName, requestCount }` sorted descending |

### 7.5 API Endpoint Summary for Reports Section (ALL MISSING — See Section 14)

```
GET  /api/v1/reports/summary?pharmacyId={id}
     → totalRequests, successRate, missingMedsCount

GET  /api/v1/reports/order-source?pharmacyId={id}
     → { prescriptionOrders: 450, directOrders: 798 }

GET  /api/v1/reports/fulfillment-trend?pharmacyId={id}&months=3
     → [{ month: "Feb", count: 380 }, ...]

GET  /api/v1/reports/inventory-gaps?pharmacyId={id}&months=3
     → [{ month: "Feb", rejectedUnits: 150 }, ...]

GET  /api/v1/reports/top-medications?pharmacyId={id}&limit=5
     → [{ medicineName: "Panadol Extra", requestCount: 142 }, ...]

GET  /api/v1/reports/rejection-notes?pharmacyId={id}&limit=10
     → [{ date: "...", note: "..." }, ...]
```

> These endpoints are not in the current API doc. The backend team needs to build them. If building them is not feasible now, the frontend can calculate some from the orders list, but aggregated data (top meds, inventory gaps) requires backend support.

---

## 8. Section: Notifications

**Route:** `id="notifications"` — accessible from sidebar

### 8.1 Notification List

The container `#notification-container` renders a list of notification cards.

**Each card displays:**

| Field | Data Field |
|---|---|
| Title | `notification.title` |
| Message / Body | `notification.body` |
| Time | `notification.createdAt` (formatted as "X minutes ago") |
| Read/Unread indicator | `notification.isRead` |

### 8.2 Topbar Notification Badge

```html
<span class="badge">5</span>  ← currently hardcoded
```

This needs to be replaced with the real unread count from:
```
GET /api/v1/notifications/unread-count
→ { "success": true, "data": 3 }
```

### 8.3 Mark as Read

When user clicks a notification:
```
PUT /api/v1/notifications/{id}/read
```

### 8.4 API Endpoint Summary for Notifications Section

```
GET /api/v1/notifications?page=1&pageSize=20
GET /api/v1/notifications/unread-count
PUT /api/v1/notifications/{id}/read
```

---

## 9. Section: Branches

**Route:** `id="branches"` — accessible from sidebar

### 9.1 Branch Cards Grid

The container `#branches-container` renders a grid of branch cards.

**Each card displays:**

| Field | Data Field |
|---|---|
| Branch Name | `branch.name` |
| Status Badge | `branch.status` ("Active" = green) |
| Phone | `branch.phone` |
| Address | `branch.address` |
| View Details button | Opens details (not yet implemented) |
| Deactivate button | No backend endpoint currently — see Section 14 |

### 9.2 Add New Branch Modal

Fields collected from the form:

| Form Field | Input ID | API Field |
|---|---|---|
| Branch Name | `#branch-name` | `name` |
| Phone | `#branch-phone` | `phone` |
| Governorate | `#branch-gov` | Not in current API body — may need to be added |
| Detailed Address | `#branch-address` | `address` |
| Latitude | `#branch-lat` | `latitude` (optional) |
| Longitude | `#branch-lng` | `longitude` (optional) |

**API call:**
```
POST /api/v1/pharmacies/{pharmacyId}/branches
Body: { name, phone, address, latitude, longitude }
```

> **Note:** The form has a `Governorate` dropdown but the current API body for adding a branch does not include a `governorate` field. The backend team should either add it or confirm it's part of `address`.

### 9.3 API Endpoint Summary for Branches Section

```
GET  /api/v1/pharmacies/{pharmacyId}/branches
POST /api/v1/pharmacies/{pharmacyId}/branches   ← { name, phone, address, latitude, longitude }
PUT  /api/v1/pharmacies/branches/{branchId}/status  ← MISSING (Deactivate button needs this)
```

---

## 10. Section: Settings

**Route:** `id="settings"` — accessible from sidebar

This section has two cards: Service Status and Public Profile.

### 10.1 Service Status Card (Open/Closed Toggle)

A large toggle switch controls whether the pharmacy is visible and accepting requests.

| State | Display Text | Color |
|---|---|---|
| Checked (Open) | "Your Pharmacy is currently OPEN" | Green (#10B981) |
| Unchecked (Closed) | "Your Pharmacy is currently CLOSED" | Red (#EF4444) |

**Currently:** Only changes the displayed text locally. No API call is made.

**Needed API call:**
```
PUT /api/v1/pharmacies/{pharmacyId}/status
Body: { "isOpen": true }   or   { "isOpen": false }
```

> This endpoint does not exist yet. See Section 14.

### 10.2 Public Profile Card

This card shows fields that are visible to patients when they browse pharmacies.

**Form fields and their input IDs:**

| Label | Input ID | Data Type | Notes |
|---|---|---|---|
| Pharmacy Name | `#set-pharmacy-name` | string | Required |
| License Number | `#set-pharmacy-license` | string | **Read-only.** Managed by Admin. Should come from `GET /users/me` or pharmacy profile. |
| Governorate | `#set-pharmacy-gov` | dropdown | Options: Cairo, Giza, Alexandria, Qalyubia, Dakahlia, Other |
| Detailed Address | `#set-pharmacy-address` | string | Free text |
| Working Hours Description | `#set-pharmacy-hours` | string | Free text, e.g. "Daily 9AM–11PM" |

**Logo Upload:**
- User selects an image file via a file input (`#pharmacy-logo-input`)
- Preview shown immediately (`#profile-logo-preview`)
- On save, the image data needs to be uploaded to the backend

**On form submit (`Save Changes` button):**

Currently only logs to console and shows a browser `alert`. No API call.

**Needed API calls:**
```
Step 1 — Upload logo if changed:
POST /api/files/upload                    ← multipart/form-data, field: file + fileType=Other
                                            NOTE: /api/files not /api/v1/files (no version segment)

Step 2 — Save all profile fields in one call:
PUT /api/v1/pharmacies/profile
Body: { name, governorate, address, workingHoursDescription, isOpen, logoUrl }
      (logoUrl = URL from step 1, or "" to leave existing logo unchanged)
```

> The open/closed toggle and profile update share the same endpoint — no separate toggle endpoint needed.

**After a successful save:**
- The topbar profile name (`#topbar-pharmacy-name`) updates to the new name
- The topbar avatar updates to the new logo (or falls back to ui-avatars.com initial)

---

## 11. Topbar (Header)

Appears on every page of the dashboard.

| Element | What it shows | Data Source |
|---|---|---|
| Search box | Placeholder only — no search API wired | — |
| Notification bell badge | Unread notifications count | `GET /notifications/unread-count` |
| Profile image | Pharmacy logo or avatar | `data.avatarUrl` from `GET /users/me` |
| Profile name | Pharmacy name or pharmacist name | `data.name` from `GET /users/me` |
| Role subtitle | "Pharmacy" | Static text (or from `data.roles`) |
| Logout link | Clears localStorage and redirects to `login.html` | Local only |

---

## 12. FCM Push Notifications

The backend is responsible for sending FCM push notifications to the pharmacist's registered device/browser. The frontend reads the `data` payload to navigate.

### Notification Types the Pharmacist Receives

| FCM `data.type` | When it fires | Frontend behavior |
|---|---|---|
| `NEW_ORDER` | Patient creates a new order | Show bell badge. Navigate to Orders → Incoming tab. Refresh orders list via `GET /orders/branch/{branchId}?status=Pending` |
| `ORDER_CONFIRMED` | Patient accepts the pharmacy's price | Show alert: "Patient confirmed. Prepare order." Navigate to order detail. The order moves from Processing → ready for "Mark as Completed" |
| `ORDER_CANCELLED` | Patient cancels before pharmacy responds | Show alert: "Order cancelled by patient." Remove from Incoming queue. |

### FCM Payload Format Expected by Frontend

```json
{
  "notification": {
    "title": "New Order",
    "body": "Ahmed Ali placed a prescription order"
  },
  "data": {
    "type": "NEW_ORDER",
    "orderId": "order-guid",
    "pharmacyId": "pharmacy-guid"
  }
}
```

> The frontend reads `data.type` to determine action. `data.orderId` is used to call `GET /orders/{id}` and show the correct order.

---

## 13. Full Endpoint Checklist

All endpoints the frontend needs. ✅ = documented in API doc | ⚠️ = documented but has a mismatch | ❌ = missing from API doc entirely.

### Authentication
| Status | Method | Endpoint | Used In |
|---|---|---|---|
| ✅ | POST | `/api/v1/users/sync` | Login page |
| ✅ | GET | `/api/v1/users/me` | Topbar profile, Settings defaults |

### Orders
| Status | Method | Endpoint | Used In |
|---|---|---|---|
| ✅ | GET | `/api/v1/orders/branch/{branchId}` | Orders section (all tabs) |
| ✅ | GET | `/api/v1/orders/summary?branchId=` | Tab count badges |
| ✅ | GET | `/api/v1/orders/{id}` | Order detail modal |
| ✅ | POST | `/api/v1/orders/{id}/respond` | Accept/Reject — body: `{ action, notes? }` — **no price field** |
| ✅ | POST | `/api/v1/orders/{id}/complete` | Complete order — **no body** |

### Prescriptions
| Status | Method | Endpoint | Used In |
|---|---|---|---|
| ✅ | GET | `/api/v1/prescriptions/pending` | Prescriptions section — Incoming tab |
| ✅ | GET | `/api/v1/prescriptions/{id}` | Prescription detail (image view) |
| ✅ | POST | `/api/v1/prescriptions/{id}/approve` | Accept button — body: `{ notes? }` |
| ✅ | POST | `/api/v1/prescriptions/{id}/reject` | Reject button — body: `{ reason* }` |
| 🚫 | ~~POST~~ | ~~`/api/v1/prescriptions/{id}/review`~~ | **NOT wired — does not change status** |

### Notifications
| Status | Method | Endpoint | Used In |
|---|---|---|---|
| ✅ | GET | `/api/v1/notifications` | Notifications section |
| ✅ | GET | `/api/v1/notifications/unread-count` | Topbar badge |
| ✅ | PUT | `/api/v1/notifications/{id}/read` | On notification click |

### Branches
| Status | Method | Endpoint | Used In |
|---|---|---|---|
| ✅ | GET | `/api/v1/pharmacies/{pharmacyId}/branches` | Branches section — card grid |
| ✅ | POST | `/api/v1/pharmacies/{pharmacyId}/branches` | Add Branch modal — **city field required** |
| ✅ | PUT | `/api/v1/pharmacies/branches/{branchId}/status` | Deactivate/Activate button |

### Reports / Analytics
| Status | Method | Endpoint | Used In |
|---|---|---|---|
| ✅ | GET | `/api/v1/pharmacy/dashboard/summary?pharmacyId=` | Reports — 3 summary numbers |
| ✅ | GET | `/api/v1/pharmacy/dashboard/order-source?pharmacyId=` | Reports — Pie chart |
| ✅ | GET | `/api/v1/pharmacy/dashboard/fulfillment-trend?pharmacyId=&months=3` | Reports — Bar chart |
| ✅ | GET | `/api/v1/pharmacy/dashboard/top-medications?pharmacyId=&limit=5` | Reports — Top Meds (reuses 3rd canvas) |
| ✅ | GET | `/api/v1/pharmacy/dashboard/rejection-notes?pharmacyId=&limit=10` | Reports — Rejection notes list |
| 🚫 | — | Inventory Gaps | **Removed — no inventory module in backend** |

### Settings
| Status | Method | Endpoint | Used In |
|---|---|---|---|
| ✅ | PUT | `/api/v1/pharmacies/profile` | Save profile + open/closed toggle (one endpoint) |
| ✅ | POST | `/api/files/upload` (no `/v1/`) | Logo upload — `fileType=Other`, max 5MB, JPG/PNG only |

### Patient Management (defined in API doc, not yet wired to any frontend UI)
| Status | Method | Endpoint | Notes |
|---|---|---|---|
| ✅ | GET | `/api/v1/pharmacists/pending-requests` | No UI section built yet |
| ✅ | PUT | `/api/v1/pharmacists/requests/{id}/respond` | No UI section built yet |
| ✅ | GET | `/api/v1/pharmacists/my-patients` | No UI section built yet |
| ✅ | GET | `/api/v1/pharmacists/patients/{id}` | No UI section built yet |
| ✅ | PUT | `/api/v1/pharmacists/patients/{id}/terminate` | No UI section built yet |

### Medication Plans (defined in API doc, not yet wired to any frontend UI)
| Status | Method | Endpoint | Notes |
|---|---|---|---|
| ✅ | POST | `/api/v1/medications` | No UI section built yet |
| ✅ | GET | `/api/v1/medications` | No UI section built yet |
| ✅ | GET | `/api/v1/medications/{id}` | No UI section built yet |

### Ratings (defined in API doc, not yet wired to any frontend UI)
| Status | Method | Endpoint | Notes |
|---|---|---|---|
| ✅ | GET | `/api/v1/ratings/pharmacist/{pharmacistId}` | No UI section built yet |

---

## 14. Missing Endpoints (Not Yet Defined in API Doc)

These endpoints are needed by the built UI but do not yet exist in the API documentation or backend.

### 14.1 Dashboard Stats Summary

**Why needed:** The 4 stat cards on the dashboard show counts per order status. Currently calculated client-side from mock data. The frontend team needs either a dedicated summary endpoint or will calculate from the orders list response.

```
GET /api/v1/orders/summary?branchId={id}

Suggested response:
{
  "success": true,
  "data": {
    "pending": 12,
    "processing": 5,
    "completed": 89,
    "rejected": 7
  }
}
```

### 14.2 Reports / Analytics Endpoints

**Why needed:** The entire Reports section (5 data visualizations + 2 lists) runs on hardcoded numbers. All need real data.

```
GET /api/v1/reports/summary?pharmacyId={id}
Response: { totalRequests, successRate, missingMedsCount }

GET /api/v1/reports/order-source?pharmacyId={id}
Response: { prescriptionOrders: 450, directOrders: 798 }

GET /api/v1/reports/fulfillment-trend?pharmacyId={id}&months=3
Response: [{ month: "Feb 2026", fulfilledCount: 380 }, ...]

GET /api/v1/reports/inventory-gaps?pharmacyId={id}&months=3
Response: [{ month: "Feb 2026", rejectedUnits: 150 }, ...]

GET /api/v1/reports/top-medications?pharmacyId={id}&limit=5
Response: [{ medicineName: "Panadol Extra", requestCount: 142 }, ...]

GET /api/v1/reports/rejection-notes?pharmacyId={id}&limit=10
Response: [{ date: "2026-07-16T12:40:00Z", note: "Out of stock" }, ...]
```

### 14.3 Update Pharmacy Public Profile

**Why needed:** The Settings → Public Profile form has a Save button that currently only logs to the browser console. Patients see this profile when browsing pharmacies on the mobile app.

```
PATCH /api/v1/pharmacies/{pharmacyId}
Authorization: Bearer {token}
Content-Type: application/json

Body:
{
  "name": "Draya Pharmacy",
  "governorate": "Cairo",
  "address": "New Cairo, District 5",
  "workingHours": "Daily from 9 AM to 11 PM"
}

Response 200:
{
  "success": true,
  "data": { "id": "...", "name": "...", ... }
}
```

### 14.4 Upload Pharmacy Logo

**Why needed:** The Settings section has a logo upload button and a preview. The image needs to be stored server-side and returned in subsequent `GET /pharmacies/{id}` calls as `logoUrl`.

```
POST /api/v1/pharmacies/{pharmacyId}/logo
Authorization: Bearer {token}
Content-Type: multipart/form-data

Field: logo (image file — JPG or PNG, max 800KB)

Response 200:
{
  "success": true,
  "data": { "logoUrl": "https://s3.amazonaws.com/..." }
}
```

### 14.5 Toggle Pharmacy Open/Closed Status

**Why needed:** The Settings section has a large toggle switch. When turned off, the pharmacy should be hidden from patients or marked as unavailable in the mobile app discovery flow.

```
PUT /api/v1/pharmacies/{pharmacyId}/status
Authorization: Bearer {token}
Content-Type: application/json

Body: { "isOpen": true }   or   { "isOpen": false }

Response 200:
{
  "success": true,
  "data": { "id": "...", "isOpen": false }
}
```

### 14.6 Deactivate Branch

**Why needed:** Each branch card has a "Deactivate" button. Currently shows a browser `alert` with no API call.

```
PUT /api/v1/pharmacies/branches/{branchId}/status
Authorization: Bearer {token}
Content-Type: application/json

Body: { "isActive": false }

Response 200:
{
  "success": true,
  "data": { "id": "...", "isActive": false }
}
```

---

## 15. Resolved & Remaining Issues

### ✅ Resolved — Complete Order Endpoint
**Was:** Frontend had `POST /complete` with a body `{ comments }`.
**Fix applied:** Body removed. Backend `POST /orders/{id}/complete` takes no body. (`orders.js` updated)

### ✅ Resolved — Price Field in Accept
**Was:** Old API doc required `price` field when accepting an order.
**Confirmed by backend:** No payment system exists. `POST /orders/{id}/respond` body is `{ action, notes? }` — no price. (`orders.js` was already correct, old doc was wrong)

### ✅ Resolved — Analytics Routes
**Was:** Frontend planned `/api/v1/reports/*`.
**Fix applied:** Routes updated to `/api/v1/pharmacy/dashboard/*` matching the real backend. (`app.js` updated)

### ✅ Resolved — Profile Update & Open/Closed Toggle
**Was:** Frontend planned `PATCH /pharmacies/{id}` + separate toggle endpoint.
**Fix applied:** Both handled by `PUT /api/v1/pharmacies/profile` with `isOpen` field. (`pharmacies.js` + `app.js` updated)

### ✅ Resolved — Logo Upload Route
**Was:** Frontend planned `POST /pharmacies/{id}/logo`.
**Fix applied:** Two-step flow — `POST /api/files/upload` then save URL in profile endpoint. (`pharmacies.js` updated)

### ✅ Resolved — Branch `city` Field
**Was:** Branch creation form was missing `city` field (required by backend).
**Fix applied:** `city` input added to the form. (`index.html` + `app.js` updated)

### ✅ Resolved — Prescription `/review` Warning
**Was:** Frontend planned to use `/review` for the "Confirm Done" action.
**Fix applied:** `/review` is NOT wired — it doesn't change `Prescription.Status`. Only `/approve` and `/reject` are used.

### ✅ Resolved — Inventory Gaps Chart
**Was:** Frontend had an "Inventory Gaps" chart expecting rejected item counts.
**Fix applied:** Chart replaced with "Top Requested Medications" from `GET /pharmacy/dashboard/top-medications`. No inventory module exists in backend.

### ⚠️ Still Needs Confirmation from Backend

**1. `pharmacyId` and `branchId` in `GET /users/me` response**
Backend doc says these are populated for `PharmacyOwner` accounts. Frontend reads them from `localStorage` (`user_info.pharmacyId`, `user_info.branchId`). Please confirm the exact field names in the response.

**2. Logo URL persistence**
After uploading a logo via `POST /api/files/upload`, the returned URL is a 10-minute signed URL. We save it to the pharmacy profile via `PUT /pharmacies/profile`. Please confirm: does the backend store the stable/permanent R2 URL (not the signed one) in `logoUrl`, so it remains accessible after 10 minutes?

**3. Branch deactivation does not block orders**
Backend doc confirmed that `PUT /branches/{id}/status` is display-only — it does not currently prevent orders from arriving on a deactivated branch. Frontend copy updated to say "mark as temporarily closed" rather than "stop accepting orders."

---

## 16. Order Status State Machine

**Confirmed from backend source code.** Simple 5-status flow — no pricing/confirmation step.

```
[Patient creates order]
        ↓
    Pending ─────────────────────────────→ Cancelled  (patient cancels)
        │
        ├── [Pharmacy rejects]  →  Rejected
        │
        └── [Pharmacy accepts]  →  Accepted
                                       │
                              [Pharmacy fulfills & delivers]
                                       ↓
                                   Completed ← also patient can cancel from Accepted
```

| Status | Who causes it | Pharmacist sees | Pharmacist action |
|---|---|---|---|
| `Pending` | Patient | Incoming tab — "New" badge | Accept or Reject |
| `Accepted` | Pharmacy (`POST /respond` action=accept) | Processing tab — call patient | Mark as Completed |
| `Completed` | Pharmacy (`POST /complete`) | History tab | View only |
| `Rejected` | Pharmacy (`POST /respond` action=reject) | History tab | View only |
| `Cancelled` | Patient | History tab | View only |

**Backend validation rules (enforced by `InvalidOperationException` → 400):**
- `POST /orders/{id}/respond` → only callable when `orderStatus === "Pending"`
- `POST /orders/{id}/complete` → only callable when `orderStatus === "Accepted"`

> `PricingResponded` and `Confirmed` do NOT exist in this backend. The old API doc was incorrect on this point. Frontend has been updated accordingly.

---

*Document version: 2.0 — Updated 2026-07-18 after backend source review*
*Frontend author: Abdallah Mohamed Fathy*
*For questions about the UI, contact the frontend team before building a new endpoint.*

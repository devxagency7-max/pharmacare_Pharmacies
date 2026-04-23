# Pharmacy Dashboard API Documentation

**Base URL:** `http://148.230.114.124:8080`
**Version:** v1 | **Auth:** Firebase JWT (Bearer Token) | **Role Required:** `Pharmacist` or `PharmacyOwner`

---

## 1. Overview

The Pharmacy Dashboard is used by **pharmacists and pharmacy owners**.

They can:
- Receive and review incoming patient orders
- Respond with a price or reject orders
- Mark orders as completed
- Manage their assigned patients
- Review and approve/reject prescriptions
- Create medication plans for patients
- View notifications in real time
- View pharmacy branches (read-only)

> ⚠️ All endpoints require a valid Firebase token. Role must be `Pharmacist` or `PharmacyOwner`.

---

## 2. Authentication Flow

### Step 1 — Firebase Login
Pharmacist logs in using Firebase. Firebase returns a JWT ID Token valid for **1 hour**.

### Step 2 — Sync User
```
POST http://148.230.114.124:8080/api/v1/users/sync
```
**Headers:**
```
Authorization: Bearer {firebase_id_token}
Content-Type: application/json
```
**Request Body:**
```json
{
  "email": "pharmacist@example.com",
  "name": "Dr. Khaled Hassan",
  "displayName": "Dr. Khaled",
  "phoneNumber": "+201111111111"
}
```
**Response 200:**
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

### Step 3 — Get Profile
```
GET http://148.230.114.124:8080/api/v1/users/me
```
**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "user-guid",
    "firebaseUid": "firebase_uid",
    "email": "pharmacist@example.com",
    "name": "Dr. Khaled Hassan",
    "phone": "+201111111111",
    "gender": "Male",
    "dateOfBirth": "1985-03-10",
    "avatarUrl": "https://example.com/avatar.jpg",
    "roles": ["Pharmacist"],
    "membershipNumber": "MEM-2024-ABCDEF",
    "status": "Active",
    "createdAt": "2026-01-15T00:00:00Z"
  }
}
```

---

## 3. Orders — Receiving & Responding

### GET /api/v1/orders/branch/{branchId}
Get all orders for a specific pharmacy branch.

**When to call:** On dashboard load and after each `NEW_ORDER` push notification.
**UI:** Show list of order cards grouped by status. Highlight `Pending` orders prominently.

**Headers:**
```
Authorization: Bearer {pharmacist_token}
```
**Query Params:** `?page=1&pageSize=20&status=Pending`

> Filter `?status=Pending` to show only new orders that need a response.
> Remove the filter to show all orders across all statuses.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "order-guid",
        "customerId": "patient-guid",
        "customerName": "Ahmed Ali",
        "pharmacyId": "pharmacy-guid",
        "pharmacyName": "Al Seha Pharmacy",
        "branchId": "branch-guid",
        "branchName": "Cairo Branch",
        "prescriptionImageUrl": "https://s3.amazonaws.com/pharmacare/prescription.jpg",
        "finalPrice": null,
        "respondedByPharmacyId": null,
        "orderStatus": "Pending",
        "paymentStatus": "Pending",
        "deliveryNotes": "Leave at door",
        "items": [
          {
            "drugId": "drug-guid",
            "drugName": "Panadol",
            "dosage": "500mg",
            "form": "Tablet",
            "imageUrl": "https://example.com/panadol.jpg",
            "requiresPrescription": false,
            "isControlled": false,
            "quantity": 2,
            "unitPrice": null
          }
        ],
        "statusHistory": [],
        "createdAt": "2026-04-22T10:00:00Z",
        "updatedAt": null
      }
    ],
    "totalCount": 12,
    "page": 1,
    "pageSize": 20,
    "totalPages": 1
  }
}
```

### GET /api/v1/orders/me
Get all orders the pharmacy has been involved in.

### GET /api/v1/orders/{id}
Get full order details by ID, including full `statusHistory`.

**When to call:** When pharmacist taps on an order card to view details.

---

### POST /api/v1/orders/{id}/respond
Respond to a patient order — accept with a price, or reject.

**When to call:** When pharmacist taps "Accept" or "Reject" on the order detail screen.
**UI on loading:** Disable the respond buttons, show a spinner.
**UI on success (accept):** Update order card status to `PricingResponded`. Show confirmation: "Price sent to patient".
**UI on success (reject):** Update order card status to `Rejected`. Remove from active queue.
**UI on failure (422):** Show: "This order has already been responded to."

**Headers:**
```
Authorization: Bearer {pharmacist_token}
Content-Type: application/json
```

**Request Body (Accept with Price):**
```json
{
  "action": "accept",
  "price": 125.50,
  "notes": "All items available. Estimated delivery: 2 hours."
}
```

**Request Body (Reject):**
```json
{
  "action": "reject",
  "price": null,
  "notes": "Panadol 500mg is currently out of stock."
}
```

**Validation Rules:**
| Field | Rule |
|---|---|
| `action` | Required — must be exactly `"accept"` or `"reject"` (lowercase) |
| `price` | Required when `action = "accept"`. Must be a positive number. |
| `notes` | Optional — strongly recommended to explain the price or rejection reason |

**Response 200 (Accept):**
```json
{
  "success": true,
  "data": {
    "id": "order-guid",
    "orderStatus": "PricingResponded",
    "finalPrice": 125.50,
    "updatedAt": "2026-04-22T10:30:00Z"
  }
}
```

**Response 200 (Reject):**
```json
{
  "success": true,
  "data": {
    "id": "order-guid",
    "orderStatus": "Rejected",
    "finalPrice": null
  }
}
```

> After responding, a push notification `ORDER_RESPONSE` is automatically sent to the patient.

**Errors:**
| Code | UI Behavior |
|------|-------------|
| 400 | Show: "Action or price is invalid" |
| 401 | Redirect to login |
| 403 | Show: "Access denied" |
| 404 | Show: "Order not found" |
| 422 | Show: "This order is no longer in Pending status and cannot be responded to" |

---

### PUT /api/v1/orders/{id}/status
Update order to `Completed` after fulfillment.

**When to call:** When pharmacist physically hands the order to the patient or completes delivery.
**UI on success:** Mark order as completed. Move to "Completed" tab.
**Important:** Only call this when status is `Confirmed`. Calling on other statuses returns 422.

**Request Body:**
```json
{
  "status": "Completed",
  "comments": "Order delivered successfully to the patient."
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "order-guid",
    "orderStatus": "Completed"
  }
}
```

---

## 4. Order Status State Machine

```
Pending → [Pharmacist responds]
  ├── accept → PricingResponded → [Patient confirms] → Confirmed → [Pharmacist fulfills] → Completed
  └── reject → Rejected

Pending → [Patient cancels] → Cancelled
```

| Status | Meaning | Pharmacist Action | UI for Pharmacist |
|--------|---------|-------------------|-----------|
| `Pending` | Patient created order, waiting for pharmacy | Respond (accept/reject) | Show "Respond" button |
| `PricingResponded` | Pharmacy accepted, price sent to patient | Wait for patient | Show "Waiting for patient" label |
| `Confirmed` | Patient accepted the price | Fulfill and deliver | Show "Mark as Completed" button |
| `Completed` | Order fulfilled and delivered | None | Show in history |
| `Rejected` | Pharmacy rejected the order | None | Show in history |
| `Cancelled` | Patient cancelled before pharmacy responded | None | Show in history |

> ⚠️ `respond` only works on `Pending` orders.
> ⚠️ `PUT /orders/{id}/status` with `Completed` only works on `Confirmed` orders.

---

## 5. Notifications

### GET /api/v1/notifications
Get all notifications for the logged-in pharmacist.

**When to call:** On dashboard load, and to mark notifications as read.
**Query Params:** `?page=1&pageSize=20`

**Response 200:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "notif-guid",
        "userId": "pharmacist-guid",
        "title": "New Order",
        "body": "Ahmed Ali placed a prescription order",
        "type": "NEW_ORDER",
        "isRead": false,
        "createdAt": "2026-04-22T10:00:00Z"
      }
    ],
    "totalCount": 5,
    "page": 1,
    "pageSize": 20
  }
}
```

### GET /api/v1/notifications/unread-count
**When to call:** On every app open and after any push notification arrives.
```json
{ "success": true, "data": 3 }
```
Show this count as a badge on the notification bell icon.

### PUT /api/v1/notifications/{id}/read
**When to call:** When user opens a notification. No body required.
```json
{ "success": true, "message": "Notification marked as read." }
```

### Notification Types Pharmacist Receives

| Type | When | Frontend Action |
|------|------|-------------------|
| `NEW_ORDER` | Patient creates an order | Show badge. Navigate to order detail when tapped. Call `GET /orders/branch/{branchId}` to refresh list. |
| `ORDER_CONFIRMED` | Patient confirms the price | Show alert: "Patient confirmed. Prepare order." Navigate to order detail. |
| `ORDER_CANCELLED` | Patient cancels before response | Show alert: "Order cancelled by patient." Remove from active queue. |

---

## 6. Notification Push Payload (FCM)

When an event happens, Firebase Cloud Messaging delivers:
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
Frontend should read `data.type` to navigate to the correct screen.

---

## 7. Patient Management

### GET /api/v1/pharmacists/pending-requests
Get list of patients who requested this pharmacist.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "request-guid",
        "patientId": "patient-guid",
        "patientName": "Sara Mohamed",
        "patientEmail": "sara@example.com",
        "message": "I need help managing my diabetes medication",
        "requestedAt": "2026-04-22T09:00:00Z",
        "status": "Pending"
      }
    ]
  }
}
```

### PUT /api/v1/pharmacists/requests/{id}/respond
Accept or reject a patient assignment request.

**Request Body:**
```json
{ "accept": true }
```

### GET /api/v1/pharmacists/my-patients
Get all currently assigned patients.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "patient-guid",
        "name": "Sara Mohamed",
        "email": "sara@example.com",
        "phone": "+201111111111",
        "status": "Active",
        "assignedAt": "2026-04-01T00:00:00Z"
      }
    ],
    "totalCount": 24
  }
}
```

### GET /api/v1/pharmacists/patients/{id}
Get full patient details including medical history.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "patient-guid",
    "name": "Sara Mohamed",
    "email": "sara@example.com",
    "phone": "+201111111111",
    "status": "Active",
    "medicalRecords": [
      {
        "type": "Diagnosis",
        "title": "Annual checkup",
        "description": "All results normal",
        "recordDate": "2026-04-01"
      }
    ],
    "medicationPlans": [
      {
        "medicineName": "Metformin",
        "dosage": "500mg",
        "frequency": "Daily"
      }
    ],
    "healthReadings": [
      {
        "type": "BloodSugar",
        "value": 110.0,
        "unit": "mg/dL",
        "recordedAt": "2026-04-22T08:00:00Z"
      }
    ]
  }
}
```

### PUT /api/v1/pharmacists/patients/{id}/terminate
Terminate the assignment relationship with a patient.

---

## 8. Medication Plans

### POST /api/v1/medications
Create a medication plan for an assigned patient. This endpoint also auto-generates the schedule and reminders in one request.

**Headers:**
```
Authorization: Bearer {pharmacist_token}
Content-Type: application/json
```

**Request Body:**
```json
{
  "patientId": "patient-guid",
  "medicineName": "Metformin",
  "dosage": "500mg",
  "instructions": "Take with meals. Avoid alcohol.",
  "quantity": 60,
  "prescribingDoctor": "Dr. Ahmed Hassan",
  "timeOfDay": "Morning",
  "frequency": "Daily",
  "startDate": "2026-04-22",
  "durationDays": 30
}
```

> `timeOfDay` values: `Morning`, `Afternoon`, `Evening`, `Night`
> `frequency` values: `Daily`, `Weekly`, `AsNeeded`

**Response 201:**
```json
{
  "success": true,
  "data": {
    "id": "plan-guid",
    "patientId": "patient-guid",
    "patientName": "Sara Mohamed",
    "pharmacistId": "pharmacist-guid",
    "pharmacistName": "Dr. Khaled Hassan",
    "medicineName": "Metformin",
    "dosage": "500mg",
    "instructions": "Take with meals. Avoid alcohol.",
    "quantity": 60,
    "prescribingDoctor": "Dr. Ahmed Hassan",
    "createdAt": "2026-04-22T10:00:00Z",
    "schedules": [
      {
        "id": "schedule-guid",
        "planId": "plan-guid",
        "timeOfDay": "Morning",
        "frequency": "Daily",
        "startDate": "2026-04-22",
        "endDate": "2026-05-22",
        "createdAt": "2026-04-22T10:00:00Z"
      }
    ]
  }
}
```

### GET /api/v1/medications
Get all medication plans created by this pharmacist.

**Query Params:** `?page=1&pageSize=20`

### GET /api/v1/medications/{id}
Get a specific plan with all schedules.

---

## 9. Prescriptions (Review)

### GET /api/v1/prescriptions/pending
Get all prescriptions submitted by patients that need review.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "prescription-guid",
        "patientId": "patient-guid",
        "patientName": "Ahmed Ali",
        "doctorName": "Dr. Omar",
        "clinicName": "Cairo Medical Center",
        "issueDate": "2026-04-01",
        "expiryDate": "2026-07-01",
        "status": "Pending",
        "imageUrls": ["https://s3.amazonaws.com/pharmacare/rx1.jpg"],
        "review": null,
        "createdAt": "2026-04-22T09:00:00Z"
      }
    ]
  }
}
```

### GET /api/v1/prescriptions/pending-reviews
Get prescriptions pending pharmacist clinical review.

### GET /api/v1/prescriptions/{id}
Get a single prescription by ID.

### POST /api/v1/prescriptions/{id}/approve
```json
{ "notes": "Valid prescription. All items dispensable." }
```

### POST /api/v1/prescriptions/{id}/reject
```json
{ "reason": "Prescription is expired. Issue date: 2025-01-01, expiry: 2025-04-01." }
```

### POST /api/v1/prescriptions/{id}/review
```json
{
  "clinicalNotes": "Patient has known penicillin allergy — substitute recommended.",
  "status": "Reviewed"
}
```

---

## 10. Pharmacies & Branches

> **Note:** Pharmacy creation is managed exclusively by Admins. Pharmacies and their branches are **read-only** from the Pharmacy Dashboard API.

### GET /api/v1/pharmacies/{pharmacyId}/branches
Get all branches of a pharmacy.

### POST /api/v1/pharmacies/{pharmacyId}/branches
Create a new branch.

**Request Body:**
```json
{
  "name": "Alexandria Branch",
  "phone": "+20333333333",
  "address": "45 Corniche St, Alexandria",
  "latitude": 31.2,
  "longitude": 29.9
}
```

> ~~`PUT /api/v1/pharmacies/branches/{branchId}/working-hours`~~ — **Deprecated & hidden from API.** Working hours management has been removed to simplify the flow.

> ~~`POST /api/v1/pharmacies/{pharmacyId}/staff`~~ — **Deprecated & hidden from API.** Staff management has been removed from the Pharmacy Dashboard. User roles are managed via the Admin Dashboard.

---

## 11. Ratings

### GET /api/v1/ratings/pharmacist/{pharmacistId}
Get all ratings for this pharmacist.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "rating-guid",
        "targetId": "pharmacist-guid",
        "targetType": "Pharmacist",
        "patientName": "Ahmed Ali",
        "score": 5,
        "comment": "Very professional and helpful!",
        "createdAt": "2026-04-20T15:00:00Z"
      }
    ],
    "totalCount": 8
  }
}
```

---

## 12. Discovery (Public Profile)

### GET /api/v1/pharmacists/{id}
Public profile visible to patients browsing pharmacists.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "pharmacist-guid",
    "name": "Dr. Khaled Hassan",
    "specialization": "Clinical Pharmacy",
    "bio": "10 years experience in chronic disease management",
    "avatarUrl": "https://example.com/avatar.jpg",
    "averageRating": 4.7,
    "totalPatients": 24,
    "isAcceptingPatients": true
  }
}
```

---

## 13. Pharmacy Dashboard — Full Business Flow

```
--- Login & Setup ---
1. Pharmacist logs in via Firebase
2. POST /api/v1/users/sync → role confirmed as Pharmacist
3. GET /api/v1/notifications/unread-count → show badge count
4. GET /api/v1/orders/branch/{branchId}?status=Pending → load pending orders

--- Receive New Order ---
5. FCM push arrives: NEW_ORDER
   → data.orderId, data.pharmacyId
   → Navigate to order detail: GET /api/v1/orders/{id}
   → Review items, prescription image, delivery notes

--- Respond to Order ---
6a. Accept:
    POST /api/v1/orders/{id}/respond
    → { action: "accept", price: 125.50, notes: "Delivery in 2 hours" }
    → orderStatus: PricingResponded
    → Patient receives ORDER_RESPONSE push
    UI: Show "Waiting for patient confirmation" state

6b. Reject:
    POST /api/v1/orders/{id}/respond
    → { action: "reject", notes: "Out of stock" }
    → orderStatus: Rejected
    → Patient receives ORDER_RESPONSE push
    UI: Move order to Rejected tab

--- Patient Confirms ---
7. FCM push arrives: ORDER_CONFIRMED
   → Navigate to order detail
   UI: Show "Mark as Completed" button

--- Fulfill Order ---
8. PUT /api/v1/orders/{id}/status
   → { status: "Completed", comments: "Delivered to patient" }
   → orderStatus: Completed
   UI: Move order to Completed tab
```

### UI State Machine — Pharmacy Order View
| Order Status | Pharmacist Screen | Actions Available |
|---|---|---|
| `Pending` | Order card with "New" badge | Accept or Reject |
| `PricingResponded` | "Waiting for patient..." | None (read-only) |
| `Confirmed` | "Patient confirmed ✓" | Mark as Completed |
| `Completed` | History tab | View only |
| `Rejected` | History tab | View only |
| `Cancelled` | History tab | View only |

---

## 14. Error Reference

| Code | Reason |
|------|--------|
| 400 | Invalid body, missing required fields |
| 401 | Token missing or expired |
| 403 | User is not Pharmacist or PharmacyOwner |
| 404 | Order or patient not found |
| 422 | Business rule violation (wrong order status) |
| 500 | Unexpected server error |

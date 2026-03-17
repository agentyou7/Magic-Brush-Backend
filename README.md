# MagicBrush Backend

Node.js + Express backend with JWT login API and Firestore user storage.

## Implemented API

- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `POST /api/contact`
- `GET /api/services`
- `GET /api/admin/inquiries`
- `PATCH /api/admin/inquiries/:id/status`

Request body:

```json
{
  "email": "admin@example.com",
  "password": "your_password"
}
```

Success response includes:

- JWT token (`data.token`)
- user id, email, and role

Contact request body:

```json
{
  "name": "John Doe",
  "phone": "07424292487",
  "service": "House Renovation",
  "message": "Need a quote for full kitchen renovation."
}
```

Services response:

```json
{
  "success": true,
  "data": {
    "services": [
      {
        "id": "house-renovation",
        "title": "House Renovation",
        "description": "Complete structural and aesthetic transformations",
        "iconName": "Home",
        "fullDetails": "Detailed service description...",
        "imageUrl": "/images/service_renovation.png",
        "sortOrder": 1
      }
    ],
    "count": 1
  }
}
```

Admin inquiries filters (all optional):

- `status`
- `service`
- `dateFrom` (ISO date-time, e.g. `2026-03-04T00:00:00.000Z`)
- `dateTo` (ISO date-time)
- `limit` (default `50`, max `200`)

Update inquiry status request body:

```json
{
  "status": "called"
}
```

Allowed inquiry statuses:

- `new`
- `called`
- `quoted`
- `won`
- `closed`

Workflow transitions:

- `new` -> `called`
- `called` -> `quoted` or `closed`
- `quoted` -> `won` or `closed`
- `won` -> `closed`
- `closed` -> no transitions allowed

Update status error codes:

- `400` invalid params/body
- `401` unauthorized
- `403` forbidden (non-admin)
- `404` inquiry not found
- `409` invalid workflow transition

## Setup

1. Copy `.env.example` to `.env`
2. Add Firebase Admin SDK values from your service account
3. Add Resend and contact email variables
4. Start app:

```bash
npm run dev
```

Base URL: `http://localhost:4000`

## Firestore Services Collection

`GET /api/services` reads from `services` collection and expects fields:

- `id`
- `title`
- `description`
- `iconName`
- `fullDetails`
- `imageUrl`
- `isActive` (boolean, only `true` records returned)
- `sortOrder` (number, ascending order)

## Firestore Users Collection

The login API expects a Firestore collection `users` with documents like:

```json
{
  "email": "admin@example.com",
  "emailLower": "admin@example.com",
  "passwordHash": "$2b$12$....",
  "isActive": true,
  "role": "admin"
}
```

On successful login, backend verifies bcrypt password hash and returns JWT.

## Password Hash Example

Generate a bcrypt hash in Node:

```bash
node -e "const b=require('bcryptjs'); b.hash('Admin@123', 12).then(console.log)"
```

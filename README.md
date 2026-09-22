# Laboratory Management System (LMS) - Production Deployment Guide

A enterprise-grade Laboratory Management System (LMS) built with React 19, TypeScript, Express.js, and MongoDB.

---

## 📋 Table of Contents
0. [Roles & Workflow](#0-roles--workflow)
1. [MongoDB Atlas Setup](#1-mongodb-atlas-setup)
2. [Local Setup & Quick Start](#2-local-setup--quick-start)
3. [Environment Variables Guide](#3-environment-variables-guide)
4. [Database Seeding Instructions](#4-database-seeding-instructions)
5. [Frontend Deployment (Vercel / Netlify)](#5-frontend-deployment-vercel--netlify)
6. [Backend Deployment (Railway / Render / VPS)](#6-backend-deployment-railway--render--vps)
7. [CORS Configuration](#7-cors-configuration)
8. [Production API URL Setup](#8-production-api-url-setup)
9. [Custom Domain Configuration](#9-custom-domain-configuration)
10. [HTTPS & SSL Security](#10-https--ssl-security)
11. [Backup Strategy](#11-backup-strategy)

---

## 0. Roles & Workflow

The system runs a diagnostic centre, so the desks are modelled on how one
actually works. **Admin is the top of the tree** - there is no Super Admin
tier. Every guarded action is a named permission in
`backend/src/constants/permissions.ts`, and that one file decides what a role
can reach; the API enforces it and the UI mirrors it, so a desk is never shown
a screen its token would be refused on.

### The front-desk day (Receptionist)

1. **Register or find the patient** - search by name, UHID or mobile pulls up
   an existing patient with their past bills, dues and reports.
2. **Generate the bill** - pick the patient, referring doctor and tests. The
   invoice is raised with the patient's details on it.
3. **The bill links forward automatically** - one sample per test is created
   at `Pending Collection` with its own barcode, which is what puts the visit
   into the collection queue and, from there, onto the bench.
4. **Take payment** - full or part; the balance stays on the invoice.
5. **Record money paid out** - the ambulance, a courier, a collection agent.
   Petty cash is settled on the spot; anything above the limit is filed as
   `Pending` for the Admin. The Payouts screen totals it by payee, by category
   and by day, so "how much have we given the ambulance this month" is one
   look.

The receptionist is deliberately fenced in: no changes to the rate master, no
result entry, no staff register, no centre-wide revenue analytics, and no
approving their own payout.

On the bill itself they can price a line the way the counter actually works -
type the rate this patient is being charged, knock a few rupees off one test,
or discount the whole bill. All of it is measured against the rate card
together, so a rate typed down to half price is stopped by the same
`MAX_STAFF_DISCOUNT_PERCENT` limit as a discount of the same size; past that,
the bill needs an Admin.

### Roles

| Role | Reaches |
|---|---|
| **Admin** | Everything: masters, doctors, staff accounts, rates, the lab, all money and reports |
| **Receptionist** | Patients, patient history, billing, payments, appointments, payouts, sample hand-off |
| **Phlebotomist** | Collection queue and home visits |
| **Lab Technician** | Accessioning, processing, result entry |
| **Pathologist** | Result verification and release, reports |
| **Accountant** | Collections, refunds, payouts and their approval, revenue reports |

### Thresholds

Both are environment-tunable in `backend/.env`:

```env
PAYOUT_SELF_APPROVE_LIMIT=5000     # a payout above this waits for the Admin
MAX_STAFF_DISCOUNT_PERCENT=20      # a discount above this needs the Admin
```

---

## 1. MongoDB Atlas Setup
1. Create a MongoDB Atlas cluster at [cloud.mongodb.com](https://cloud.mongodb.com).
2. Go to **Database Access** and create a database user with `readWriteAnyDatabase` privileges.
3. Go to **Network Access** and add your backend production IP address (or `0.0.0.0/0` for cloud platform dynamic IPs).
4. Obtain your connection string: `mongodb+srv://<username>:<password>@<cluster>.mongodb.net/lms_db?retryWrites=true&w=majority`.

---

## 2. Local Setup & Quick Start
```bash
# Clone repository
git clone https://github.com/your-org/lms.git
cd LMS

# Install monorepo dependencies
npm install

# Start Backend Dev Server
cd backend
npm run dev

# Start Frontend Dev Server (in new terminal)
cd frontend
npm run dev
```

---

## 3. Environment Variables Guide

### Backend Environment Variables (`backend/.env`)
```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/lms_db
JWT_SECRET=production_jwt_secret_key_change_in_prod_2026
JWT_REFRESH_SECRET=production_jwt_refresh_secret_key_change_in_prod_2026
CLIENT_URL=http://localhost:3000
PAYOUT_SELF_APPROVE_LIMIT=5000
MAX_STAFF_DISCOUNT_PERCENT=20
EMAIL_API_KEY=your_sendgrid_or_aws_ses_api_key
SMS_API_KEY=your_twilio_or_sms_gateway_key
WHATSAPP_API_KEY=your_whatsapp_business_api_key
```

### Frontend Environment Variables (`frontend/.env`)
```env
VITE_API_URL=http://localhost:5000/api
```

---

## 4. Database Seeding Instructions

To initialise a **fresh** database with departments, the test catalogue, sample
doctors and staff logins:

```bash
cd backend
npm run seed
```

> `seed` wipes every collection, including the counters. Never run it against a
> database holding real patients.

Seeded logins:

| Role | Email | Password |
|---|---|---|
| Admin | `admin@lms.com` | `Admin@123456` |
| Pathologist | `pathologist@lms.com` | `User@123456` |
| Lab Technician | `technician@lms.com` | `User@123456` |
| Receptionist | `receptionist@lms.com` | `User@123456` |

### Migrating an existing database

Run this once against a database that predates the role rework. It is
non-destructive: it promotes any leftover `Super Admin` account to `Admin` (that
role no longer passes validation, so those accounts could not otherwise log in)
and back-fills older expense rows into the payout ledger.

```bash
cd backend
npm run migrate
```

---

## 5. Frontend Deployment (Vercel / Netlify)
### Deploying on Vercel:
1. Connect your repository to Vercel.
2. Set Root Directory to `frontend`.
3. Build Command: `npm run build`.
4. Output Directory: `dist`.
5. Environment Variable: `VITE_API_URL=https://api.yourdomain.com/api`.

---

## 6. Backend Deployment (Railway / Render / VPS)
### Deploying on Render / Railway:
1. Create a Node.js Web Service connected to your repository.
2. Root Directory: `backend`.
3. Build Command: `npm run build`.
4. Start Command: `npm start`.
5. Add all backend environment variables listed in Section 3.

---

## 7. CORS Configuration
In `backend/src/app.ts`, configure origin whitelist:
```typescript
const allowedOrigins = [process.env.CLIENT_URL, 'https://yourdomain.com'];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) callback(null, true);
    else callback(new Error('Blocked by CORS'));
  },
  credentials: true,
}));
```

---

## 8. Production API URL Setup
Ensure `VITE_API_URL` in `frontend/.env` points to your backend domain:
```env
VITE_API_URL=https://api.yourdomain.com/api
```

---

## 9. Custom Domain Configuration
- Frontend: Point CNAME record `@` or `app.yourdomain.com` to Vercel/Netlify.
- Backend: Point A or CNAME record `api.yourdomain.com` to backend server.

---

## 10. HTTPS & SSL Security
- Enable SSL (TLS 1.3) via Let's Encrypt or platform certificate manager.
- Backend implements `helmet` HTTP headers and `express-rate-limit` for DDoS protection.

---

## 11. Backup Strategy
### Automated Daily MongoDB Atlas Backups:
- Enable Continuous Cloud Backups in MongoDB Atlas console (7-day retention).

### Manual Database Export (`mongodump`):
```bash
mongodump --uri="mongodb+srv://<username>:<password>@cluster.mongodb.net/lms_db" --out=./backups/$(date +%Y-%m-%d)
```


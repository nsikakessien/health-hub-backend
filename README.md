# Health Hub Backend

This backend service is an Express + TypeScript API for the Health Hub application. It uses Prisma with the Neon serverless adapter for PostgreSQL, JWT authentication, and role-based route protection.

## Features

- User authentication: register, login, profile retrieval
- JWT-based authentication middleware
- Role-based authorization for protected routes
- Appointments management (`health-schedule`)
- Lab order management (`lab-connect`)
- Prescription retrieval (`pharma-desk`)
- Serverless-ready Neon database adapter via Prisma

## Requirements

- Node.js 20+ (or compatible LTS)
- npm
- PostgreSQL-compatible database with a valid `DATABASE_URL`
- `JWT_SECRET` for signing tokens

## Getting Started

### 1. Install dependencies

```bash
cd backend
npm install
```

### 2. Configure environment variables

Create a `.env` file in the `backend` folder with at least:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE"
JWT_SECRET="your-jwt-secret"
NODE_ENV=development
PORT=5000
```

### 3. Initialize Prisma

Generate the Prisma client and sync the schema to the database:

```bash
npm run build
```

If you only need to push schema changes without building the app, run:

```bash
npm run db:push
```

### 4. Run in development

```bash
npm run dev
```

The server will start on `http://localhost:5000` by default.

### 5. Start production build

```bash
npm run build
npm start
```

## Project Structure

- `package.json` - scripts and dependencies
- `tsconfig.json` - TypeScript compiler configuration
- `prisma/schema.prisma` - database schema and Prisma generator
- `src/db.ts` - Prisma client setup with Neon adapter
- `src/server.ts` - Express application and API routes
- `src/middleware/auth.ts` - JWT authentication and role guard middleware

## API Routes

### Auth

- `POST /api/auth/register`
  - Request body: `{ email, password, name, role? }`
  - Creates a user and returns a JWT token

- `POST /api/auth/login`
  - Request body: `{ email, password }`
  - Returns JWT token and user info

- `GET /api/auth/me`
  - Requires `Authorization: Bearer <token>`
  - Returns current authenticated user data

### HealthSchedule

- `GET /api/health-schedule`
  - Protected route
  - Patients see their own appointments
  - Doctors/Admins see all appointments

- `POST /api/health-schedule`
  - Protected route, allowed roles: `PATIENT`, `DOCTOR`
  - Request body: `{ date, time, department, patientId? }`
  - Patients create appointments for themselves; doctors can specify `patientId`

### LabConnect

- `GET /api/lab-connect`
  - Protected route
  - Patients see their own lab orders
  - Doctors/Admins see all lab orders

- `POST /api/lab-connect`
  - Protected route, allowed role: `DOCTOR`
  - Request body: `{ testType, patientId }`
  - Creates a new lab order for the specified patient

### PharmaDesk

- `GET /api/pharma-desk`
  - Protected route, allowed roles: `PHARMACIST`, `DOCTOR`, `ADMIN`
  - Returns prescriptions with patient info

## Database Schema

Key models in `prisma/schema.prisma`:

- `User` - authenticated users with role and credentials
- `Appointment` - patient appointments and department scheduling
- `LabOrder` - lab test requests and patient relationships
- `Prescription` - medication orders for patients

## Environment Variables

- `DATABASE_URL` - Prisma/PostgreSQL connection string
- `JWT_SECRET` - secret for signing JWT tokens
- `PORT` - optional server port (default: `5000`)
- `NODE_ENV` - optional environment mode

## Notes

- This service uses `@neondatabase/serverless` and `@prisma/adapter-neon`, so the database connection is optimized for serverless Neon deployments.
- The backend currently exports the Express app and only starts listening in non-production mode. In production, use the compiled `dist/server.js` entrypoint.
- Ensure `JWT_SECRET` is kept secure in production.

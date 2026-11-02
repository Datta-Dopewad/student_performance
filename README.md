# Student Performance System

The dashboard can run on Render as a Node web service and uses MongoDB Atlas for persistent data.

## Setup

- Node.js 20+
- MongoDB Atlas database user with `readWrite` on `student_performanceDB`
- Render environment variables `MONGODB_URI`, `MONGODB_DB=student_performanceDB`, and `SESSION_SECRET` (at least 32 random bytes)
- Optional `APP_ORIGIN` set to the exact production URL; leave unset if preview deployments also need sign-in

Put secrets only in Render Environment settings or a protected local `.env.local`. Never commit real values or expose them to browser code. The Atlas URI must use TLS and the restricted app database user, not an Atlas project owner credential.

## Database initialization and account signup

1. Provision an isolated Atlas cluster and a database user limited to `readWrite` on `student_performanceDB`.
2. Set `MONGODB_URI`, `MONGODB_DB`, and `SESSION_SECRET` locally in a protected shell or local environment file.
3. Run `npm install`, then `npm run db:migrate`. This repeatable command creates collections, document validators, indexes, and a schema version record.
4. Open the public sign-up form to create a school workspace and its first administrator. Each signup creates a separate school tenant with starter classes and subjects. The administrator is signed in immediately.
5. If you prefer to provision an account manually, set `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` (at least 12 characters), and `SCHOOL_NAME` only in a protected shell, then run `npm run admin:create`.
6. No production sample students are created. The application is ready for manual entry or validated CSV import after the admin signs in.

The school admin can add teachers and viewers from Settings. Public signup does not verify email ownership; invitation email and password reset are not configured.

## Roles and API

- `school_admin`: school settings, accounts, classes/subjects, student records, imports, reports, predictions.
- `teacher`: student records, imports, reports, predictions.
- `viewer`: read-only records and reports.

Endpoints: `/api/auth/{me,login,logout,signup}`, `/api/students`, `/api/students/:id`, `/api/classes`, `/api/subjects`, `/api/assessments`, `/api/users`, `/api/settings`, `/api/dashboard`, `/api/reports`, `/api/predictions`, `/api/imports`, and `/api/lookups`.

Documents carry `schoolId`; every read/write query scopes to the authenticated account's school. Student deletion archives records. Assessments and prediction snapshots are retained. CSV import validates on the server and inserts accepted records in a transaction before returning per-row rejections. Exports and account/data changes are audit logged.

## Security and privacy

Passwords use Node scrypt hashes. Sessions use opaque random tokens stored as SHA-256 hashes, HttpOnly/SameSite cookies, 12-hour expiry, CSRF double-submit checks, and same-origin checks. Login errors are generic and hashed identifiers are rate-limited. Database errors are not returned to clients and request data/secrets are not logged. No student data is sent to an AI service.

Student records are sensitive education data. Restrict Atlas and Vercel project membership, use a least-privilege database user, enable Atlas backups appropriate to the school's policy, and document retention/export procedures before importing real records. The demo predictor is an illustrative heuristic; no confidence is reported.

## Checks and deployment

- `npm run check` validates server JavaScript syntax.
- `npm audit` checks package advisories.
- `npm run dev` starts the Vercel local runtime (Vercel CLI is fetched through `npx`).
- Set the production environment variables, run the migration from an authorized secure environment, provision the first administrator, then deploy the existing Vercel project.

The app has no local development seed data by default. Do not point a development seed or test import at production data.

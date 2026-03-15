# Anthology CRM

## Overview

Mobile-first CRM app for a solo founder/small team. Built with Expo (React Native) for iOS, Express API server with PostgreSQL, integrated with Gmail (sending) and Notion (one-way sync). Multi-user support with password authentication, role-based access, and admin user management.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Mobile framework**: Expo SDK 54 with React Native
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **State management**: TanStack React Query
- **Integrations**: Gmail (via googleapis), Notion (via @replit/connectors-sdk), Google Calendar (via googleapis)
- **Auth**: bcryptjs for password hashing, session-based auth with Bearer tokens

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── mobile/                # Expo React Native app (iOS-first)
│   │   ├── app/(tabs)/        # Tab screens: Dashboard, Funnel, Contacts, Calendar, Comms
│   │   ├── app/lead/[id].tsx  # Lead detail screen
│   │   ├── app/contact/[id].tsx # Contact detail screen
│   │   ├── app/compose-email.tsx # Email composer with template support
│   │   ├── app/template/[id].tsx # Template editor (create/edit)
│   │   ├── app/sequence/[id].tsx # Drip sequence editor
│   │   ├── app/broadcast/new.tsx # Broadcast wizard (4-step)
│   │   ├── app/settings.tsx   # Settings + profile + admin user management
│   │   ├── constants/colors.ts # Brand colors (#000000 primary, #BB935B accent)
│   │   ├── constants/api.ts   # API base URL config
│   │   ├── lib/api.ts         # All API client methods (incl. profile, password, admin)
│   │   ├── lib/auth.tsx       # Auth provider with login/register/logout/refreshUser
│   │   └── components/LoginScreen.tsx # Login/Register screen with password
│   ├── api-server/            # Express API server
│   │   ├── src/routes/        # leads, contacts, activities, templates, sequences, broadcasts, triggers, settings, dashboard, email, calendar, auth, admin
│   │   ├── src/middlewares/authMiddleware.ts  # Session auth + live DB user check
│   │   ├── src/middlewares/requireAuth.ts     # Auth gate middleware
│   │   ├── src/middlewares/requireAdmin.ts    # Admin role guard
│   │   ├── src/lib/gmail.ts   # Gmail send via googleapis
│   │   ├── src/lib/calendar.ts # Google Calendar client via googleapis
│   │   ├── src/lib/notion.ts  # Notion sync via connectors-sdk
│   │   ├── src/lib/notionSync.ts # Fire-and-forget Notion sync helpers
│   │   ├── src/lib/dripWorker.ts # Background drip sequence email worker (60s interval)
│   │   ├── src/lib/seed.ts    # Per-user default settings seeder
│   │   └── src/lib/auth.ts    # Session management (create/get/delete)
│   └── mockup-sandbox/        # Component preview server
├── lib/
│   ├── api-spec/              # OpenAPI spec + Orval codegen
│   ├── api-client-react/      # Generated React Query hooks
│   ├── api-zod/               # Generated Zod schemas
│   └── db/                    # Drizzle ORM schema + DB
│       └── src/schema/        # leads, contacts, activities, emailTemplates, dripSequences, broadcasts, triggerRules, settings, calendarEvents, auth (users+sessions)
├── scripts/
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── package.json
```

## Key Features

### Horizon Funnel (Lead Tracking)
- Kanban view (horizontal scroll) + list view toggle
- Stages: new → contacted → interested → engaged → converted
- Swipe gestures to advance/retreat status (PanResponder + haptics)
- Beta tag (boolean) with counter showing filled/total (configurable in Settings)
- Lead detail: status changes, beta toggle, notes, email composer, LinkedIn logging, sequence enrollment

### Business Connections (Contacts)
- All contacts + follow-up queue tabs
- Relationship types: investor, partner, advisor, vendor, press, other
- Priority levels: high, medium, low
- Mark as contacted (auto-schedules 7-day follow-up)
- Contact detail: call, email, LinkedIn, activity history, sequence enrollment

### Communications Hub
- **Templates**: Reusable email templates with merge tags ({{first_name}}, {{company_name}}, {{founder_name}})
- **Sequences**: Multi-step drip email flows with configurable delays per step
- **Broadcasts**: 4-step wizard (select segment → choose template → preview recipients → confirm & send)

### Dashboard
- Stats: total leads, this week, contacts, emails sent, follow-ups due, beta filled
- Beta slots progress bar (filled/total)
- Follow-up queue quick access

### Settings
- **Profile**: Edit first/last name, view email and role badge
- **Change Password**: Current password required, min 6 characters
- **General**: app name, founder name, beta slot total
- **Integration status**: Gmail + Notion
- **Notion Sync**: configurable database IDs for leads, contacts, and activities
- **Trigger rules**: auto-actions when lead status changes (enroll in sequence, schedule follow-up)
- **User Management** (admin only): List users, create users, toggle roles, enable/disable accounts
- **Merge tag reference**

## Authentication

- **Password-based auth** — email + password login and registration
- Passwords hashed with bcryptjs (12 rounds)
- Mobile flow: email + password → `POST /api/auth/login` → session token stored in `expo-secure-store`
- Auth middleware checks live DB state on every request (role, isActive) — no stale sessions
- `userId` stripped from all client payloads to prevent ownership tampering
- `AuthProvider` wraps the app in `_layout.tsx`, `AuthGate` shows login screen if not authenticated
- Login screen at `components/LoginScreen.tsx` — email/password inputs with login/register toggle
- First registered user is a regular user — admin must be set via DB or existing admin
- Sessions stored in PostgreSQL (`sessions` table), users in `users` table with passwordHash, role, isActive

### Auth Endpoints
- `GET /api/auth/user` — current user state
- `POST /api/auth/register` — create account (email + password, optional firstName/lastName)
- `POST /api/auth/login` — password login (creates session, returns `{ token, user }`)
- `PUT /api/auth/profile` — update firstName, lastName, profileImageUrl (refreshes session)
- `PUT /api/auth/password` — change password (requires currentPassword if one exists)
- `GET /api/logout` — clear session + redirect to `/`
- `POST /api/mobile-auth/logout` — mobile logout

### Admin Endpoints (admin role required)
- `GET /api/admin/users` — list all users
- `POST /api/admin/users` — create user (email, password, firstName, lastName, role)
- `PUT /api/admin/users/:id` — update role/isActive (cannot self-demote or self-disable)

### User Roles
- `user` — standard access to own data
- `admin` — full access + user management

### Multi-User Data Scoping
All CRM data is scoped by `userId` column:
- leads, contacts, activities, email_templates, drip_sequences, broadcasts, trigger_rules, app_settings, calendar_events
- Settings keyed by `(key, userId)` pair — no global unique constraint on key
- Default settings seeded per-user on registration

## Audit Trail & Revision History

- **audit_log** table stores every CUD operation with: entityType, entityId, action, userId, beforeSnapshot (JSONB), afterSnapshot (JSONB), createdAt
- Indexed on (entityType, entityId), userId, and createdAt for fast lookups
- Fire-and-forget `logAudit()` helper in `src/lib/audit.ts` — non-blocking, catches its own errors
- Every create/update/delete in leads, contacts, templates, sequences, calendar events, settings, triggers, and broadcasts logs an audit entry
- Updates/deletes capture the before-state by reading the record first
- History API: `GET /api/history/:entityType/:entityId` — returns audit entries with user names, supports limit/offset pagination
- Rollback API: `POST /api/history/:entityType/:entityId/rollback/:revisionId` — restores record to pre-change state, logs the rollback itself as a new audit entry
- Mobile: Lead and contact detail screens have a clock icon to open a History modal showing the revision timeline; tapping an entry reveals before/after snapshots; "Restore this version" button with confirmation alert

## Database Schema

Tables: leads (with is_beta, userId), contacts (userId), activities (userId), email_templates (userId), drip_sequences (userId), drip_sequence_steps, drip_enrollments, broadcasts (userId), trigger_rules (userId), app_settings (key+userId), sessions, users (passwordHash, role, isActive, needsPasswordReset), calendar_events (userId), audit_log

## Design

- **Colors**: Black primary (#000000), SA Gold accent (#BB935B), White background (#FFFFFF), textSecondary (#666666), textTertiary (#767676) — all WCAG AA compliant
- **Typography**: Multi-font brand system — Lato (titles), League Spartan (headings/buttons), Montserrat (subtitles/captions), Space Grotesk (body text)
- **Brand Voice**: Founder-to-founder, direct, no fluff. Earned empathy, clarity over polish, confidence without arrogance, functional optimism. Peer register (we/you). NOT corporate, NOT startup-bro hype, NOT patronizing. One-liner: "Straight-talking, founder-built confidence — for the people doing the actual work."
- **Navigation**: NativeTabs with liquid glass on iOS 26+, classic blur tabs fallback
- **Icons**: SF Symbols on iOS, Feather icons on web/Android
- **Tab bar**: 5 tabs — Dashboard, Funnel, Contacts, Calendar, Comms

## API Endpoints

All mounted at `/api`, all CRM endpoints require auth and scope by userId:
- `GET/POST /leads`, `GET/PUT/DELETE /leads/:id`, `PATCH /leads/:id/status`
- `GET/POST /contacts`, `GET /contacts/follow-ups`, `GET/PUT/DELETE /contacts/:id`, `POST /contacts/:id/mark-contacted`
- `GET/POST /activities`
- `GET/POST /templates`, `GET/PUT/DELETE /templates/:id`
- `GET/POST /sequences`, `GET/PUT/DELETE /sequences/:id`, `POST /sequences/:id/steps`, `POST /sequences/:id/enroll`
- `GET/POST /broadcasts`, `GET /broadcast-preview`
- `GET/POST/DELETE /triggers`
- `GET/PUT /settings`
- `GET /dashboard`
- `POST /email/send`
- `GET/POST /calendar/events`, `DELETE /calendar/events/:id`
- Auth: `POST /auth/register`, `POST /auth/login`, `PUT /auth/profile`, `PUT /auth/password`
- Admin: `GET/POST /admin/users`, `PUT /admin/users/:id`
- Audit: `GET /history/:entityType/:entityId`, `POST /history/:entityType/:entityId/rollback/:revisionId`

## Gmail Integration

Connection ID: `conn_google-mail_01KKQYC5ZK0BWADJWDAWCZDHM0`
Uses `getUncachableGmailClient()` pattern — never cache the OAuth client.

## Google Calendar Integration

Connection ID: `conn_google-calendar_01KKR2MGZF170P7X5CN0DSXS9B`
Uses dynamic token refresh via Replit Connectors API. Never caches the client — calls `getUncachableGoogleCalendarClient()` each time.
Calendar events are stored locally in `calendar_events` table and synced to Google Calendar on create/delete.
Events can be linked to leads or contacts. Email sends can optionally log to calendar.

## Notion Integration

Connection ID: `conn_notion_01KKQYFGA5AE7WTYAEPM4YNB09`
Uses `connectors.proxy("notion", "/v1/...")` pattern from `@replit/connectors-sdk`.
One-way sync: app → Notion for leads, contacts, and activities.
Sync is fire-and-forget (non-blocking) via `notionSync.ts` helpers.
Triggered on: lead create/update/status-change, contact create/update, activity create, email send, broadcast send.
Notion database IDs configured in Settings: `notion_leads_db`, `notion_contacts_db`, `notion_activities_db`.

## Drip Sequence Worker

Background `setInterval` worker (60s) in `dripWorker.ts`.
Processes active enrollments where `nextSendAt <= now`.
Looks up sequence step → template → recipient, performs merge tag replacement, sends via Gmail, logs activity, advances enrollment.
Marks enrollment `completed` when all steps done, `error` if recipient/template missing.
Started automatically on server boot.

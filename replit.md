# Fiesta

## Overview

Mobile-first CRM app for a solo founder/small team. Built with Expo (React Native) for iOS, Express API server with PostgreSQL, integrated with Gmail (sending) and Notion (one-way sync). Multi-user support with Replit OAuth (OpenID Connect with PKCE), role-based access, admin 2FA (TOTP or email), and admin panel with user management and data export/import.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Mobile framework**: Expo SDK 54 with React Native
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod, `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **State management**: TanStack React Query
- **Integrations**: Gmail (via googleapis), Notion (via @replit/connectors-sdk), Google Calendar (via googleapis), OpenAI (via Replit AI proxy)
- **Auth**: Replit OAuth (OIDC with PKCE via openid-client v6), session-based auth with Bearer tokens, admin 2FA via otpauth (TOTP) or email codes

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── mobile/                # Expo React Native app (iOS-first)
│   │   ├── app/(tabs)/        # Tab screens: Dashboard, Funnel, Contacts, Calendar, Comms, AI
│   │   ├── app/lead/[id].tsx  # Lead detail screen
│   │   ├── app/contact/[id].tsx # Contact detail screen
│   │   ├── app/compose-email.tsx # Email composer with template support
│   │   ├── app/template/[id].tsx # Template editor (create/edit)
│   │   ├── app/sequence/[id].tsx # Drip sequence editor
│   │   ├── app/broadcast/new.tsx # Broadcast wizard (4-step)
│   │   ├── app/settings.tsx   # Settings + profile + admin user management
│   │   ├── constants/colors.ts # Brand colors (#000000 primary, #BB935B accent)
│   │   ├── constants/layout.ts # Layout constants (spacing, radius, elevation)
│   │   ├── constants/crm.ts   # Shared CRM constants (statuses, priorities, relationship types, colors)
│   │   ├── constants/api.ts   # API base URL config
│   │   ├── components/HistoryModal.tsx     # Shared revision history modal
│   │   ├── components/ActivityList.tsx     # Shared activity timeline component
│   │   ├── components/LinkedInLogModal.tsx # Shared LinkedIn message log modal
│   │   ├── components/ProfilePicModal.tsx  # Shared profile picture upload modal
│   │   ├── components/ErrorBoundary.tsx    # Error boundary wrapper
│   │   ├── components/ErrorFallback.tsx    # Error fallback UI
│   │   ├── components/LoginScreen.tsx      # Login/Register screen
│   │   ├── lib/api.ts         # All API client methods (incl. profile, password, admin)
│   │   └── lib/auth.tsx       # Auth provider with login/register/logout/refreshUser
│   ├── api-server/            # Express API server
│   │   ├── src/routes/        # leads, contacts, activities, templates, sequences, broadcasts, triggers, settings, dashboard, email, calendar, auth, admin, ai
│   │   ├── src/middlewares/authMiddleware.ts  # Session auth + live DB user check
│   │   ├── src/middlewares/requireAuth.ts     # Auth gate middleware
│   │   ├── src/middlewares/requireAdmin.ts    # Admin role guard
│   │   ├── src/lib/errors.ts  # AppError, notFound, badRequest, parseIntParam, errorHandler
│   │   ├── src/lib/validation.ts # Zod schemas for all entities, validate() helper
│   │   ├── src/lib/crud.ts    # findOwned() ownership-scoped record lookup
│   │   ├── src/lib/gmail.ts   # Gmail send via googleapis
│   │   ├── src/lib/calendar.ts # Google Calendar client via googleapis
│   │   ├── src/lib/notion.ts  # Notion sync via connectors-sdk
│   │   ├── src/lib/notionSync.ts # Fire-and-forget Notion sync helpers
│   │   ├── src/lib/ai/          # AI agent team (Coach/Cleo/Miles)
│   │   │   ├── agentDefinitions.ts  # Agent system prompts and tool schemas
│   │   │   ├── orchestrator.ts      # Chat orchestration (classify→route→stream)
│   │   │   ├── toolExecutor.ts      # CRM tool execution for agents
│   │   │   └── insightWorker.ts     # Background daily insight generation
│   │   ├── src/lib/dripWorker.ts # Background drip sequence email worker (60s interval, row-level locking)
│   │   ├── src/lib/audit.ts   # Fire-and-forget audit trail logger
│   │   ├── src/lib/seed.ts    # Per-user default settings seeder
│   │   ├── src/lib/auth.ts    # Session management (create/get/delete)
│   │   └── src/app.ts         # Express app with centralized errorHandler middleware
│   └── mockup-sandbox/        # Component preview server
├── lib/
│   ├── api-spec/              # OpenAPI spec + Orval codegen
│   ├── api-client-react/      # Generated React Query hooks
│   ├── api-zod/               # Generated Zod schemas
│   └── db/                    # Drizzle ORM schema + DB
│       └── src/schema/        # leads, contacts, activities, emailTemplates, dripSequences, broadcasts, triggerRules, settings, calendarEvents, auth (users+sessions), agentRegistry, aiInsights, conversations, messages, onboardingProgress
├── scripts/
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── package.json
```

## Key Patterns

### Error Handling (API)
- `AppError(statusCode, msg)` for operational errors; thrown in routes, caught by centralized `errorHandler` in `app.ts`
- `ValidationError` from Zod failures via `validate()` helper
- Real error details logged server-side only; generic "Internal server error" sent to client for 500s
- `parseIntParam(val, name)` validates numeric URL params; throws 400 on non-integer
- `findOwned(table, id, userId)` looks up a record scoped by ownership; throws 404 if missing

### Input Validation (API)
- All mutating endpoints use `validate(schema, body)` with Zod schemas defined in `validation.ts`
- Schemas: `createLeadSchema`, `updateLeadSchema`, `updateStatusSchema`, `createContactSchema`, `updateContactSchema`, `createActivitySchema`, `createTemplateSchema`, `updateTemplateSchema`, `createSequenceSchema`, `updateSequenceSchema`, `addStepSchema`, `enrollSchema`, `createBroadcastSchema`, `sendEmailSchema`, `createCalendarEventSchema`, `createTriggerSchema`

### Drip Worker (Row-Level Locking)
- Uses `lockedAt` column on `drip_enrollments` for row-level locking
- `tryLockEnrollment()` acquires lock; `unlockEnrollment()` releases it
- Stale lock timeout: 5 minutes (LOCK_TIMEOUT_MS)
- `isProcessing` flag as secondary guard against concurrent workers

### AI Agent Team (Coach/Cleo/Miles)
- Three-agent system using master/apprentice model via OpenAI (Replit proxy)
- **Coach**: Main agent users interact with; orchestrates Cleo and Miles
- **Cleo** (Relationship Manager): Handles contact/lead relationship queries via CRM tools
- **Miles** (Strategy Advisor): Handles pipeline strategy, follow-up planning
- Models: `gpt-5.2` (main agents), `gpt-5-nano` (routing classification), `gpt-5-mini` (insight framing)
- Streaming SSE responses for chat; conversation history persisted in DB
- Background insight worker runs daily, generates AI insights per user
- Rate-limited insight generation endpoint (5min cooldown per user)
- DB tables: `conversations`, `messages`, `ai_insights`, `onboarding_progress`
- Mobile: AI chat tab, dashboard AiInsightCards, lead/contact detail AiAlertBanner
- Agent branding accent color: `#BB935B`

### Mobile Shared Components
- `ActivityDetailModal` — view/edit activity details (type, subject, body, notes) in a popup modal
- `EventDetailModal` — view/edit calendar event details (title, times, type, description) in a popup modal
- `HistoryModal` — revision history with snapshot viewer and rollback
- `ActivityList` — activity timeline with type-based dot colors
- `LinkedInLogModal` — log LinkedIn messages with subject/message
- `ProfilePicModal` — upload or paste URL for profile pictures
- All use `useCallback` for handler memoization

### Mobile Constants (crm.ts)
- `LEAD_STATUSES`, `STATUS_LABELS`, `STATUS_COLORS` — lead pipeline constants
- `LEAD_SOURCES` — lead source options
- `REL_TYPES`, `REL_COLORS` — relationship type constants
- `PRIORITIES`, `PRIORITY_COLORS` — priority level constants
- `ACTION_LABELS`, `ACTION_COLORS` — audit action display constants

## Key Features

### Horizon Funnel (Lead Tracking)
- Kanban view (horizontal scroll) + list view toggle
- Stages: new → contacted → interested → engaged → converted
- Swipe gestures to advance/retreat status (PanResponder + haptics)
- Beta tag (boolean) with counter showing filled/total (configurable in Settings)
- Lead detail: status changes, beta toggle, notes (with activity logging), inline field editing, email composer, LinkedIn message form, file attachments, profile pictures, LinkedIn URL, Gmail deep links on activities, sequence enrollment

### Business Connections (Contacts)
- All contacts + follow-up queue tabs
- Relationship types: investor, partner, advisor, vendor, press, other
- Priority levels: high, medium, low
- Mark as contacted (auto-schedules 7-day follow-up)
- Contact detail: call, email, LinkedIn, activity history, inline field editing, LinkedIn message form, file attachments, profile pictures, notes activity logging, Gmail deep links, sequence enrollment
- **File Library**: Upload, view, and manage reusable files (pitch decks, one-pagers). Files can be attached to leads/contacts and used as email attachments.
- **Email attachments**: Attach files from library or recipient's files when composing emails. Sent as standard MIME attachments via Gmail.
- **Email tracking**: Gmail message/thread IDs captured on sent emails. Gmail push notification webhook for reply detection on tracked threads. Deep links to open emails directly in Gmail.
- **Object Storage**: Replit object storage (GCS-backed) for file uploads and profile pictures

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

Tables: leads (with is_beta, linkedinUrl, profilePictureUrl, userId), contacts (profilePictureUrl, userId), activities (gmailMessageId, gmailThreadId, gmailLink, userId), email_templates (userId), drip_sequences (userId), drip_sequence_steps, drip_enrollments (lockedAt for row locking), broadcasts (userId), trigger_rules (userId), app_settings (key+userId unique), sessions, users (passwordHash, role, isActive, needsPasswordReset), calendar_events (userId), files (name, mimeType, size, storageKey, userId), lead_files (leadId+fileId unique), contact_files (contactId+fileId unique), audit_log

### Database Indexes
- userId indexes on all user-scoped tables
- FK constraint indexes on join tables
- Unique constraints: settings (key+userId), lead_files (leadId+fileId), contact_files (contactId+fileId)
- Audit log indexed on (entityType+entityId), userId, createdAt

## Design

- **Colors**: Black primary (#000000), SA Gold accent (#BB935B), White background (#FFFFFF), textSecondary (#666666), textTertiary (#767676) — all WCAG AA compliant
- **Typography**: Multi-font brand system — Lato (titles), League Spartan (headings/buttons), Montserrat (subtitles/captions), Space Grotesk (body text)
- **Brand Voice**: Founder-to-founder, direct, no fluff. Earned empathy, clarity over polish, confidence without arrogance, functional optimism. Peer register (we/you). NOT corporate, NOT startup-bro hype, NOT patronizing. One-liner: "Straight-talking, founder-built confidence — for the people doing the actual work."
- **Navigation**: NativeTabs with liquid glass on iOS 26+, classic blur tabs fallback
- **Icons**: SF Symbols on iOS, Feather icons on web/Android
- **Tab bar**: 6 tabs — Dashboard, Funnel, Contacts, Calendar, Files, Comms

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
- `POST /email/send` (supports attachmentFileIds)
- `GET/POST/DELETE /files`, `POST /files/upload`
- `GET/POST/DELETE /leads/:id/files`, `GET/POST/DELETE /contacts/:id/files`
- `POST /storage/uploads/request-url`, `GET /storage/objects/*`, `GET /storage/public-objects/*`
- `POST /gmail/webhook`, `POST /gmail/watch`, `GET /gmail/profile`
- `POST /horizon/sync` (pull sync from Horizon — imports users as leads, contact submissions as contacts)
- `GET/POST /calendar/events`, `DELETE /calendar/events/:id`
- Auth: `POST /auth/register`, `POST /auth/login`, `PUT /auth/profile`, `PUT /auth/password`
- Admin: `GET/POST /admin/users`, `PUT /admin/users/:id`
- Audit History: `GET /history/:entityType/:entityId` (also `GET /:entityType/:id/history`)
- Audit Rollback: `POST /history/:entityType/:entityId/rollback/:revisionId` (also `POST /:entityType/:id/rollback/:revisionId`)
- Canonical entityType values: lead, contact, template, sequence, sequence_step, calendar_event, trigger, broadcast, setting (plural aliases also accepted)
- Audit action values: create, update, delete, rollback

## Gmail Integration

Connection ID: `conn_google-mail_01KKQYC5ZK0BWADJWDAWCZDHM0`
Uses `getUncachableGmailClient()` pattern — never cache the OAuth client.
Supports multipart MIME attachments, returns message/thread IDs.
Gmail push notifications via Pub/Sub watch for tracking replies on app-initiated threads.
Watch renewal needed every 7 days.

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
Uses row-level locking via `lockedAt` column (5-minute stale lock timeout).
Looks up sequence step → template → recipient, performs merge tag replacement, sends via Gmail, logs activity, advances enrollment.
Marks enrollment `completed` when all steps done, `error` if recipient/template missing.
Started automatically on server boot.

## Settings Format

PUT `/api/settings` accepts flat `{ "key": "value" }` object, NOT `{ settings: [{key, value}] }`.

## Test Users

- Admin: `founder@startupanthology.com` / `changeme123`
- Test: `testuser@debug.com` / `test123`

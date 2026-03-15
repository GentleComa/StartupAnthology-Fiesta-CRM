# Anthology CRM

## Overview

Mobile-first CRM app for a solo founder/small team. Built with Expo (React Native) for iOS, Express API server with PostgreSQL, integrated with Gmail (sending) and Notion (one-way sync).

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
- **Integrations**: Gmail (via googleapis), Notion (via @replit/connectors-sdk)

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── mobile/                # Expo React Native app (iOS-first)
│   │   ├── app/(tabs)/        # Tab screens: Dashboard, Funnel, Contacts, Comms
│   │   ├── app/lead/[id].tsx  # Lead detail screen
│   │   ├── app/contact/[id].tsx # Contact detail screen
│   │   ├── app/compose-email.tsx # Email composer with template support
│   │   ├── app/template/[id].tsx # Template editor (create/edit)
│   │   ├── app/sequence/[id].tsx # Drip sequence editor
│   │   ├── app/broadcast/new.tsx # Broadcast wizard (4-step)
│   │   ├── app/settings.tsx   # Settings + trigger rules
│   │   ├── constants/colors.ts # Navy/gold theme (#1B2B4B, #D4A843)
│   │   ├── constants/api.ts   # API base URL config
│   │   └── lib/api.ts         # All API client methods
│   ├── api-server/            # Express API server
│   │   ├── src/routes/        # leads, contacts, activities, templates, sequences, broadcasts, triggers, settings, dashboard, email
│   │   ├── src/lib/gmail.ts   # Gmail send via googleapis
│   │   ├── src/lib/notion.ts  # Notion sync via connectors-sdk
│   │   └── src/lib/seed.ts    # Default settings seeder
│   └── mockup-sandbox/        # Component preview server
├── lib/
│   ├── api-spec/              # OpenAPI spec + Orval codegen
│   ├── api-client-react/      # Generated React Query hooks
│   ├── api-zod/               # Generated Zod schemas
│   └── db/                    # Drizzle ORM schema + DB
│       └── src/schema/        # leads, contacts, activities, emailTemplates, dripSequences, broadcasts, triggerRules, settings
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
- General: app name, founder name, beta slot total
- Integration status: Gmail + Notion
- Trigger rules: auto-actions when lead status changes (enroll in sequence, schedule follow-up)
- Merge tag reference

## Authentication

- **Replit Auth** via OpenID Connect with PKCE
- Mobile flow: `expo-auth-session` → OIDC provider → auth code → token exchange via `POST /api/mobile-auth/token-exchange` → session token stored in `expo-secure-store`
- Auth middleware runs on every request, loads user from session
- `AuthProvider` wraps the app in `_layout.tsx`, `AuthGate` shows login screen if not authenticated
- Login screen at `components/LoginScreen.tsx`
- Logout button in Settings screen with confirmation alert
- Sessions stored in PostgreSQL (`sessions` table), users in `users` table

### Auth Endpoints
- `GET /api/auth/user` — current user state
- `GET /api/login` — browser OIDC login flow
- `GET /api/callback` — OIDC callback
- `GET /api/logout` — clear session + OIDC logout
- `POST /api/mobile-auth/token-exchange` — mobile auth code exchange
- `POST /api/mobile-auth/logout` — mobile logout

## Database Schema

Tables: leads (with is_beta), contacts, activities, email_templates, drip_sequences, drip_sequence_steps, drip_enrollments, broadcasts, trigger_rules, app_settings, sessions, users

## Design

- **Colors**: Black primary (#000000), SA Gold accent (#BB935B), White background (#FFFFFF), Grey (#999999)
- **Typography**: Multi-font brand system — Lato (titles), League Spartan (headings/buttons), Montserrat (subtitles/captions), Space Grotesk (body text)
- **Brand Voice**: Founder-to-founder, direct, no fluff. Earned empathy, clarity over polish, confidence without arrogance, functional optimism. Peer register (we/you). NOT corporate, NOT startup-bro hype, NOT patronizing. One-liner: "Straight-talking, founder-built confidence — for the people doing the actual work."
- **Navigation**: NativeTabs with liquid glass on iOS 26+, classic blur tabs fallback
- **Icons**: SF Symbols on iOS, Feather icons on web/Android
- **Tab bar**: 4 tabs — Dashboard, Funnel, Contacts, Comms

## API Endpoints

All mounted at `/api`:
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

## Gmail Integration

Connection ID: `conn_google-mail_01KKQYC5ZK0BWADJWDAWCZDHM0`
Uses `getUncachableGmailClient()` pattern — never cache the OAuth client.

## Notion Integration

Connection ID: `conn_notion_01KKQYFGA5AE7WTYAEPM4YNB09`
Uses `connectors.proxy("notion", "/v1/...")` pattern from `@replit/connectors-sdk`.
One-way sync: app → Notion for leads, contacts, and activities.

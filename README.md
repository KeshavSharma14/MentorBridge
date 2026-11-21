# MentorBridge

MentorBridge is a full-stack MVP for connecting college students with senior mentors.

## Monorepo structure

- `client/` - React, Vite, TypeScript and Tailwind CSS
- `server/` - Express, TypeScript, PostgreSQL and Socket.IO
- `schema.sql` - PostgreSQL tables and sample seed data

## Prerequisites

- Node.js 20+
- A Supabase project with PostgreSQL

## Setup

1. Install dependencies:

   ```bash
   npm install
   npm install --prefix client
   npm install --prefix server
   ```

2. Initialize the database in your Supabase project:

   ```bash
   psql "$SUPABASE_DATABASE_URL" -f schema.sql
   ```

   The SQL can also be pasted into the Supabase SQL Editor.

3. Configure environment variables:

   ```bash
   cp server/.env.example server/.env
   cp client/.env.example client/.env
   ```

   Set the Supabase URL and keys in both applications. Set `CLIENT_URL` in the
   server to the Vite origin, and `VITE_SOCKET_URL` in the client to the API origin.

4. Start both applications:

   ```bash
   npm run dev
   ```

   The client runs at `http://localhost:5173` and the API at `http://localhost:4000`.

## Authentication and API routes

- Supabase Auth uses the browser session access token as `Authorization: Bearer <token>`.
- `GET/PUT /api/profiles/me` loads or creates the authenticated user's dual-portal profile.
- `PATCH /api/profiles/me/privacy` updates the contact-sharing toggle.
- `GET /api/profiles` lists profiles; contact fields are included only for the owner or accepted, sharing-enabled counterparts.
- `GET/POST /api/mentorships` lists and creates mentorship requests.
- `PATCH /api/mentorships/:id` lets the mentor accept or reject a pending request.
- `GET /api/profiles/recommendations` returns top-ranked opposite-role matches using 40% skills, 25% interests, 20% goals, and 15% availability weighting.
- `GET/POST /api/sessions` lists or proposes sessions for accepted mentorship pairs.
- `PATCH /api/sessions/:id/confirm` confirms a proposed session by the counterpart.
- `chat:join`, `chat:leave`, `chat:send`, and `chat:typing` Socket.IO events provide private, persisted mentorship chat.
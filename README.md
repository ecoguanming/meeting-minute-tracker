# Meeting Minute Tracker

A staged meeting-minutes tool (Setup → Attendance → Matters → Dispatch) built with Next.js,
Prisma, and Google Calendar/Gmail.

## Status

This is being built incrementally. Current stage: basic 4-stage UI shell (no database wiring,
no Google sign-in yet — those come next).

## Run locally

```bash
npm install
npx prisma migrate dev
npm run dev
```

Then open http://localhost:3000.

## Stack

- Next.js (App Router)
- Prisma + SQLite locally / Postgres in production
- NextAuth.js (Google provider) for sign-in + Calendar/Gmail access
- Deployed on Vercel

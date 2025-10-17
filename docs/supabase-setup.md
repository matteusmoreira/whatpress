# Supabase Setup for Whatsapp SaaS

This guide helps you connect the app and webhook server to your Supabase project.

## 1) Environment variables

Create a `.env` file at the project root (same folder as `package.json`) with your Supabase credentials:

```
# Frontend (Vite) – Safe to expose in browser
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-anon-key

# Backend (Webhook server) – DO NOT expose service_role in frontend
SUPABASE_URL=your-project-url
SUPABASE_SERVICE_ROLE=your-service-role-key
```

The webhook server loads environment variables via `dotenv/config`.

## 2) Install dependencies

Already installed by the assistant:
- `@supabase/supabase-js`
- `dotenv`

## 3) Create the `webhook_events` table

Run the SQL in Supabase Studio:

1. Open your Supabase project.
2. Go to SQL editor.
3. Paste the contents of `supabase/setup.sql` and execute.

This creates the `public.webhook_events` table and indexes.

## 4) Confirm connection

1. Start the dev servers: `npm run dev:full`.
2. Ensure `.env` is detected. If the webhook server logs a warning like `SUPABASE_URL or SUPABASE_SERVICE_ROLE not set`, double-check the `.env` file path and values.
3. Trigger any webhook event (your local server logs incoming events). They should be inserted into the `webhook_events` table.

## 5) Authentication

The frontend uses Supabase Auth for:
- Login (`useAuth` hook with `signInWithPassword`)
- Logout (`signOut`)
- Registration (`Register` page with `auth.signUp`)

If email confirmation is enabled, sign-up returns `session = null` and the user must confirm via the email link.

## 6) Security notes

- Never expose `SUPABASE_SERVICE_ROLE` to the frontend. Only the server (`webhook-server.js`) uses it.
- RLS is enabled for `webhook_events`. The example policy allows authenticated users to read. Inserts are done by the service role and bypass RLS.

## 7) Troubleshooting

- Vite env variables must start with `VITE_` to be available in the browser.
- Restart `npm run dev:full` after changing `.env`.
- If you see `supabaseUrl is required` in the browser, `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` is missing.
- If the webhook server shows missing env vars, ensure `.env` exists at the project root and that `dotenv/config` is imported at the top of `webhook-server.js`.
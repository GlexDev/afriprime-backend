# Afriprime Backend

Express API for the Afriprime Telegram Mini App.

## Deploy on Render (Web Service)
1. Push this repo to GitHub.
2. Create a new Web Service in Render.
3. Add env vars (see .env.example).
4. Deploy.

## Endpoints
- GET /health
- POST /auth/telegram/validate
- GET /api/profile?initData=...
- POST /api/profile

## Supabase schema
```sql
create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  telegram_id bigint unique not null,
  display_name text,
  age int,
  location text,
  created_at timestamptz default now()
);
```
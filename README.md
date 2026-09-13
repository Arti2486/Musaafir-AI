# Musaafir AI · India trip planner with authentication that works

Full-stack travel planner: **Next.js (App Router) + Drizzle ORM + PostgreSQL + bcrypt + JWT + jsPDF + Web Speech API**.

The AI itinerary generator and the assistant are **retrieval-augmented over your own database only** — every hotel,
entry fee, permit, timing and tip comes from the seeded `destinations.context`, `hotels`, `places` and `tips` rows. No
external model, no invented facts, and every plan lists the rows it used.

```
Demo login    test@gmail.com / 123456        (created automatically by the seed + on first boot)
Knowledge     20 destinations · 63 stays · 119 places · 71 local tips
```

---

## 1. Setup (5 steps)

```bash
# Step 1 - environment
cp .env.example .env
# open .env and set your real connection string, e.g.
#   DATABASE_URL=postgresql://postgres:password@localhost:5432/myapp
#   JWT_SECRET=musaafir-secret-key-12345

# Step 2 - dependencies
npm install

# Step 3 - push the Drizzle schema to PostgreSQL
npx drizzle-kit push

# Step 4 - create tables + seed the knowledge base + the demo user
npm run seed

# Step 5 - run the app
npm run dev
```

Then open <http://localhost:3000> and login with **test@gmail.com / 123456**.

> `npm run seed` is idempotent — run it any time to refresh destinations, hotels, places and tips.
> If you skip steps 3 and 4, the app still self-provisions: `src/instrumentation.ts` and every API route call
> `ensureDatabaseReady()`, which creates the tables, seeds the knowledge base and guarantees the demo login.

### Handy scripts

| Command            | What it does                                                                |
| ------------------ | --------------------------------------------------------------------------- |
| `npm run dev`      | Starts Next.js. Boot logs report `PostgreSQL connected` or the exact fix.    |
| `npm run seed`     | Creates tables, seeds 20 destinations, ensures `test@gmail.com / 123456`.    |
| `npm run db:push`  | Shortcut for `npx drizzle-kit push`.                                         |
| `npm run db:check` | Prints `PostgreSQL connected` or `PostgreSQL not connected - check DATABASE_URL`. |
| `npm run build`    | Production build.                                                            |

---

## 2. Environment variables

| Variable        | Required | Default / example                                              |
| --------------- | -------- | -------------------------------------------------------------- |
| `DATABASE_URL`  | yes      | `postgresql://postgres:password@localhost:5432/myapp`          |
| `JWT_SECRET`    | yes      | `musaafir-secret-key-12345`                                   |
| `JWT_EXPIRES_IN`| no       | `7d`                                                           |

Nothing crashes when `.env` is missing. Instead you get an explicit, greppable message:

```
[DB] PostgreSQL not connected - check DATABASE_URL
[DB] .env is missing DATABASE_URL. Copy .env.example to .env and set:
[DB]   DATABASE_URL=postgresql://postgres:password@localhost:5432/myapp
```

`GET /api/health` returns the same diagnostics as JSON (DB connectivity, user/destination counts, JWT source).

---

## 3. Authentication (the part that used to break)

**Signup — `POST /api/auth/signup`**

```jsonc
// request
{ "name": "Aarav Sharma", "email": "aarav@example.com", "password": "secret123" }
// 201 response
{ "message": "User created", "user": { "id": 2, "name": "Aarav Sharma", "email": "aarav@example.com" }, "token": "…", "nextStep": "Signup successful, please login" }
// 409 response
{ "message": "User already exists" }
```

**Login — `POST /api/auth/login`**

```jsonc
// request
{ "email": "TEST@gmail.com ", "password": "123456" }   // trimmed + lowercased server-side
// 200 response
{ "message": "Login successful", "token": "<jwt, 7d>", "user": { "id": 1, "name": "Test User", "email": "test@gmail.com" }, "expiresIn": "7d" }
// 401 response
{ "message": "Invalid email or password" }
```

Why “Invalid email or password” no longer happens after a successful signup:

1. **Emails are normalised identically everywhere** — `normalizeEmail()` trims + lowercases on signup *and* on login, and
   the lookup uses `WHERE lower(email) = $1`.
2. **Passwords are hashed with bcrypt, 10 salt rounds** (`bcryptjs`, pure JS, no native build failures). Signup `await`s
   the hash before insert; login uses `bcrypt.compare` against the stored hash.
3. **Broken hashes are detected, not silently accepted** — `verifyPassword()` logs and returns `false` if the stored
   value is empty or not a `$2a/$2b/$2y` bcrypt hash, and both the seeder and the boot-time bootstrap *repair* the demo
   user's hash if it is malformed.
4. **Tables always exist before the query runs** — every auth route awaits `ensureDatabaseReady()`, so a skipped
   `drizzle-kit push` can no longer surface as a confusing auth error.
5. **Race-safe uniqueness** — the `users.email` unique constraint is honoured *and* the `23505` unique-violation code is
   caught and translated into `409 User already exists`.
6. **Every failure path is logged** — `[SIGNUP]`, `[LOGIN]`, `[AUTH]`, `[BOOTSTRAP]` lines tell you exactly which step
   failed (user not found vs. hash mismatch vs. token expired).
7. **One secret, one place** — signing and verification both read `JWT_SECRET` through `getJwtSecret()`, so a token can
   never be verified with a different secret than it was signed with.

Session handling on the client: the JWT is stored in `localStorage` under **`musaafir_token`** (mirrored into an
`httpOnly` cookie by the API for convenience), sent as `Authorization: Bearer <token>`, validated by `GET /api/auth/me`,
and cleared by `POST /api/auth/logout`. After signup the browser redirects to `/login?message=signup-success`, which
shows the toast **“Signup successful, please login”**.

---

## 4. Database schema (`src/db/schema.ts`)

| Table           | Columns                                                                                                                                          |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `users`         | `id`, `name`, `email` (unique), `password_hash`, `created_at`                                                                                    |
| `destinations`  | `id`, `slug` (unique), `name`, `state`, `region`, `category`, `best_time`, `budget_per_person`, `rating`, `image`, `tags`, `description`, **`context`** |
| `hotels`        | `id`, `destination_id` → destinations, `name`, `area`, `tier`, `price_per_night`, `rating`, `note`                                                |
| `places`        | `id`, `destination_id` → destinations, `name`, `category`, `time_needed`, `entry_fee`, `description`, `sort_order`                                |
| `tips`          | `id`, `destination_id` → destinations, `category`, `text`                                                                                        |
| `trips`         | `id`, `user_id` → users, `destination_id`, `destination_slug`, `destination_name`, `title`, `days`, `travellers`, `budget_per_person`, `start_date`, `pace`, `prompt`, `itinerary` (JSONB), `created_at` |
| `chat_messages` | `id`, `user_id` → users, `role`, `content`, `destination_slug`, `created_at`                                                                     |

The same DDL lives in `src/db/ddl.json` and is shared by `scripts/seed.mjs` and the runtime bootstrap, so `npm run seed`
and the app can never disagree about the schema.

---

## 5. API

| Method & path                     | Auth     | Purpose                                                                     |
| --------------------------------- | -------- | --------------------------------------------------------------------------- |
| `POST /api/auth/signup`           | —        | Create an account (bcrypt 10 rounds), `409` if the email exists              |
| `POST /api/auth/login`            | —        | Verify password, return a 7-day JWT + user                                   |
| `GET  /api/auth/me`               | Bearer   | Resolve the current user from the token                                      |
| `POST /api/auth/logout`           | Bearer   | Clear the auth cookie                                                        |
| `GET  /api/destinations`          | —        | Catalogue with `?q=&category=&region=&sort=` + knowledge-base counts         |
| `GET  /api/destinations/[slug]`   | —        | Full bundle: hotels, places, tips, `context`, related destinations           |
| `POST /api/itinerary`             | optional | Parse a prompt (Hindi/English), retrieve CONTEXT, build a costed day plan; `save: true` persists it |
| `GET/POST /api/trips`             | Bearer   | My Trips history / save a plan                                               |
| `GET/DELETE /api/trips/[id]`      | Bearer   | Read or delete one of *your* trips                                           |
| `GET/POST/DELETE /api/chat`       | Bearer   | Assistant transcript, grounded answers, clear history                        |
| `GET  /api/health`                | —        | DB connectivity, counts, `.env` diagnostics                                  |

---

## 6. Pages

| Route                      | What you get                                                                                     |
| -------------------------- | ------------------------------------------------------------------------------------------------ |
| `/`                        | Marketing landing page with live knowledge-base stats                                            |
| `/login` · `/signup`       | Tailwind auth screens, password strength meter, demo-credential filler, toasts, redirect flow     |
| `/dashboard`               | Greeting, quick planner, system status (DB + JWT), stats, recent trips, top-rated destinations    |
| `/search`                  | Text + **voice** search, category/region/sort filters, 20 destination cards                       |
| `/destinations/[slug]`     | Hero, places, hotels, tips, the raw CONTEXT the AI retrieves from, related destinations           |
| `/planner`                 | AI itinerary generator: prompt or voice → day-wise schedule, stay, budget breakdown, tips, sources, **PDF download**, **Save to My Trips** |
| `/assistant`               | Chat grounded in CONTEXT, per-destination scope, Hindi/English voice, persisted history           |
| `/trips`                   | Saved itinerary history with expandable day detail, PDF re-export and delete                      |

### Voice detection (Hindi + English)

`src/lib/voice.ts` wraps the Web Speech API. Three modes: **Auto** (starts `hi-IN`, and if the engine hears nothing it
automatically restarts once in `en-IN`), **हिन्दी (hi-IN)** and **English (en-IN)**. Interim transcripts stream into the
UI, permission/network/`no-speech` errors are translated into readable messages, and browsers without the API degrade
gracefully to typing.

### PDF download

`src/lib/pdf.ts` renders a print-ready A4 itinerary with **jsPDF** — branded header, overview, per-day schedule with
times and costs, budget table, local tips and a footer noting the generation time. Files are named
`musaafir-<destination>-<days>days.pdf`.

---

## 7. Project layout

```
src/
  app/
    api/auth/{signup,login,me,logout}/route.ts     auth endpoints
    api/{destinations,itinerary,trips,chat,health} data endpoints
    {login,signup,dashboard,search,planner,assistant,trips}/page.tsx
    destinations/[slug]/page.tsx
    layout.tsx · page.tsx · globals.css
  components/  app-shell.tsx · auth-layout.tsx · destination-card.tsx · icons.tsx · toast.tsx
  db/          index.ts (pool + connection check) · schema.ts · bootstrap.ts · seed-data.json · ddl.json
  lib/         auth.ts · env.ts · rag.ts · data.ts · api.ts · client.ts · voice.ts · pdf.ts
  instrumentation.ts                               boot-time DB provisioning
scripts/seed.mjs                                   `npm run seed`
```

---

## 8. Troubleshooting

| Symptom                                  | Fix                                                                                                    |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `PostgreSQL not connected - check DATABASE_URL` | Start PostgreSQL, confirm the database exists, and check the credentials/host/port in `.env`.   |
| `Invalid email or password`               | Look at the `[LOGIN]` log lines: `no user found` vs `password mismatch`. Re-run `npm run seed` to repair the demo hash, or sign up again. |
| `relation "users" does not exist`         | `npx drizzle-kit push` then `npm run seed` (or just restart the server — it self-provisions).           |
| Voice button disabled                     | Web Speech API needs Chrome/Edge/Safari, a microphone permission and (outside localhost) HTTPS.         |
| Empty destination lists                   | The knowledge base is empty — run `npm run seed` and reload.                                            |
| Token rejected right after login          | Make sure `JWT_SECRET` did not change between the request that issued the token and the one verifying it. |

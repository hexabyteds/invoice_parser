# Deploying to production (HostNext / cPanel)

Once set up, deploying is **one command**:

```bash
npm run deploy
```

This pushes your code to GitHub, builds the React frontend, uploads it to
the server, pulls the backend code on the server, installs dependencies,
runs any pending database migrations, and restarts the app — all from your
laptop, no manual FTP/cPanel clicking needed.

---

## One-time setup (do this once)

### 1. Create your local deploy config

```bash
cp deploy.config.example deploy.config
```

Edit `deploy.config` and fill in (see comments in the file for where to find
each value in cPanel):

- `SSH_HOST`, `SSH_PORT`, `SSH_USER` — from cPanel → **SSH Access**
- `REPO_PATH` — from cPanel → **Git™ Version Control** → your repo → Manage
- `APP_PATH` — from cPanel → **Setup Node.js App** → your app → Application root
- `NODE_VENV_ACTIVATE` — same "Setup Node.js App" page, the `source ...`
  path it shows you
- `BRANCH` — the branch you deploy from (e.g. `main`)

This file is gitignored — it stays only on your machine.

### 2. Make sure SSH key login works (no password prompt)

```bash
ssh-copy-id -p <SSH_PORT> <SSH_USER>@<SSH_HOST>
```

If `ssh-copy-id` isn't available, add your `~/.ssh/id_ed25519.pub` (or
`id_rsa.pub`) contents to `~/.ssh/authorized_keys` on the server via cPanel's
SSH Access page ("Manage SSH Keys" → Import Key).

Test it:

```bash
ssh -p <SSH_PORT> <SSH_USER>@<SSH_HOST> echo ok
```

You should see `ok` with **no password prompt**.

### 3. Confirm the server's `.env` exists and points at production values

The server needs its own `.env` (DB creds, `GEMINI_API_KEY`, `JWT_SECRET`,
etc.) already in `APP_PATH/.env` — this is **not** pushed by git (it's
gitignored on purpose) and is **not** touched by `npm run deploy`. Set it up
once via cPanel File Manager if it isn't already there (copy the values you
currently use in production).

### 4. Confirm `server.js` is what Passenger runs

Your app already has a `server.js` shim for this — cPanel's "Setup Node.js
App" should point "Application startup file" at `server.js`.

### 5. First deploy

```bash
npm run deploy
```

Watch the output — it will tell you exactly which step fails if something
isn't configured yet (most common issues: wrong `REPO_PATH`/`APP_PATH`, or
`NODE_VENV_ACTIVATE` path not matching your app's actual Node version).

---

## Deploying database schema changes safely

Because the live database already has real customer data, we never
run a full schema dump against it. Instead:

1. Make your schema change locally against your dev DB.
2. Add a migration file describing that exact change under `migrations/`
   (see `migrations/README.md` for examples).
3. Commit it, then `npm run deploy` as usual — `scripts/migrate.js` runs
   automatically on the server and applies only what's new, in order,
   tracked in a `schema_migrations` table. It's safe to deploy repeatedly;
   already-applied migrations are skipped.

### First time only: check what's already different in production

Since schema changes weren't tracked before now, run this once to see how
production's current schema differs from your local dev schema
(`db/schema.sql`):

```bash
npm run db:diff
```

This SSHes into the server and dumps its schema (no data leaves the
server except table/column definitions), then diffs it against
`db/schema.sql`. Turn any real differences it shows into one or two
migration files in `migrations/` so both environments converge and stay
in sync going forward.

---

## Everyday workflow

```bash
git add -A
git commit -m "Add X"
npm run deploy
```

That's it — one command ships backend + frontend + DB migrations and
restarts the app.

## Troubleshooting

- **`npm run deploy` fails at "Pulling latest code"** — check `REPO_PATH` in
  `deploy.config`; SSH in and run `cd <REPO_PATH> && git remote -v` to
  confirm it points at this GitHub repo.
- **App doesn't pick up changes after deploy** — Passenger restarts via
  `touch tmp/restart.txt` inside `APP_PATH`; if `tmp/` doesn't exist there,
  the script creates it, but double check `APP_PATH` is the exact folder
  cPanel's "Setup Node.js App" is serving.
- **`node scripts/migrate.js` fails on the server** — SSH in, `cd APP_PATH`,
  activate the node venv (see `NODE_VENV_ACTIVATE`), and run
  `node scripts/migrate.js` manually to see the full error.

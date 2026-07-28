# Deploying to production (HostNext / cPanel)

Once set up, deploying is **one command**:

```bash
npm run deploy
```

This pushes your code to GitHub, builds the React frontend, uploads it to
the server, pulls the backend code on the server over SSH, installs
dependencies, runs any pending database migrations, and restarts the app —
all from your laptop.

---

## One-time setup (do this once)

### 1. The SSH port

HostNext doesn't disclose the SSH port through cPanel's normal UI or
support (they'll tell you to just use the browser Terminal instead). The
way around this: cPanel's own **Git™ Version Control** feature generates a
real SSH clone URL for any repo it tracks, and that URL contains the true
port:

1. cPanel → **Git™ Version Control** → create or view any repo
2. Look at the **Clone URL** — it looks like
   `ssh://username@yourdomain.com:PORT/home/username/repositories/reponame`
3. That `PORT` is your real SSH port (for this project: `1978`)

Full interactive SSH works on this port (not restricted to git-only
commands) — confirmed by testing.

### 2. SSH key login

You already have a dedicated key for this
(`~/.ssh/id_ed25519_hostnext`), imported and authorized via cPanel → **SSH
Access → Manage SSH Keys**. Test it:

```bash
ssh -i ~/.ssh/id_ed25519_hostnext -p 1978 apexhome@apexhometutors.com echo ok
```

You should see `ok` with no password prompt.

### 3. Fill in `deploy.config`

```bash
cp deploy.config.example deploy.config
```

For this project it's already filled in:

```
SSH_HOST=apexhometutors.com
SSH_PORT=1978
SSH_USER=apexhome
SSH_KEY=/Users/fast/.ssh/id_ed25519_hostnext
REPO_PATH=/home/apexhome/eazeebooks.com
APP_PATH=/home/apexhome/eazeebooks.com
NODE_VENV_ACTIVATE=/home/apexhome/nodevenv/eazeebooks.com/20/bin/activate
BRANCH=AdminPortal
```

`deploy.config` is gitignored — it never leaves your machine.

### 4. Confirm the server's `.env` / environment variables

The server needs `GEMINI_API_KEY`, DB credentials, `JWT_SECRET`, etc.
already available to the running process. For this app: `.env` on the
server has `PORT` and `GEMINI_API_KEY`; DB credentials appear to be
configured separately via cPanel → **Setup Node.js App → Environment
Variables** rather than the `.env` file. Either way, `npm run deploy`
never touches or overwrites `.env`.

### 5. First deploy

```bash
npm run deploy
```

Watch the output — it'll tell you exactly which step fails if something
isn't configured yet.

---

## Deploying database schema changes safely

Because the live database already has real customer data, we never run a
full schema dump against it. Instead:

1. Make your schema change locally against your dev DB.
2. Add a migration file describing that exact change under `migrations/`
   (see `migrations/README.md` for examples).
3. Commit it, then `npm run deploy` as usual — `scripts/migrate.js` runs
   automatically on the server and applies only what's new, tracked in a
   `schema_migrations` table. Safe to deploy repeatedly.

### Checking what's different in production

Every deploy, the server also dumps its current schema to
`db/schema.production.sql` (gitignored, never committed). Fetch and diff
it against your local `db/schema.sql` with:

```bash
npm run db:diff
```

---

## Everyday workflow

```bash
git add -A
git commit -m "Add X"
npm run deploy
```

## Troubleshooting

- **`npm run deploy` fails at "Pulling latest code"** — check `REPO_PATH`;
  SSH in and run `git -C REPO_PATH remote -v` to confirm it points at this
  GitHub repo, and `git -C REPO_PATH status` to check for uncommitted
  local changes on the server that might block a pull (if so, review them
  before discarding — see git history in this project for an example of a
  hardcoded-secret hotfix that needed careful handling, not a blind
  overwrite).
- **App doesn't pick up changes after deploy** — Passenger restarts via
  `touch tmp/restart.txt` inside `APP_PATH`.
- **`node scripts/migrate.js` fails on the server** — SSH in, `cd APP_PATH`,
  activate the node venv (see `NODE_VENV_ACTIVATE`), and run
  `node scripts/migrate.js` manually to see the full error.
- **SSH port stops working** — HostNext could change it; re-check via the
  Git Version Control clone URL trick above.

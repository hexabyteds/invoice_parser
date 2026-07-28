# Deploying to production (HostNext / cPanel)

Once set up, deploying is **one command**:

```bash
npm run deploy
```

**No SSH required.** HostNext doesn't disclose the SSH port on shared
hosting, so this deploy pipeline uses cPanel's official HTTPS API (UAPI)
instead — the same port (`2083`) you already use to log into cPanel. It:

1. Pushes your code to GitHub.
2. Calls cPanel's `VersionControlDeployment::create` API, which pulls the
   latest commit into the server's git repo and runs the deployment tasks
   defined in `.cpanel.yml` — build the React frontend, install backend
   deps, run pending DB migrations, and restart the Passenger app.
3. Polls until it's done and reports success/failure.

This is cPanel's own supported deployment mechanism (see [Guide to Git —
Deployment](https://docs.cpanel.net/knowledge-base/web-services/guide-to-git-deployment/)),
just triggered remotely via API instead of clicking "Deploy" in the UI.

---

## One-time setup (do this once)

### 1. Create a cPanel API Token

cPanel → search box → **"Manage API Tokens"** → **Create Token** → give it
a name (e.g. `deploy`) → copy the token value shown (**it's only shown
once** — if you lose it, just revoke it and create a new one). Treat it
exactly like a password: it grants the same access as logging in as you.

### 2. Fill in `deploy.config`

```bash
cp deploy.config.example deploy.config
```

For this project, this is already mostly filled in (confirmed via cPanel
Terminal):

```
CPANEL_HOST=apexhometutors.com
CPANEL_USER=apexhome
CPANEL_API_TOKEN=<paste your token here>
REPO_PATH=/home/apexhome/eazeebooks.com
BRANCH=AdminPortal
```

`deploy.config` is gitignored — it never leaves your machine.

### 3. Confirm the branch cPanel's repo is actually tracking

In cPanel → **Git Version Control** → your repo → **Manage** → **"Pull or
Deploy"** tab, or via cPanel's browser Terminal:

```bash
git -C /home/apexhome/eazeebooks.com branch
```

Make sure it matches `BRANCH` in `deploy.config`. If not, either update
`BRANCH` to match, or switch the server's checkout:

```bash
git -C /home/apexhome/eazeebooks.com checkout AdminPortal
```

### 4. Confirm the server's `.env` is production-ready

The server needs its own `.env` (DB creds, `GEMINI_API_KEY`, `JWT_SECRET`,
etc.) at `REPO_PATH/.env` — already confirmed present. It's gitignored, so
`npm run deploy` never touches or overwrites it.

### 5. First deploy

```bash
npm run deploy
```

Watch the output. First-time gotchas:

- **"working tree not clean"** — the cPanel-managed repo must have no
  uncommitted changes. Since we never edit files directly there, this
  should be clean; if not, SSH-free option is to fix it via cPanel's
  browser Terminal (`git -C REPO_PATH status` / `git -C REPO_PATH checkout -- .`).
- **`.cpanel.yml` missing on first run** — the very first `npm run deploy`
  after adding `.cpanel.yml` should work fine (the pull happens before
  tasks run, bringing `.cpanel.yml` in along with everything else). If it
  doesn't, do one manual "Update from Remote" click in the Git Version
  Control UI first, then re-run `npm run deploy`.
- Full deployment logs live on the server at
  `~/.cpanel/logs/vc_<timestamp>_git_deploy.log` — viewable via cPanel's
  browser Terminal (`cat`/`less`) or the Git Version Control UI's "Pull or
  Deploy" tab.

---

## Deploying database schema changes safely

Because the live database already has real customer data, we never run a
full schema dump against it. Instead:

1. Make your schema change locally against your dev DB.
2. Add a migration file describing that exact change under `migrations/`
   (see `migrations/README.md` for examples).
3. Commit it, then `npm run deploy` as usual — `scripts/migrate.js` runs
   automatically as one of the `.cpanel.yml` tasks and applies only what's
   new, tracked in a `schema_migrations` table. Safe to deploy repeatedly.

### Checking what's different in production

Every deploy, `.cpanel.yml` also dumps production's current schema to
`db/schema.production.sql` on the server (gitignored, never committed).
Fetch and diff it against your local `db/schema.sql` with:

```bash
npm run db:diff
```

(This works over the same HTTPS API — no SSH needed. It requires at least
one successful deploy to have run first, since that's what creates the
file.)

---

## Everyday workflow

```bash
git add -A
git commit -m "Add X"
npm run deploy
```

One command ships backend + frontend + DB migrations and restarts the app.

## Troubleshooting

- **Check deployment status/logs without re-deploying**:
  ```bash
  curl -s -H "Authorization: cpanel apexhome:$CPANEL_API_TOKEN" \
    --data-urlencode "repository_root=/home/apexhome/eazeebooks.com" \
    "https://apexhometutors.com:2083/execute/VersionControlDeployment/retrieve" | jq
  ```
- **App doesn't pick up changes after deploy** — Passenger restarts via
  `touch tmp/restart.txt`, which is the last `.cpanel.yml` task. If an
  earlier task failed, this never runs — check the deploy log.
- **Frontend build fails on the server (memory/CPU limits)** — shared
  hosting can be tight on resources for a Vite build. If this becomes a
  recurring issue, the fallback is building `frontend/dist` locally and
  uploading it via cPanel's Fileman API instead of building on-server —
  ask for this if you hit that wall.
- **API calls return an auth error** — token may have been revoked/expired,
  or `CPANEL_USER`/`CPANEL_HOST` don't match. Re-check in cPanel → Manage
  API Tokens.

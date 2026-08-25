# Deploy

partidata.se is currently a static Next.js export served by nginx. GitHub
Actions builds every pushed `v*` tag and rsyncs `out/` to the production
web root configured in the repository's protected production environment — see
[`.github/workflows/deploy.yaml`](../.github/workflows/deploy.yaml).

## Release

```bash
git switch main && git pull
git tag v0.2.0
git push origin v0.2.0
```

To roll back, run the workflow manually (`workflow_dispatch`) from an earlier
tag in the Actions tab.

The site has no database and no runtime services: all data lives as JSON in
`data/` and is baked into the export at build time.

## One-time server setup

Set the deploy account and web root for the production environment before
running the setup commands:

```bash
DEPLOY_ACCOUNT="replace-with-deploy-account"
DEPLOY_ROOT="replace-with-absolute-web-root"

sudo mkdir -p "$DEPLOY_ROOT"
sudo chown "$DEPLOY_ACCOUNT:$DEPLOY_ACCOUNT" "$DEPLOY_ROOT"

sudo cp partidata.se.conf /etc/nginx/sites-available/partidata.se.conf
sudo ln -s /etc/nginx/sites-available/partidata.se.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# After DNS points at the production host:
sudo certbot --nginx -d partidata.se -d www.partidata.se
```

## Deploy key

A dedicated key pair for the workflow; the private half never touches the
server.

```bash
ssh-keygen -t ed25519 -C partidata.se-deploy -f partidata-deploy -N ''
# Append partidata-deploy.pub to the dedicated deploy account's authorized_keys.
ssh-keyscan -H <deploy-host> > known_hosts
```

GitHub → repo settings → Environments → `production` → secrets:

| Secret | Value |
|---|---|
| `DEPLOY_SSH_KEY` | contents of `partidata-deploy` (private key) |
| `DEPLOY_KNOWN_HOSTS` | contents of `known_hosts` from `ssh-keyscan` |
| `DEPLOY_HOST` | production hostname or IP address |
| `DEPLOY_USER` | dedicated deploy account |
| `DEPLOY_TARGET` | absolute production web root |

## DNS

`partidata.se` and `www.partidata.se` → the production host. The nginx config
redirects apex → www.

## Manual deploy

```bash
npm run build
rsync -az --delete out/ <deploy-account>@<deploy-host>:<absolute-web-root>/
```

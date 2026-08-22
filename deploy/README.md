# Deploy

partidata.se is a static Next.js export served by nginx on the `saga` server
(Hetzner, `insector` hcloud context). GitHub Actions builds on every pushed
`v*` tag and rsyncs `out/` to `/var/www/partidata.se` — see
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

Run as `webback` on saga:

```bash
sudo mkdir -p /var/www/partidata.se
sudo chown webback:webback /var/www/partidata.se

sudo cp partidata.se.conf /etc/nginx/sites-available/partidata.se.conf
sudo ln -s /etc/nginx/sites-available/partidata.se.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# After DNS points at saga:
sudo certbot --nginx -d partidata.se -d www.partidata.se
```

## Deploy key

A dedicated key pair for the workflow; the private half never touches the
server.

```bash
ssh-keygen -t ed25519 -C partidata.se-deploy -f partidata-deploy -N ''
# On saga: append partidata-deploy.pub to /home/webback/.ssh/authorized_keys
ssh-keyscan -H <saga-ip> > known_hosts
```

GitHub → repo settings → Environments → `production` → secrets:

| Secret | Value |
|---|---|
| `DEPLOY_SSH_KEY` | contents of `partidata-deploy` (private key) |
| `DEPLOY_KNOWN_HOSTS` | contents of `known_hosts` from `ssh-keyscan` |
| `DEPLOY_HOST` | saga's public IP or hostname |
| `DEPLOY_USER` | `webback` |

## DNS (Loopia)

`partidata.se` and `www.partidata.se` → A record to saga's IPv4 (and AAAA to
its IPv6). The nginx config redirects apex → www.

## Manual deploy

```bash
npm run build
rsync -az --delete out/ webback@saga:/var/www/partidata.se/
```

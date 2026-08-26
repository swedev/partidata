# Deploy

partidata.se runs as a standalone Next.js process behind nginx. GitHub Actions
builds every pushed `v*` tag, rsyncs `.release/` to the configured production
target and restarts `partidata.service`.

The service has no database. Versioned JSON and party symbols under `data/` are
included in the artifact and read by the Node process at request time.

## Release

```bash
git switch main && git pull
git tag v0.6.0
git push origin v0.6.0
```

To return to older code, run the workflow manually from an earlier tag.

## One-time server setup

Choose the deploy account, service account and target directory. The target is
the same path stored in the GitHub `DEPLOY_TARGET` secret.

```bash
DEPLOY_ACCOUNT="replace-with-deploy-account"
SERVICE_ACCOUNT="replace-with-service-account"
DEPLOY_TARGET="replace-with-absolute-target"
NODE_BINARY="$(command -v node)"

sudo mkdir -p "$DEPLOY_TARGET"
sudo chown "$DEPLOY_ACCOUNT:$SERVICE_ACCOUNT" "$DEPLOY_TARGET"
sudo chmod 0750 "$DEPLOY_TARGET"

sed \
  -e "s|@SERVICE_USER@|$SERVICE_ACCOUNT|g" \
  -e "s|@DEPLOY_TARGET@|$DEPLOY_TARGET|g" \
  -e "s|@NODE_BINARY@|$NODE_BINARY|g" \
  deploy/partidata.service.template | sudo tee /etc/systemd/system/partidata.service >/dev/null

sudo systemctl daemon-reload
sudo systemctl enable partidata.service
```

Allow the deploy account to restart only this service. Use the absolute
`systemctl` path reported by `command -v systemctl` in the sudoers rule.

```text
<deploy-account> ALL=(root) NOPASSWD: /usr/bin/systemctl restart partidata.service
```

Install and validate nginx after the first artifact has been uploaded and the
service responds at `http://127.0.0.1:3000/api/health`:

```bash
sudo cp deploy/partidata.se.conf /etc/nginx/sites-available/partidata.se.conf
sudo ln -s /etc/nginx/sites-available/partidata.se.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

The first switch may cause a short outage while the static export is replaced
and nginx is changed to the reverse proxy.

## Deploy key and GitHub environment

```bash
ssh-keygen -t ed25519 -C partidata.se-deploy -f partidata-deploy -N ''
# Append partidata-deploy.pub to the deploy account's authorized_keys.
ssh-keyscan -H <deploy-host> > known_hosts
```

GitHub → repository settings → Environments → `production` → secrets:

| Secret | Value |
|---|---|
| `DEPLOY_SSH_KEY` | contents of `partidata-deploy` (private key) |
| `DEPLOY_KNOWN_HOSTS` | contents of `known_hosts` from `ssh-keyscan` |
| `DEPLOY_HOST` | production hostname or IP address |
| `DEPLOY_USER` | deploy account |
| `DEPLOY_TARGET` | absolute standalone application directory |

## Manual deploy

```bash
npm ci
npm run precommit
rsync -az --delete .release/ <deploy-account>@<deploy-host>:<absolute-target>/
ssh <deploy-account>@<deploy-host> 'sudo systemctl restart partidata.service'
curl --fail https://www.partidata.se/api/health
```

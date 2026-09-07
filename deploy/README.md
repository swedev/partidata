# Deploy

partidata.se runs as a standalone Next.js process behind nginx. GitHub Actions
builds every pushed `v*` tag, rsyncs `.release/` to the configured production
target and restarts `partidata.service`.

Data has a shorter path. `publish-data.yaml` rsyncs `data/` and restarts the
service whenever a push to `main` touches `data/**`, so a data change goes live
at merge, without a release.

The service has no database. Versioned JSON and party symbols under `data/` are
included in the artifact and read by the Node process at request time.

## Release

The version in `package.json` is what the deployed artifact reports, in
`/api/health` and in the site footer. A release raises it and tags the same
number; the workflow refuses to build a `v*` tag that names a different one.

```bash
git switch main && git pull
npm version minor --no-git-tag-version   # or patch / major
git commit -am "Släpp $(node -p "require('./package.json').version")"
git push origin main
git tag "v$(node -p "require('./package.json').version")"
git push origin "v$(node -p "require('./package.json').version")"
```

A release also carries the data: `.release/` holds the `data/` tree of the
tagged commit.

To return to older code, run the workflow manually from an earlier tag. It
builds tags only, so the version the artifact reports always names a tag whose
tree is the deployed code.

## Data

Both workflows write the commit their data comes from to `<target>/data-commit`,
a single line with the 40-character hash, and `/api/health` reports it as
`data.commit` when the file is there. The `/data/` page links its files to that
commit. The release writes the tag's commit; `publish-data.yaml` writes main's
tip.

- The job always publishes main's tip, whatever triggered it. A
  `workflow_dispatch` from a branch, a re-run of an older run and a push that
  waited behind a release all send the same thing: what `main` is when the job
  runs. An intentional rollback is a revert on `main`.
- `production-deploy` holds at most one waiting run, so a third event within
  the same few minutes replaces the one already queued and cancels it. Re-run
  it manually.
- A failed run rolls nothing back. The next push to `main` that touches `data/`,
  or a `workflow_dispatch`, rsyncs the whole tree again and is the repair, as
  long as the server answers `/api/health` at all — a 500 still counts.
- A server that does not answer is restored with a manual release run on the
  current tag.

Two files are built into the bundle rather than read from `data/` at request
time: `data/derived/riksdag.json`, which `src/components/party-profile/elections.tsx`
imports statically, and `public/img/sveriges_riksdag.svg`, which
`scripts/build-derived-data.js` generates. A change to either reaches the party
pages only with a release. `/data/derived/riksdag.json` itself is served from
disk and does follow a data publish.

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
service responds at `http://127.0.0.1:3000/api/health/`:

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

The whole artifact, from a tag checked out locally. The `--delete` removes
`data-commit` along with the old build, so it is written back.

```bash
npm ci
npm run precommit
rsync -az --delete .release/ <deploy-account>@<deploy-host>:<absolute-target>/
ssh <deploy-account>@<deploy-host> "printf '%s\n' '$(git rev-parse HEAD)' > '<absolute-target>/data-commit.tmp' && chmod 0644 '<absolute-target>/data-commit.tmp' && mv -f '<absolute-target>/data-commit.tmp' '<absolute-target>/data-commit' && sudo systemctl restart partidata.service"
curl --fail https://www.partidata.se/api/health/
```

The data alone, from `main` — the same thing `publish-data.yaml` does.

```bash
npm ci
npm run validate:data
npm run check:derived-data
rsync -az --delete data/ <deploy-account>@<deploy-host>:<absolute-target>/data/
ssh <deploy-account>@<deploy-host> "printf '%s\n' '$(git rev-parse HEAD)' > '<absolute-target>/data-commit.tmp' && chmod 0644 '<absolute-target>/data-commit.tmp' && mv -f '<absolute-target>/data-commit.tmp' '<absolute-target>/data-commit' && sudo systemctl restart partidata.service"
curl --fail https://www.partidata.se/api/health/
```

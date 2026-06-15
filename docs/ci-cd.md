# CI/CD Pipeline Documentation

This document explains the GitHub Actions CI/CD pipeline for AgriSense.

## Workflows

### 1. CI Build & Test (`.github/workflows/ci.yml`)

Runs on every push and pull request to validate code quality.

**Triggers:**
- Push to `main` or `develop` branches
- Pull requests to `main` or `develop` branches

**Jobs:**

1. **Backend Tests & Linting**
   - Runs Go unit tests against test PostgreSQL and Redis
   - Runs `golangci-lint` for code quality
   - Verifies `go.mod` is tidy
   - Uploads coverage to Codecov

2. **Frontend Build & Linting**
   - Installs npm dependencies
   - Runs ESLint for JavaScript/TypeScript linting
   - Runs TypeScript type checking (`tsc --noEmit`)
   - Builds production frontend bundle

3. **Docker Build**
   - Builds backend Docker image
   - Builds frontend Docker image
   - No push (validation only on PR)

4. **Docker Compose Validation**
   - Validates `docker-compose.yml` syntax
   - Validates `docker-compose.prod.yml` with template env vars
   - Ensures compose configuration is deployable

### 2. Deploy to Production (`.github/workflows/deploy.yml`)

Handles production deployments with manual control and automated tagging.

**Triggers:**
- Manual trigger via GitHub Actions UI (workflow_dispatch)
- Automatic on git tag push (e.g., `git tag v1.0.0 && git push --tags`)

**Manual Trigger Inputs:**
- `environment`: Choose `staging` or `production`
- `ref`: Git reference to deploy (branch or tag, default: `main`)

**Jobs:**

1. **Build & Push** (runs in GitHub Actions)
   - Builds Docker images in CI (not on server)
   - Pushes to GitHub Container Registry (ghcr.io)
   - Tags with git SHA and branch/tag name
   - Caches layers for faster builds
   - On release tags: also tags as `latest`

2. **Deploy** (runs on production server via SSH)
   - Pulls latest config files from repo
   - Pulls pre-built images from ghcr.io
   - Runs `docker compose up` with pre-built images
   - Runs database migrations
   - Performs health checks
   - Sends Slack notifications

## Required Secrets

Configure these in **GitHub Settings → Secrets and Variables → Actions**:

### Docker Registry (GitHub Container Registry — No Setup Needed)

Images are pushed to **ghcr.io** (GitHub Container Registry) using the built-in `GITHUB_TOKEN`. No extra secrets required — it's free for public repositories.

### Deployment Server (Required for Production Deploy)

- `DEPLOY_HOST`: Production server hostname/IP
- `DEPLOY_USER`: SSH user on production server
- `DEPLOY_PATH`: Absolute path to AgriSense directory on server
- `SSH_PRIVATE_KEY`: Private SSH key (SSH-2 format)
  - Generate: `ssh-keygen -t ed25519 -f agrisense-deploy -N ""`
  - Add public key to `~/.ssh/authorized_keys` on deploy server
  - Add private key as secret (handle carefully — use dedicated deploy key)
- `PROD_URL`: Production API URL (e.g., `https://api.yourdomain.com`)

### Notifications (Optional)

- `SLACK_WEBHOOK`: Slack webhook URL for deployment notifications
  - Generate at: https://api.slack.com/messaging/webhooks

## Setup Instructions

### 1. Create GitHub Secrets

```bash
# Docker images use GitHub Container Registry (ghcr.io) — no extra secrets needed.
# The built-in GITHUB_TOKEN handles authentication automatically.

# Generate SSH key for deployments (ed25519 recommended)
ssh-keygen -t ed25519 -f ~/.ssh/agrisense-deploy -N "" -C "github-actions-agrisense"

# Add public key to production server
ssh-copy-id -i ~/.ssh/agrisense-deploy.pub deploy-user@prod-server.com

# Add private key as GitHub secret
gh secret set SSH_PRIVATE_KEY --body "$(cat ~/.ssh/agrisense-deploy)"
gh secret set DEPLOY_HOST --body "prod-server.com"
gh secret set DEPLOY_USER --body "deploy-user"
gh secret set DEPLOY_PATH --body "/opt/agrisense"
gh secret set PROD_URL --body "https://api.yourdomain.com"

# Optional: Slack notifications
gh secret set SLACK_WEBHOOK --body "https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
```

### 2. Configure Production Server

The server needs the repo **for config files only** (docker-compose.yml, nginx, prometheus, etc.). Docker images are pre-built in CI and pulled from ghcr.io — no building on the server.

```bash
# On production server
sudo useradd -m -d /opt/agrisense deploy-user
sudo chown deploy-user:deploy-user /opt/agrisense

# Clone repository (for config files only — images are pulled from ghcr.io)
sudo -u deploy-user git clone https://github.com/savvyinsight/agrisense.git /opt/agrisense
cd /opt/agrisense

# Create .env.prod (DO NOT commit)
sudo -u deploy-user cp .env.prod.example .env.prod
sudo -u deploy-user nano .env.prod  # Edit with production secrets

# Install Docker if not already installed
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker deploy-user

# Create SSL certificate directory
sudo -u deploy-user mkdir -p infra/nginx/ssl
# Copy SSL certificates to infra/nginx/ssl/fullchain.pem and privkey.pem
```

### 3. Test Deployment Locally

```bash
# Validate compose config
docker compose -f docker-compose.prod.yml config

# Test pulling pre-built images (verify ghcr.io access)
docker pull ghcr.io/savvyinsight/agrisense-api:latest
docker pull ghcr.io/savvyinsight/agrisense-frontend:latest
```

## Workflow Usage

### Development (Automatic on PR)

```bash
# Create feature branch
git checkout -b feature/my-feature

# Make changes, commit, and push
git add .
git commit -m "Add new feature"
git push origin feature/my-feature

# Open PR — CI automatically runs all checks
# Once approved and tests pass, merge to main
```

### Deployment (Manual Trigger)

#### Option 1: Via GitHub UI

1. Go to GitHub Actions
2. Select "Deploy to Production" workflow
3. Click "Run workflow"
4. Select environment: `production`
5. Select ref: `main` (or specific tag/branch)
6. Click "Run workflow"

#### Option 2: Via Git Tags (Automatic)

```bash
# Create release tag
git tag -a v1.0.0 -m "Release version 1.0.0"
git push --tags

# Workflow automatically triggers and deploys to production
# Check GitHub Actions for deployment status
```

#### Option 3: Via CLI

```bash
# Trigger workflow manually
gh workflow run deploy.yml -f environment=production -f ref=main

# Monitor deployment
gh run list --workflow deploy.yml --status in_progress
gh run view <run-id> --log
```

## Troubleshooting

### SSH Connection Fails

```bash
# Verify SSH key works
ssh -i ~/.ssh/agrisense-deploy deploy-user@prod-server.com "echo OK"

# Check authorized_keys on server
cat ~/.ssh/authorized_keys | grep "github-actions-agrisense"
```

### Docker Push Fails

```bash
# Images push to ghcr.io using GITHUB_TOKEN — no extra credentials needed.
# If push fails, check:
# 1. Repository is public (or has packages write permission)
# 2. GITHUB_TOKEN has packages:write permission (default for public repos)
# 3. Repository Settings → Actions → General → Workflow permissions = Read and write
```

### Health Check Fails After Deploy

```bash
# SSH to server and check logs
ssh deploy-user@prod-server.com "docker compose -f /opt/agrisense/docker-compose.prod.yml logs --tail=50"

# Verify service is running
docker ps | grep agrisense
```

### Migrations Failed

```bash
# Check migration status
docker compose exec api go run ./cmd/migrate version

# Rollback if needed
docker compose exec api go run ./cmd/migrate down

# Re-run migrations
docker compose exec api go run ./cmd/migrate up
```

## Monitoring

### GitHub Actions

- View workflow runs: GitHub → Actions tab
- Check logs: Click workflow run → Job → Step
- Set up branch protection: Settings → Branches → Require status checks

### Production Monitoring

- Prometheus: `https://yourdomain.com:9090` (if exposed)
- Grafana: `https://yourdomain.com:3000`
- API health: `https://api.yourdomain.com/health`

## Security Best Practices

✅ **Do:**
- Rotate SSH keys annually
- Use dedicated deploy user (not root)
- Store secrets in GitHub Secrets (encrypted)
- Review CI logs for failed tests before merging
- Use SSH keys instead of password-based auth
- Tag releases before production deployments
- Keep Docker images up to date

❌ **Don't:**
- Commit `.env.prod` to repository
- Use personal SSH keys for deployments
- Store passwords in workflow files
- Deploy directly from feature branches
- Run CI/CD with overly permissive SSH keys
- Skip health checks after deployment

## Future Enhancements

- [ ] Add Kubernetes deployment support (Helm charts)
- [ ] Add database backup before deployment
- [ ] Add automated rollback on health check failure
- [ ] Add security scanning (Trivy, Snyk)
- [ ] Add performance testing (load tests)
- [ ] Add blue-green deployment strategy
- [ ] Add GitOps integration (ArgoCD)
- [ ] Add automatic rollback on alert threshold breach

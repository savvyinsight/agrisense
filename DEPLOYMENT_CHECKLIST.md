# 🔒 AgriSense Production Deployment Security Checklist

Use this checklist before deploying AgriSense to production. Complete all items marked **REQUIRED** before going live.

---

## 📋 Pre-Deployment Validation

### Environment Configuration

- [ ] **REQUIRED**: `.env.prod` file created (do NOT commit)
- [ ] **REQUIRED**: All sensitive values changed from placeholders:
  - [ ] `JWT_SECRET` — 64+ character random string (use `openssl rand -hex 32`)
  - [ ] `DB_PASSWORD` — strong, random password (20+ characters, mixed case, numbers, symbols)
  - [ ] `INFLUXDB_PASSWORD` — strong, random password
  - [ ] `INFLUXDB_TOKEN` — strong, random token
  - [ ] `REDIS_PASSWORD` — strong, random password
  - [ ] `GRAFANA_ADMIN_PASSWORD` — strong, random password
  - [ ] `EMQX_ADMIN_PASSWORD` — strong, random password (different from username)
- [ ] **REQUIRED**: `PROD_DOMAIN` set to your actual production domain (e.g., `api.yourdomain.com`)
- [ ] ENV file is in `.gitignore` and NOT committed
- [ ] File permissions: `.env.prod` should be readable only by app user (chmod 600)

### SSL/TLS Certificates

- [ ] **REQUIRED**: SSL certificates obtained and placed in `infra/nginx/ssl/`:
  - [ ] `fullchain.pem` (certificate chain)
  - [ ] `privkey.pem` (private key)
- [ ] **RECOMMENDED**: Use Let's Encrypt with auto-renewal (e.g., certbot with nginx plugin)
- [ ] **REQUIRED**: SSL certificate is valid for your `PROD_DOMAIN`
- [ ] **REQUIRED**: Certificate expiration date is > 30 days away
- [ ] Private key file permissions: 600 (readable only by nginx)

### Nginx Configuration

- [ ] **REQUIRED**: Update `infra/nginx/nginx.conf`:
  - [ ] Replace `yourdomain.com` with your actual production domain
  - [ ] Verify SSL paths point to correct certificate files
  - [ ] Review `limit_req` rates (login: 5r/m, api: 100r/m)
- [ ] **REQUIRED**: Test nginx configuration: `docker run --rm -v $(PWD)/infra/nginx:/etc/nginx:ro nginx:alpine nginx -t`
- [ ] **RECOMMENDED**: Enable security headers (HSTS, CSP, X-Frame-Options)

### Application Security

- [ ] **REQUIRED**: CORS is tightened to production domain only
  - [ ] Backend `PROD_DOMAIN` env var set
  - [ ] No `.vercel.app` or other catch-all patterns in production
- [ ] **REQUIRED**: Rate limiting enabled on login endpoints (nginx layer)
- [ ] **REQUIRED**: All API endpoints require JWT authentication (except `/health`)
- [ ] **RECOMMENDED**: Enable backend rate-limiting middleware (not just nginx)

### Database Security

- [ ] **REQUIRED**: PostgreSQL password is strong and unique
- [ ] **REQUIRED**: PostgreSQL SSL mode considered (currently `disable` for local docker-compose, review for networked deployments)
- [ ] **RECOMMENDED**: Database backups automated and tested
- [ ] **RECOMMENDED**: Database user limited to least-privilege role (not superuser)

### Infrastructure & Network

- [ ] **REQUIRED**: Firewall rules restrict traffic:
  - [ ] Port 443 (HTTPS): Open to public
  - [ ] Port 80 (HTTP): Open to public (redirect to 443)
  - [ ] Port 1883 (MQTT): Restricted to trusted networks or VPN only
  - [ ] Port 18083 (EMQX dashboard): Restricted to admin IPs only
  - [ ] Port 5432 (PostgreSQL): Not exposed publicly (internal network only)
  - [ ] Port 8086 (InfluxDB): Not exposed publicly (internal network only)
  - [ ] Port 6379 (Redis): Not exposed publicly (internal network only)
  - [ ] Port 9090 (Prometheus): Restricted to monitoring network only
  - [ ] Port 3000 (Grafana): Restricted or behind auth gateway
- [ ] **REQUIRED**: Server runs non-root user in containers
- [ ] **REQUIRED**: No privileged containers in production compose
- [ ] **RECOMMENDED**: Enable audit logging for all services

### EMQX (MQTT Broker)

- [ ] **REQUIRED**: Default admin credentials changed:
  - [ ] `EMQX_ADMIN_USERNAME` set to non-default value (not "admin")
  - [ ] `EMQX_ADMIN_PASSWORD` strong and unique
- [ ] **RECOMMENDED**: EMQX dashboard only accessible via VPN or restricted IP allowlist
- [ ] **RECOMMENDED**: MQTT over TLS (port 8883) enabled if using over internet
- [ ] **RECOMMENDED**: Authentication enabled for MQTT clients (not anonymous)

### Grafana

- [ ] **REQUIRED**: Admin password changed from default
- [ ] **RECOMMENDED**: Grafana only accessible internally or via VPN
- [ ] **RECOMMENDED**: Anonymous access disabled
- [ ] **RECOMMENDED**: Viewer-only dashboards for operational monitoring

### Monitoring & Logging

- [ ] **RECOMMENDED**: Prometheus metrics accessible only internally
- [ ] **RECOMMENDED**: Centralized logging configured (e.g., ELK stack, CloudWatch)
- [ ] **RECOMMENDED**: Log retention policy set (e.g., 30 days minimum)
- [ ] **RECOMMENDED**: Alerts configured for:
  - [ ] High CPU/Memory usage
  - [ ] Database connection failures
  - [ ] API error rate spike (5xx errors > threshold)
  - [ ] MQTT broker disconnections
  - [ ] Disk space low (<10% free)

### Backups & Disaster Recovery

- [ ] **RECOMMENDED**: Automated database backups enabled
- [ ] **RECOMMENDED**: Backup retention policy (e.g., 30 days daily, 12 months weekly)
- [ ] **RECOMMENDED**: Test restore procedure at least once
- [ ] **RECOMMENDED**: Backups stored off-site or in separate storage account
- [ ] **RECOMMENDED**: InfluxDB retention policies configured (e.g., 1 year for production data)

---

## 🚀 Deployment Steps

### Pre-Flight

```bash
# 1. Verify all secrets are set
cp .env.prod.example .env.prod
# Edit .env.prod with strong values

# 2. Validate compose configuration
docker compose -f docker-compose.prod.yml config > /dev/null

# 3. Verify SSL certificates exist
ls -la infra/nginx/ssl/fullchain.pem infra/nginx/ssl/privkey.pem

# 4. Test nginx config
docker run --rm -v $(PWD)/infra/nginx:/etc/nginx:ro nginx:alpine nginx -t
```

### Deployment

```bash
# 1. Create data volumes
docker volume create agrisense_postgres_data
docker volume create agrisense_influxdb_data
docker volume create agrisense_redis_data
docker volume create agrisense_emqx_data

# 2. Start services
docker compose -f docker-compose.prod.yml up -d --remove-orphans

# 3. Verify all services are running
docker compose -f docker-compose.prod.yml ps

# 4. Check logs for errors
docker compose -f docker-compose.prod.yml logs --tail=50

# 5. Test API health endpoint
curl -k https://yourdomain.com/health

# 6. Verify database migrations ran
docker compose -f docker-compose.prod.yml exec api go run ./cmd/migrate version
```

### Post-Deployment Validation

- [ ] API is responding on HTTPS (port 443)
- [ ] Health check passes: `curl -k https://yourdomain.com/health`
- [ ] Database is populated with migrations
- [ ] Grafana accessible and showing data
- [ ] EMQX dashboard accessible (admin only)
- [ ] Logs show no errors or warnings
- [ ] SSL certificate is valid (browser shows no warnings)

---

## 🔐 Ongoing Security Maintenance

### Weekly

- [ ] Review error logs for suspicious activity
- [ ] Verify all services are running and healthy
- [ ] Confirm backups completed successfully

### Monthly

- [ ] Review and rotate API keys/tokens if applicable
- [ ] Update Docker images to latest patches
- [ ] Audit user access and permissions
- [ ] Review firewall rules and network policies

### Quarterly

- [ ] Security audit of application code
- [ ] Penetration testing (or self-assessment)
- [ ] Backup restore test
- [ ] Disaster recovery drill

### Annually

- [ ] Full security audit (consider external audit)
- [ ] Update SSL certificates (or set auto-renewal)
- [ ] Review and update security policies

---

## 🚨 Incident Response

### If API is compromised:

1. Immediately revoke all JWT tokens (or restart API)
2. Rotate all secrets (passwords, API keys, tokens)
3. Review logs for unauthorized access
4. Audit database for data tampering
5. Restore from backup if data corruption detected
6. Update firewall rules if needed
7. Deploy patched version of code

### If database is compromised:

1. Stop API service to prevent further access
2. Snapshot database volume for forensics
3. Restore from known-good backup
4. Rotate database password
5. Rebuild and restart API
6. Audit all data access logs

### If SSL certificate is compromised:

1. Revoke the certificate with CA
2. Request and deploy new certificate
3. Update firewall rules if cert is pinned anywhere
4. Rotate HTTPS credentials

---

## 📞 Support & Documentation

- **Deployment Guide**: See `docs/deployment.md`
- **Architecture**: See `docs/architecture.md`
- **Troubleshooting**: See `docs/quick-reference.md`
- **API Documentation**: See `docs/api.md`

---

**Last Updated**: 2026-06-15  
**Version**: 1.0

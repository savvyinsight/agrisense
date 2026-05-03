# Deployment Guide

## 🚀 Production Deployment

This guide covers deploying AgriSenseIoT to a production server.

## Prerequisites

- Ubuntu 22.04+ server (or any Linux with Docker)
- Domain name (optional, for SSL)
- Docker and Docker Compose installed

## Step 1: Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo apt install docker-compose-plugin

# Log out and back in for group changes to take effect
exit
Step 2: Clone and Configure
# Clone repository
git clone https://github.com/yourusername/agrisenseiot.git
cd agrisenseiot

# Create production environment file
cp .env.example .env.prod

# Edit with secure values
nano .env.prod
# Change all passwords, JWT_SECRET, etc.
Step 3: SSL Certificates (Optional)
mkdir -p deployments/nginx/ssl

# If using Let's Encrypt
sudo apt install certbot
sudo certbot certonly --standalone -d yourdomain.com

# Copy certificates
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem deployments/nginx/ssl/
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem deployments/nginx/ssl/
sudo chmod 644 deployments/nginx/ssl/*.pem
Step 4: Nginx Configuration
mkdir -p deployments/nginx

cat > deployments/nginx/nginx.conf << 'EOF'
events {
    worker_connections 1024;
}

http {
    upstream api {
        server api:8080;
    }

    server {
        listen 80;
        server_name yourdomain.com;
        return 301 https://$server_name$request_uri\;
    }

    server {
        listen 443 ssl http2;
        server_name yourdomain.com;

        ssl_certificate /etc/nginx/ssl/fullchain.pem;
        ssl_certificate_key /etc/nginx/ssl/privkey.pem;

        location / {
            proxy_pass http://api\;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        location /metrics {
            proxy_pass http://api\;
        }

        location /debug/ {
            proxy_pass http://api;
            # Restrict in production
            allow 127.0.0.1;
            deny all;
        }
    }
}

## Step 5: Deploy

```bash
# Pull latest images and start
cd deployments

docker compose -f docker-compose.prod.yml up -d

# Check logs

docker compose -f docker-compose.prod.yml logs -f

# Verify services are running

docker ps
```

## Step 6: Monitoring

- **API**: <https://yourdomain.com>
- **EMQX Dashboard**: <http://yourdomain.com:18083>
- **Metrics**: <https://yourdomain.com/metrics>
- **Health Check**: <https://yourdomain.com/health>

## Step 7: Backup

```bash
# Backup databases
docker exec agrisense-postgres pg_dump -U postgres agrisense > backup.sql

# Backup volumes
docker run --rm -v agrisenseiot_postgres_data:/data -v $(pwd):/backup alpine tar czf /backup/postgres_backup.tar.gz -C /data .
```

## Troubleshooting

### Check logs

```bash
docker logs agrisense-api
docker logs agrisense-mqtt
```

Restart services

```bash
cd deployments
docker compose -f docker-compose.prod.yml restart
```

### Reset everything

```bash
cd deployments
docker compose -f docker-compose.prod.yml down -v
docker compose -f docker-compose.prod.yml up -d
```

## Security Checklist

- [ ] Change all default passwords
- [ ] Use strong JWT secret
- [ ] Enable firewall (ufw)
- [ ] Set up fail2ban
- [ ] Regular backups
- [ ] Monitor logs
- [ ] Keep system updated

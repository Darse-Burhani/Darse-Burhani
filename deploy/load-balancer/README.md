# 🚀 Darse Burhani — 5,000+ Concurrent Users Load Balancer Architecture

This configuration enables **Darse Burhani** to comfortably serve **5,000+ concurrent active users** (students, teachers, and admins) with **sub-100ms latency** and zero downtime.

---

## 🏗️ Architecture Overview

```
                      [ 5,000+ Active Users ]
                                 │
                                 ▼
                     [ Cloudflare / CDN Edge ]
                   (Caches 80% of Static Assets)
                                 │
                                 ▼
           [ Nginx Layer 7 Load Balancer (Port 80/443) ]
         (Least-Conn Balancing, Gzip, SSE Streaming, SSL)
                                 │
      ┌──────────────────────────┼──────────────────────────┐
      ▼                          ▼                          ▼
[ Backend Worker 1 ]       [ Backend Worker 2 ]       [ Backend Worker 3 / 4 ]
 (Port 4000, 25 DB conns)   (Port 4001, 25 DB conns)   (Port 4002/4003, 25 DB conns)
      │                          │                          │
      └──────────────────────────┼──────────────────────────┘
                                 ▼
         [ PgBouncer / Supabase Transaction Pooler (Port 6543) ]
                                 │
                                 ▼
                  [ PostgreSQL Enterprise Database ]
```

---

## ⚡ Key Optimizations Included

1. **Least-Connection Algorithm (`least_conn`)**: Dynamically routes incoming user requests to the backend server with the least active connections, preventing hot-spotting during peak attendance punches.
2. **Static Asset Offloading**: Nginx directly serves and caches Vite bundles, fonts, and images with `immutable` caching, removing ~80% of the CPU load from Node.js.
3. **Database Connection Pooling**: Prisma runtime configuration ensures optimal connection pool sizing (`DATABASE_CONNECTION_LIMIT=25` per worker, 30s timeout) to prevent exhausting PostgreSQL `max_connections`.
4. **WebSocket & SSE Real-time Streaming**: Non-buffered reverse proxy for live biometric alerts (`/api/hikvision/events`) and attendance push events.
5. **Campus NAT IP Friendly Rate Limiting**: The rate limiter keys by authenticated User ID rather than raw IP, so thousands of students on school Wi-Fi or NAT routers never lock each other out.

---

## 🛠️ Quick Deployment Options

### Option 1: Docker Compose (Recommended for Cloud / Dedicated Servers)

Runs Nginx + 4x Node.js Replicas in isolated containers:

```bash
cd deploy/load-balancer
docker-compose up -d --build
```

To scale up to 8 backend replicas during exam results or peak registration:
```bash
docker-compose up -d --scale backend_app_1=2 --scale backend_app_2=2
```

---

### Option 2: Linux / VPS with Nginx + PM2 (Bare-Metal Speed)

1. **Start the Multi-Core Node Cluster with PM2**:
   ```bash
   # Build the project
   npm run build

   # Start across all CPU cores
   pm2 start deploy/load-balancer/ecosystem.config.cjs
   pm2 save
   ```

2. **Install and Configure Nginx**:
   ```bash
   sudo cp deploy/load-balancer/nginx.conf /etc/nginx/nginx.conf
   sudo nginx -t
   sudo systemctl restart nginx
   ```

---

## 🐧 Linux Kernel Sysctl Tuning (For 5,000+ Concurrent TCP Sockets)

Add these settings to `/etc/sysctl.conf` on your production Linux server:

```ini
# Increase maximum open file descriptors
fs.file-max = 2097152

# Increase max pending socket connections
net.core.somaxconn = 65535
net.ipv4.tcp_max_syn_backlog = 65535

# Fast socket recycling and buffer sizing
net.ipv4.tcp_tw_reuse = 1
net.ipv4.tcp_fin_timeout = 15
net.ipv4.ip_local_port_range = 1024 65535
```

Apply immediately:
```bash
sudo sysctl -p
```

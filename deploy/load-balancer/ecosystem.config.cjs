/**
 * ==============================================================================
 * PM2 CLUSTER CONFIGURATION FOR DARSE BURHANI BACKEND
 * Scales Node.js backend across all CPU cores with automatic load distribution
 * ==============================================================================
 *
 * To run:
 *   npm install -g pm2
 *   pm2 start deploy/load-balancer/ecosystem.config.cjs
 *   pm2 save
 */

module.exports = {
  apps: [
    {
      name: "darse-burhani-backend",
      script: "./server/dist/index.js",
      instances: "max", // Utilize all CPU cores automatically
      exec_mode: "cluster",
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        PORT: 4000,
        DATABASE_CONNECTION_LIMIT: 25,
        RATE_LIMIT_GLOBAL_MAX: 15000,
      },
      env_production: {
        NODE_ENV: "production",
        PORT: 4000,
        DATABASE_CONNECTION_LIMIT: 25,
        RATE_LIMIT_GLOBAL_MAX: 15000,
      },
      listen_timeout: 10000,
      kill_timeout: 5000,
      autorestart: true,
      restart_delay: 2000,
      watch: false,
    },
  ],
};

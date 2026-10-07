/**
 * PM2 process file for the Bug Tracker API.
 * Usage: pm2 start deploy/ecosystem.config.cjs --env production
 */
module.exports = {
  apps: [
    {
      name: 'bugtracker-api',
      script: 'src/index.js',
      cwd: 'backend',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
        PORT: 4000,
        TRUST_PROXY: 'true',
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 4000,
        TRUST_PROXY: 'true',
      },
      // Secrets are loaded from backend/.env at runtime; never store them here.
      error_file: 'logs/api-error.log',
      out_file: 'logs/api-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      time: true,
    },
  ],
}
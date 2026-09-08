module.exports = {
  apps: [
    {
      name: 'getsocs-api',
      script: 'server.js',
      cwd: __dirname,
      instances: 1, // Increase only after validating workload/locking characteristics in production.
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        HOST: '127.0.0.1',
        PORT: 3001
      },
      watch: false,
      autorestart: true,
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 1000,
      exp_backoff_restart_delay: 100,
      max_memory_restart: process.env.PM2_MAX_MEMORY_RESTART || '750M',
      kill_timeout: 15000,
      listen_timeout: 10000,
      shutdown_with_message: false,
      merge_logs: true,
      time: true,
      log_date_format: 'YYYY-MM-DDTHH:mm:ss.SSSZ',
      out_file: process.env.PM2_OUT_LOG || './logs/app-out.log',
      error_file: process.env.PM2_ERROR_LOG || './logs/app-error.log'
    }
  ]
};

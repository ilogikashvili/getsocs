module.exports = {
  apps: [
    {
      name: 'getsocs-api',
      script: 'server.js',
      cwd: '/home/mglebi/web/getsocs.com/backend',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        HOST: '0.0.0.0'
      },
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M'
    }
  ]
};

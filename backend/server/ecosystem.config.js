module.exports = {
  apps: [
    {
      name: 'getsocs-api',
      script: 'server.js',
      cwd: __dirname,
      env: {
        NODE_ENV: 'production',
        HOST: '127.0.0.1',
        PORT: 3001
      },
      watch: false,
      autorestart: true,
      max_restarts: 10
    }
  ]
};

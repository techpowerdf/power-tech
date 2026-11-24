module.exports = {
  apps: [
    {
      name: 'infotech-gestao',
      script: 'server/index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env_production: {
        NODE_ENV: 'production',
        PORT: 4567,
        ENABLE_CLOUDFLARE_TUNNEL: 'false'
      }
    }
  ]
};

module.exports = {
  apps: [
    {
      name: 'dc1-provider-onboarding',
      script: 'src/server.js',
      cwd: '/root/dc1-platform/backend',
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production',
        DC1_PROVIDER_PORT: 8083,
        DC1_ADMIN_TOKEN: '9ca7c4f924374229b9c9f584758f055373878dfce3fea309ff192d638756342b'
      }
    }
  ]
};

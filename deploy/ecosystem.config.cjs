// PM2 process file for a VPS without Docker.
//   npm i -g pm2 && pm2 start deploy/ecosystem.config.cjs && pm2 save && pm2 startup
module.exports = {
  apps: [{
    name: 'tawreed',
    cwd: __dirname + '/..',
    script: '.next/standalone/server.js',
    node_args: '--env-file=.env',          // Node 22 reads .env itself
    env: { NODE_ENV: 'production', PORT: '3000', HOSTNAME: '127.0.0.1' },
    instances: 1,
    max_memory_restart: '700M',
    out_file: 'logs/out.log',
    error_file: 'logs/error.log',
    time: true
  }]
};

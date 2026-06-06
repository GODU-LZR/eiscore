// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

module.exports = {
  apps: [
    {
      name: 'eiscore-base',
      cwd: './eiscore-base',
      script: '../scripts/static-spa-server.mjs',
      interpreter: '/home/lzr/.nvm/versions/node/v20.20.0/bin/node',
      args: '--root dist --port 8080 --host 0.0.0.0 --base / --micro-proxy',
      env: {
        NODE_ENV: 'development',
        PORT: 8080
      },
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      error_file: './logs/base-error.log',
      out_file: './logs/base-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    },
    {
      name: 'eiscore-hr',
      cwd: './eiscore-hr',
      script: '../scripts/static-spa-server.mjs',
      interpreter: '/home/lzr/.nvm/versions/node/v20.20.0/bin/node',
      args: '--root dist --port 8082 --host 127.0.0.1 --base /hr',
      env: {
        NODE_ENV: 'development',
        PORT: 8082
      },
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      error_file: './logs/hr-error.log',
      out_file: './logs/hr-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    },
    {
      name: 'eiscore-materials',
      cwd: './eiscore-materials',
      script: '../scripts/static-spa-server.mjs',
      interpreter: '/home/lzr/.nvm/versions/node/v20.20.0/bin/node',
      args: '--root dist --port 8081 --host 127.0.0.1 --base /materials',
      env: {
        NODE_ENV: 'development',
        PORT: 8081
      },
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      error_file: './logs/materials-error.log',
      out_file: './logs/materials-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    },
    {
      name: 'eiscore-apps',
      cwd: './eiscore-apps',
      script: '../scripts/static-spa-server.mjs',
      interpreter: '/home/lzr/.nvm/versions/node/v20.20.0/bin/node',
      args: '--root dist --port 8083 --host 127.0.0.1 --base /apps',
      env: {
        NODE_ENV: 'development',
        PORT: 8083
      },
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      error_file: './logs/apps-error.log',
      out_file: './logs/apps-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    },
    {
      name: 'eiscore-sales',
      cwd: './eiscore-sales',
      script: '../scripts/static-spa-server.mjs',
      interpreter: '/home/lzr/.nvm/versions/node/v20.20.0/bin/node',
      args: '--root dist --port 8085 --host 127.0.0.1 --base /sales',
      env: {
        NODE_ENV: 'development',
        PORT: 8085
      },
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      error_file: './logs/sales-error.log',
      out_file: './logs/sales-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    },
    {
      name: 'eiscore-purchase',
      cwd: './eiscore-purchase',
      script: '../scripts/static-spa-server.mjs',
      interpreter: '/home/lzr/.nvm/versions/node/v20.20.0/bin/node',
      args: '--root dist --port 8088 --host 127.0.0.1 --base /purchase',
      env: {
        NODE_ENV: 'development',
        PORT: 8088
      },
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      error_file: './logs/purchase-error.log',
      out_file: './logs/purchase-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    },
    {
      name: 'eiscore-production',
      cwd: './eiscore-production',
      script: '../scripts/static-spa-server.mjs',
      interpreter: '/home/lzr/.nvm/versions/node/v20.20.0/bin/node',
      args: '--root dist --port 8087 --host 127.0.0.1 --base /production',
      env: {
        NODE_ENV: 'development',
        PORT: 8087
      },
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      error_file: './logs/production-error.log',
      out_file: './logs/production-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    },
    {
      name: 'eiscore-quality',
      cwd: './eiscore-quality',
      script: '../scripts/static-spa-server.mjs',
      interpreter: '/home/lzr/.nvm/versions/node/v20.20.0/bin/node',
      args: '--root dist --port 8089 --host 127.0.0.1 --base /quality',
      env: {
        NODE_ENV: 'development',
        PORT: 8089
      },
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      error_file: './logs/quality-error.log',
      out_file: './logs/quality-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    },
    {
      name: 'eiscore-equipment',
      cwd: './eiscore-equipment',
      script: '../scripts/static-spa-server.mjs',
      interpreter: '/home/lzr/.nvm/versions/node/v20.20.0/bin/node',
      args: '--root dist --port 8090 --host 127.0.0.1 --base /equipment',
      env: {
        NODE_ENV: 'development',
        PORT: 8090
      },
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      error_file: './logs/equipment-error.log',
      out_file: './logs/equipment-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    },
    {
      name: 'eiscore-decision',
      cwd: './eiscore-decision',
      script: '../scripts/static-spa-server.mjs',
      interpreter: '/home/lzr/.nvm/versions/node/v20.20.0/bin/node',
      args: '--root dist --port 8091 --host 127.0.0.1 --base /decision',
      env: {
        NODE_ENV: 'development',
        PORT: 8091
      },
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      error_file: './logs/decision-error.log',
      out_file: './logs/decision-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    },
    {
      name: 'eiscore-mobile',
      cwd: './eiscore-mobile',
      script: '../scripts/static-spa-server.mjs',
      interpreter: '/home/lzr/.nvm/versions/node/v20.20.0/bin/node',
      args: '--root dist --port 8084 --host 127.0.0.1 --base /mobile',
      env: {
        NODE_ENV: 'development',
        PORT: 8084
      },
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      error_file: './logs/mobile-error.log',
      out_file: './logs/mobile-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    }
  ]
}

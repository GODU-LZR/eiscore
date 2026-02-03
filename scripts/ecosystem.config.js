module.exports = {
  apps: [
    {
      name: 'eiscore-base',
      cwd: './eiscore-base',
      script: 'npm',
      args: 'run dev',
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
      script: 'npm',
      args: 'run dev',
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
      script: 'npm',
      args: 'run dev',
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
      script: 'npm',
      args: 'run dev',
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
    }
  ]
}

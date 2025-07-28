module.exports = {
  apps: [
    {
      name: 'relatorio-otimizado',
      script: 'npm',
      args: 'start',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      }
    }
  ]
}
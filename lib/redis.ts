import Redis from 'redis'

const redis = Redis.createClient({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
})

redis.on('error', (err) => {
  console.error('Redis error:', err)
})

export { redis }
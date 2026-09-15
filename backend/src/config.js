const path = require('path');
require('dotenv').config({ path: [path.resolve(__dirname, '../../.env'), path.resolve(__dirname, '../.env'), path.resolve(process.cwd(), '.env')] });

const config = {
    env: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3001', 10),
    
    // Database Config
    db: {
        user: process.env.DB_USER || 'postgres',
        host: process.env.DB_HOST || 'localhost',
        database: process.env.DB_NAME || 'ai_orchestrator',
        password: process.env.DB_PASSWORD || 'postgres',
        port: parseInt(process.env.DB_PORT || '5432', 10),
        maxConnections: parseInt(process.env.DB_POOL_MAX || '20', 10),
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000
    },

    // Redis Config (optional distributed caching & queue)
    redis: {
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        enabled: Boolean(process.env.REDIS_ENABLED === 'true')
    },

    // Scalability & Queue Concurrency Limits
    queue: {
        maxConcurrentInferences: parseInt(process.env.MAX_CONCURRENT_INFERENCES || '8', 10),
        taskTimeoutMs: parseInt(process.env.TASK_TIMEOUT_MS || '30000', 10)
    },

    // Semantic / Intent Caching
    cache: {
        enabled: process.env.CACHE_ENABLED !== 'false',
        ttlSeconds: parseInt(process.env.CACHE_TTL_SECONDS || '3600', 10), // 1 hour
        maxSize: parseInt(process.env.CACHE_MAX_SIZE || '1000', 10)
    },

    // Rate Limiting
    rateLimit: {
        windowMs: 60 * 1000, // 1 minute
        maxRequestsPerWindow: parseInt(process.env.RATE_LIMIT_MAX || '120', 10)
    },

    // AI Model
    model: {
        apiKey: process.env.OPENROUTER_API_KEY,
        defaultModel: process.env.OPENROUTER_MODEL || 'qwen/qwen3.8-flash'
    }
};

module.exports = { config };

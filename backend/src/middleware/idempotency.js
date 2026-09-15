const crypto = require('crypto');

class IdempotencyManager {
    constructor() {
        this.store = new Map(); // key -> { status: 'PENDING'|'RESOLVED', response, timestamp }
        // Cleanup entries older than 24 hours
        setInterval(() => this.cleanup(), 60 * 60 * 1000).unref();
    }

    cleanup() {
        const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
        for (const [key, item] of this.store.entries()) {
            if (item.timestamp < oneDayAgo) {
                this.store.delete(key);
            }
        }
    }

    handle(req, res, next) {
        // Only enforce on mutating methods
        if (req.method !== 'POST' && req.method !== 'PUT' && req.method !== 'PATCH') {
            return next();
        }

        const idempotencyKey = req.headers['idempotency-key'] || 
            (req.body ? crypto.createHash('sha256').update(JSON.stringify(req.body)).digest('hex') : null);

        if (!idempotencyKey) {
            return next();
        }

        const existing = this.store.get(idempotencyKey);
        if (existing) {
            if (existing.status === 'RESOLVED') {
                res.setHeader('X-Idempotent-Replay', 'true');
                res.setHeader('X-Idempotency-Key', idempotencyKey);
                return res.status(existing.statusCode || 200).json(existing.response);
            } else if (existing.status === 'PENDING') {
                return res.status(409).json({
                    error: 'Conflict',
                    message: 'An identical request is currently being processed. Please wait.'
                });
            }
        }

        // Register pending state
        this.store.set(idempotencyKey, {
            status: 'PENDING',
            timestamp: Date.now()
        });

        // Intercept res.json to capture response
        const originalJson = res.json.bind(res);
        res.json = (body) => {
            this.store.set(idempotencyKey, {
                status: 'RESOLVED',
                statusCode: res.statusCode || 200,
                response: body,
                timestamp: Date.now()
            });
            res.setHeader('X-Idempotency-Key', idempotencyKey);
            return originalJson(body);
        };

        next();
    }
}

const idempotencyManager = new IdempotencyManager();

module.exports = { 
    idempotency: (req, res, next) => idempotencyManager.handle(req, res, next) 
};

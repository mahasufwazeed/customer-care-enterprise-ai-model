const crypto = require('crypto');
const { config } = require('../config');

class IntentCache {
    constructor() {
        this.cache = new Map();
        this.hits = 0;
        this.misses = 0;
        this.maxSize = config.cache.maxSize;
        this.defaultTtl = config.cache.ttlSeconds * 1000;

        // Background cache cleanup every 5 minutes
        setInterval(() => this.cleanup(), 5 * 60 * 1000).unref();
    }

    normalizeKey(input) {
        if (!input) return '';
        // Normalize whitespace, casing, and punctuation for maximum hit rate
        const cleaned = input.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
        return crypto.createHash('sha256').update(cleaned).digest('hex');
    }

    get(input) {
        if (!config.cache.enabled) return null;

        const key = this.normalizeKey(input);
        const entry = this.cache.get(key);

        if (!entry) {
            this.misses++;
            return null;
        }

        if (Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            this.misses++;
            return null;
        }

        this.hits++;
        return {
            ...entry.data,
            _cached: true,
            _cache_latency_ms: 2
        };
    }

    set(input, data, customTtlMs) {
        if (!config.cache.enabled) return;

        // Evict oldest entry if size exceeded
        if (this.cache.size >= this.maxSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }

        const key = this.normalizeKey(input);
        const ttl = customTtlMs || this.defaultTtl;

        this.cache.set(key, {
            data,
            expiresAt: Date.now() + ttl,
            createdAt: Date.now()
        });
    }

    cleanup() {
        const now = Date.now();
        for (const [key, entry] of this.cache.entries()) {
            if (now > entry.expiresAt) {
                this.cache.delete(key);
            }
        }
    }

    getStats() {
        const total = this.hits + this.misses;
        const hitRatio = total > 0 ? ((this.hits / total) * 100).toFixed(1) + '%' : '0.0%';
        return {
            hits: this.hits,
            misses: this.misses,
            totalRequests: total,
            hitRatio,
            cachedEntries: this.cache.size
        };
    }
}

const intentCache = new IntentCache();

module.exports = { intentCache };

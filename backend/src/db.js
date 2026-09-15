const { Pool } = require('pg');
const crypto = require('crypto');
const { config } = require('./config');

const realPool = new Pool({
    user: config.db.user,
    host: config.db.host,
    database: config.db.database,
    password: config.db.password,
    port: config.db.port,
    max: config.db.maxConnections,
    idleTimeoutMillis: config.db.idleTimeoutMillis,
    connectionTimeoutMillis: config.db.connectionTimeoutMillis
});

// In-memory fallback database
const memoryDb = {
    tickets: [],
    logs: [],
    transactions: []
};

let postgresHealthy = false;

async function checkPostgresHealth() {
    try {
        const client = await realPool.connect();
        client.release();
        if (!postgresHealthy) {
            console.log('PostgreSQL connection established and healthy.');
        }
        postgresHealthy = true;
    } catch (err) {
        if (postgresHealthy) {
            console.warn(`[Database Notice] PostgreSQL disconnected (${err.code || err.message}). Failing over to in-memory mode.`);
        }
        postgresHealthy = false;
    }
    return postgresHealthy;
}

// Initial health check + periodic auto-reconnect polling (every 10s)
checkPostgresHealth();
setInterval(checkPostgresHealth, 10000).unref();

/**
 * Fallback query processor for development without active local Postgres
 */
function runMemoryQuery(text, params = []) {
    const cleanQuery = text.trim();
    const upper = cleanQuery.toUpperCase();

    // Transactions BEGIN/COMMIT/ROLLBACK
    if (upper === 'BEGIN' || upper === 'COMMIT' || upper === 'ROLLBACK') {
        return { rows: [], rowCount: 0 };
    }

    // INSERT INTO tickets (...) VALUES (...) RETURNING id
    if (upper.startsWith('INSERT INTO TICKETS')) {
        const id = crypto.randomUUID();
        const ticket = {
            id,
            user_id: null,
            intent_extracted: params[0] || 'UNKNOWN',
            status: params[1] || 'PENDING',
            confidence_score: params[2] || 0.0,
            fraud_flag: params[3] || false,
            policy_audit_passed: params[4] || true,
            requires_human_handoff: params[5] || false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        memoryDb.tickets.unshift(ticket);
        return { rows: [{ id }], rowCount: 1 };
    }

    // UPDATE tickets SET ...
    if (upper.startsWith('UPDATE TICKETS')) {
        // Find ticket ID from params (either last param or param 5)
        const id = params[params.length - 1];
        const ticket = memoryDb.tickets.find(t => t.id === id);
        if (ticket) {
            if (params.length >= 6) {
                ticket.status = params[0];
                ticket.confidence_score = params[1];
                ticket.fraud_flag = params[2];
                ticket.policy_audit_passed = params[3];
                ticket.requires_human_handoff = params[4];
            } else if (params.length >= 2) {
                ticket.status = params[0];
                if (params.length >= 3 && typeof params[1] === 'boolean') {
                    ticket.requires_human_handoff = params[1];
                }
            }
            ticket.updated_at = new Date().toISOString();
        }
        return { rows: ticket ? [ticket] : [], rowCount: ticket ? 1 : 0 };
    }

    // INSERT INTO logs
    if (upper.startsWith('INSERT INTO LOGS')) {
        const id = crypto.randomUUID();
        const log = {
            id,
            ticket_id: params[0],
            agent_name: params[1],
            action_type: params[2],
            evidence_payload: typeof params[3] === 'string' ? JSON.parse(params[3]) : params[3],
            message: params[4],
            created_at: new Date().toISOString()
        };
        memoryDb.logs.push(log);
        return { rows: [{ id }], rowCount: 1 };
    }

    // INSERT INTO transactions
    if (upper.startsWith('INSERT INTO TRANSACTIONS')) {
        const id = crypto.randomUUID();
        const trx = {
            id,
            ticket_id: params[0],
            system_origin: params[1],
            transaction_type: params[2],
            amount: params[3],
            currency: params[4],
            transaction_status: params[5],
            created_at: new Date().toISOString()
        };
        memoryDb.transactions.push(trx);
        return { rows: [{ id }], rowCount: 1 };
    }

    // SELECT * FROM tickets ORDER BY created_at DESC
    if (upper.includes('FROM TICKETS WHERE ID = $1')) {
        const id = params[0];
        const ticket = memoryDb.tickets.find(t => t.id === id);
        return { rows: ticket ? [ticket] : [], rowCount: ticket ? 1 : 0 };
    }

    if (upper.includes('FROM TICKETS')) {
        return { rows: [...memoryDb.tickets], rowCount: memoryDb.tickets.length };
    }

    // SELECT * FROM logs WHERE ticket_id = $1
    if (upper.includes('FROM LOGS WHERE TICKET_ID = $1')) {
        const ticketId = params[0];
        const logs = memoryDb.logs.filter(l => l.ticket_id === ticketId);
        return { rows: logs, rowCount: logs.length };
    }

    // SELECT * FROM transactions WHERE ticket_id = $1
    if (upper.includes('FROM TRANSACTIONS WHERE TICKET_ID = $1')) {
        const ticketId = params[0];
        const trxs = memoryDb.transactions.filter(t => t.ticket_id === ticketId);
        return { rows: trxs, rowCount: trxs.length };
    }

    return { rows: [], rowCount: 0 };
}

// Resilient pool wrapper
const pool = {
    async query(text, params) {
        if (postgresHealthy) {
            try {
                return await realPool.query(text, params);
            } catch (err) {
                console.warn('[Postgres Query Fallback]', err.message);
                return runMemoryQuery(text, params);
            }
        }
        return runMemoryQuery(text, params);
    },

    async connect() {
        if (postgresHealthy) {
            try {
                return await realPool.connect();
            } catch (err) {
                // fall through to memory client
            }
        }

        // Mock client interface for transactions
        return {
            query: async (text, params) => runMemoryQuery(text, params),
            release: () => {}
        };
    },

    isPostgresHealthy: () => postgresHealthy,
    
    async drain() {
        console.log('Draining PostgreSQL pool...');
        try {
            await realPool.end();
            console.log('PostgreSQL pool drained successfully.');
        } catch (e) {
            console.error('Error draining pool:', e);
        }
    }
};

function getDbStats() {
    return {
        postgresHealthy,
        totalMemoryTickets: memoryDb.tickets.length,
        totalMemoryLogs: memoryDb.logs.length,
        totalMemoryTransactions: memoryDb.transactions.length,
        poolConfig: {
            host: config.db.host,
            database: config.db.database,
            maxConnections: config.db.maxConnections
        }
    };
}

module.exports = { pool, getDbStats };

const { pool } = require('../src/db');
const { 
    extractIntentWithQwen, 
    correlateEvidenceWithQwen, 
    DEFAULT_MODEL 
} = require('./qwenClient');

/**
 * Dispatches EnterPro sub-agents in parallel across enterprise systems
 */
async function enterProDispatch(intent) {
    const promises = [
        new Promise(resolve => setTimeout(() => resolve({ 
            system: 'Billing', 
            status: 'OK', 
            lifetime_value: 1200.50, 
            recent_failed_charges: 0 
        }), 200)),
        new Promise(resolve => setTimeout(() => resolve({ 
            system: 'CRM', 
            tier: 'PRO', 
            user_age_days: 340, 
            account_standing: 'GOOD' 
        }), 180)),
        new Promise(resolve => setTimeout(() => resolve({ 
            system: 'Logistics', 
            pending_shipments: 1, 
            alerts: [] 
        }), 220))
    ];

    return await Promise.all(promises);
}

/**
 * End-to-end request processing with Qwen 3.8 Flash & EnterPro
 */
async function processRequest(input) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Qwen 3.8 Flash Intent Extraction
        const qwenResult = await extractIntentWithQwen(input);

        const ticketRes = await client.query(
            `INSERT INTO tickets (intent_extracted, status, confidence_score, fraud_flag, policy_audit_passed, requires_human_handoff) 
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
            [qwenResult.intent, 'PENDING', qwenResult.confidence || 0, false, true, false]
        );
        const ticketId = ticketRes.rows[0].id;

        await client.query(
            `INSERT INTO logs (ticket_id, agent_name, action_type, evidence_payload, message) VALUES ($1, $2, $3, $4, $5)`,
            [
                ticketId, 
                'Qwen 3.8 Flash', 
                'INTENT_EXTRACTION', 
                qwenResult, 
                `Extracted intent [${qwenResult.intent}] using ${qwenResult.model}`
            ]
        );

        let finalAction = '';
        let requiresHandoff = false;
        let agentFindings = [];
        let verification = {};

        if (qwenResult.execution_path === 'PARALLEL_DISPATCH') {
            // 2. EnterPro Agent Dispatch
            agentFindings = await enterProDispatch(qwenResult.intent);

            await client.query(
                `INSERT INTO logs (ticket_id, agent_name, action_type, evidence_payload, message) VALUES ($1, $2, $3, $4, $5)`,
                [
                    ticketId, 
                    'EnterPro Orchestrator', 
                    'PARALLEL_DISPATCH', 
                    JSON.stringify(agentFindings), 
                    'Dispatched sub-agents (Billing, CRM, Logistics) in parallel'
                ]
            );

            // 3. Qwen 3.8 Flash Evidence Correlation & Audit
            verification = await correlateEvidenceWithQwen(input, qwenResult, agentFindings);

            await client.query(
                `INSERT INTO logs (ticket_id, agent_name, action_type, evidence_payload, message) VALUES ($1, $2, $3, $4, $5)`,
                [
                    ticketId, 
                    'Qwen 3.8 Flash', 
                    'EVIDENCE_CORRELATION', 
                    verification, 
                    `Audit: Score ${verification.confidenceScore}%, Fraud: ${verification.fraudFlag}`
                ]
            );

            if (verification.fraudFlag || !verification.policyAuditPassed || verification.confidenceScore < 70) {
                finalAction = 'HIGH_RISK_HANDOFF';
                requiresHandoff = true;
            } else {
                finalAction = 'AUTO_EXECUTED';
                await client.query(
                    `INSERT INTO transactions (ticket_id, system_origin, transaction_type, amount, currency, transaction_status) VALUES ($1, $2, $3, $4, $5, $6)`,
                    [ticketId, 'EnterPro Engine', qwenResult.intent, 0, 'USD', 'SUCCESS']
                );
            }
        } else {
            finalAction = 'HIGH_RISK_HANDOFF';
            requiresHandoff = true;
            verification = { 
                confidenceScore: 15.0, 
                fraudFlag: false, 
                policyAuditPassed: false,
                reasoning: 'Ticket escalated immediately based on intent risk profile'
            };
        }

        await client.query(
            `UPDATE tickets SET status = $1, confidence_score = $2, fraud_flag = $3, policy_audit_passed = $4, requires_human_handoff = $5, updated_at = CURRENT_TIMESTAMP WHERE id = $6`,
            [finalAction, verification.confidenceScore, verification.fraudFlag, verification.policyAuditPassed, requiresHandoff, ticketId]
        );

        await client.query('COMMIT');

        return {
            ticket: {
                id: ticketId,
                input,
                intent: qwenResult.intent,
                status: finalAction,
                confidence_score: verification.confidenceScore,
                fraud_flag: verification.fraudFlag,
                requires_human_handoff: requiresHandoff,
                model_used: qwenResult.model,
                reasoning: qwenResult.reasoning
            },
            steps: [
                { 
                    step: 'Qwen 3.8 Flash Intent Extraction', 
                    agent: 'Qwen AI',
                    model: qwenResult.model,
                    result: qwenResult 
                },
                { 
                    step: 'EnterPro Agent Dispatch', 
                    agent: 'EnterPro Orchestrator',
                    result: agentFindings 
                },
                { 
                    step: 'Reasoning & Evidence Correlation', 
                    agent: 'Qwen AI Audit',
                    result: verification 
                },
                { 
                    step: 'Action & Execution', 
                    result: finalAction 
                }
            ]
        };

    } catch (e) {
        await client.query('ROLLBACK');
        console.error('[Orchestration Error]', e);
        throw e;
    } finally {
        client.release();
    }
}

module.exports = { 
    processRequest,
    enterProDispatch,
    DEFAULT_MODEL
};

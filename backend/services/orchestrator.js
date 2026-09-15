const { pool } = require('../db');

async function qwenIntentExtraction(input) {
    let intent = 'UNKNOWN';
    if (input.toLowerCase().includes('refund') || input.toLowerCase().includes('charge')) {
        intent = 'BILLING_ISSUE';
    } else if (input.toLowerCase().includes('where') || input.toLowerCase().includes('shipment')) {
        intent = 'LOGISTICS_TRACKING';
    } else if (input.toLowerCase().includes('upgrade') || input.toLowerCase().includes('tier')) {
        intent = 'ACCOUNT_UPGRADE';
    }

    return {
        intent,
        extracted_entities: { keywords: input.split(' ') },
        execution_path: intent !== 'UNKNOWN' ? 'PARALLEL_DISPATCH' : 'ESCALATE'
    };
}

async function enterProDispatch(intent) {
    const promises = [
        new Promise(resolve => setTimeout(() => resolve({ system: 'Billing', status: 'OK', lifetime_value: 1200.50, recent_failed_charges: 0 }), 500)),
        new Promise(resolve => setTimeout(() => resolve({ system: 'CRM', tier: 'PRO', user_age_days: 340, account_standing: 'GOOD' }), 450)),
        new Promise(resolve => setTimeout(() => resolve({ system: 'Logistics', pending_shipments: 1, alerts: [] }), 600))
    ];

    return await Promise.all(promises);
}

async function verifyAndAudit(qwenResult, agentFindings) {
    let confidenceScore = 85.0;
    let fraudFlag = false;
    let policyAuditPassed = true;

    const billing = agentFindings.find(a => a.system === 'Billing');

    if (billing && billing.recent_failed_charges > 0) {
        confidenceScore -= 30;
        fraudFlag = true;
    }
    if (qwenResult.intent === 'UNKNOWN') {
        confidenceScore = 15.0;
        policyAuditPassed = false;
    }

    if (Math.random() < 0.2) {
        confidenceScore -= 40;
        policyAuditPassed = false;
    }

    return { confidenceScore, fraudFlag, policyAuditPassed };
}

async function processRequest(input) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Qwen Intent
        const qwenResult = await qwenIntentExtraction(input);

        const ticketRes = await client.query(
            `INSERT INTO tickets (intent_extracted, status, confidence_score, fraud_flag, policy_audit_passed, requires_human_handoff) 
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
            [qwenResult.intent, 'PENDING', 0, false, true, false]
        );
        const ticketId = ticketRes.rows[0].id;

        await client.query(
            `INSERT INTO logs (ticket_id, agent_name, action_type, evidence_payload, message) VALUES ($1, $2, $3, $4, $5)`,
            [ticketId, 'Qwen AI', 'INTENT_EXTRACTION', qwenResult, 'Extracted intent from user input']
        );

        let finalAction = '';
        let requiresHandoff = false;
        let agentFindings = [];
        let verification = {};

        if (qwenResult.execution_path === 'PARALLEL_DISPATCH') {
            agentFindings = await enterProDispatch(qwenResult.intent);

            await client.query(
                `INSERT INTO logs (ticket_id, agent_name, action_type, evidence_payload, message) VALUES ($1, $2, $3, $4, $5)`,
                [ticketId, 'EnterPro', 'PARALLEL_DISPATCH', JSON.stringify(agentFindings), 'Dispatched sub-agents and collected findings']
            );

            verification = await verifyAndAudit(qwenResult, agentFindings);

            if (verification.fraudFlag || !verification.policyAuditPassed || verification.confidenceScore < 70) {
                finalAction = 'HIGH_RISK_HANDOFF';
                requiresHandoff = true;
            } else {
                finalAction = 'AUTO_EXECUTED';
                await client.query(
                    `INSERT INTO transactions (ticket_id, system_origin, transaction_type, amount, currency, transaction_status) VALUES ($1, $2, $3, $4, $5, $6)`,
                    [ticketId, 'System', qwenResult.intent, 0, 'USD', 'SUCCESS']
                );
            }
        } else {
            finalAction = 'HIGH_RISK_HANDOFF';
            requiresHandoff = true;
            verification = { confidenceScore: 10.0, fraudFlag: false, policyAuditPassed: false };
        }

        await client.query(
            `UPDATE tickets SET status = $1, confidence_score = $2, fraud_flag = $3, policy_audit_passed = $4, requires_human_handoff = $5, updated_at = CURRENT_TIMESTAMP WHERE id = $6`,
            [finalAction, verification.confidenceScore, verification.fraudFlag, verification.policyAuditPassed, requiresHandoff, ticketId]
        );

        await client.query('COMMIT');

        return {
            ticket: {
                id: ticketId, input, intent: qwenResult.intent, status: finalAction,
                confidence_score: verification.confidenceScore, fraud_flag: verification.fraudFlag,
                requires_human_handoff: requiresHandoff
            },
            steps: [
                { step: 'Qwen Intent Extraction', result: qwenResult },
                { step: 'EnterPro Agent Dispatch', result: agentFindings },
                { step: 'Verify & Audit', result: verification },
                { step: 'Action', result: finalAction }
            ]
        };

    } catch (e) {
        await client.query('ROLLBACK');
        console.error(e);
        throw e;
    } finally {
        client.release();
    }
}

module.exports = { processRequest };

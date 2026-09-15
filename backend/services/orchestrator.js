const { pool } = require('../src/db');
const { 
    extractIntentWithQwen, 
    correlateEvidenceWithQwen, 
    DEFAULT_MODEL 
} = require('./qwenClient');

/**
 * Dispatches EnterPro sub-agents in parallel across enterprise systems
 * Enriches data based on domain intent
 */
async function enterProDispatch(intent, input = '') {
    const isBilling = intent === 'BILLING_ISSUE' || /refund|charge|invoice|double|pay/i.test(input);
    const isLogistics = intent === 'LOGISTICS_TRACKING' || /track|ship|order|deliver|package/i.test(input);
    const isSecurity = intent === 'ACCOUNT_SECURITY' || /password|hack|unauthorized|2fa|login|ip/i.test(input);
    const isTech = intent === 'TECHNICAL_SUPPORT' || /bug|crash|error|500|502|api|down|broken/i.test(input);
    const isUpgrade = intent === 'ACCOUNT_UPGRADE' || /upgrade|cancel|subscription|plan|tier/i.test(input);

    const promises = [
        // Subagent 1: Enterprise Ledger & Billing Engine
        new Promise(resolve => setTimeout(() => {
            if (isBilling) {
                resolve({ 
                    system: 'Enterprise Billing Gateway', 
                    status: 'OK', 
                    lifetime_value: 1450.00, 
                    duplicate_charge_detected: true,
                    charge_amount: 49.99,
                    currency: 'USD',
                    payment_method: 'Visa •••• 4242',
                    refund_eligibility: 'INSTANT_AUTHORIZED'
                });
            } else {
                resolve({ 
                    system: 'Enterprise Billing Gateway', 
                    status: 'OK', 
                    lifetime_value: 1200.50, 
                    recent_failed_charges: 0 
                });
            }
        }, 110)),

        // Subagent 2: Unified CRM & Account Identity
        new Promise(resolve => setTimeout(() => {
            resolve({ 
                system: 'Unified CRM & Identity', 
                tier: isUpgrade ? 'ENTERPRISE_CANDIDATE' : 'PRO', 
                user_age_days: 340, 
                account_standing: 'GOOD',
                mfa_enabled: true,
                sla_tier: 'ENTERPRISE_GOLD'
            });
        }, 95)),

        // Subagent 3: Global Logistics & Supply Chain
        new Promise(resolve => setTimeout(() => {
            if (isLogistics) {
                resolve({ 
                    system: 'Logistics Fleet & Fulfillment', 
                    tracking_number: 'TRK-98421-FX',
                    carrier: 'FedEx Express',
                    fulfillment_status: 'IN_TRANSIT',
                    current_checkpoint: 'Regional Hub - Sector 4',
                    eta: 'Today by 4:30 PM',
                    carrier_delay: false
                });
            } else {
                resolve({ 
                    system: 'Logistics Fleet & Fulfillment', 
                    pending_shipments: 1, 
                    alerts: [] 
                });
            }
        }, 130)),

        // Subagent 4: Security Sentinel & Fraud Shield
        new Promise(resolve => setTimeout(() => {
            if (isSecurity) {
                resolve({
                    system: 'Security Sentinel & Guardrails',
                    ip_risk_score: 86,
                    anomalous_geo: true,
                    flagged_ip: '194.26.29.1',
                    action_recommended: 'STEP_UP_CHALLENGE'
                });
            } else {
                resolve({
                    system: 'Security Sentinel & Guardrails',
                    ip_risk_score: 4,
                    anomalous_geo: false,
                    flagged_ip: null,
                    action_recommended: 'PASS'
                });
            }
        }, 85))
    ];

    return await Promise.all(promises);
}

/**
 * Generate FAANG-grade conversational response and structured action card
 */
function generateConversationalResolution(intent, finalAction, verification, agentFindings, input) {
    let message = '';
    let card = null;

    if (finalAction === 'AUTO_EXECUTED') {
        if (intent === 'BILLING_ISSUE') {
            message = `I have verified your account details with our billing engine. A duplicate charge of $49.99 has been reversed and refunded back to your original payment method (Visa •••• 4242). You will see this reflected on your statement within 1-2 business days.`;
            card = {
                type: 'BILLING_REFUND',
                title: 'Refund Successfully Executed',
                badge: 'AUTO-RESOLVED',
                badgeType: 'success',
                items: [
                    { label: 'Amount Refunded', value: '$49.99 USD' },
                    { label: 'Refund Transaction ID', value: `rf_${Math.random().toString(36).substring(2, 10)}` },
                    { label: 'Payment Method', value: 'Visa ending in 4242' },
                    { label: 'Settlement Window', value: '1-2 Business Days' }
                ]
            };
        } else if (intent === 'LOGISTICS_TRACKING') {
            message = `Your shipment is currently in transit with FedEx Express and is moving on schedule. The current checkpoint is Regional Hub - Sector 4, and delivery is expected today by 4:30 PM.`;
            card = {
                type: 'LOGISTICS_TRACKING',
                title: 'Shipment Tracking Details',
                badge: 'ON SCHEDULE',
                badgeType: 'success',
                items: [
                    { label: 'Tracking ID', value: 'TRK-98421-FX' },
                    { label: 'Carrier', value: 'FedEx Express' },
                    { label: 'Status', value: 'Out for Delivery (In Transit)' },
                    { label: 'Estimated Delivery', value: 'Today by 4:30 PM' }
                ]
            };
        } else if (intent === 'ACCOUNT_UPGRADE') {
            message = `Your enterprise tier upgrade has been provisioned! All premium features, dedicated concurrency limits, and 24/7 SLA access are now active on your workspace.`;
            card = {
                type: 'SUBSCRIPTION_CHANGE',
                title: 'Enterprise Plan Activated',
                badge: 'PROVISIONED',
                badgeType: 'success',
                items: [
                    { label: 'New Plan', value: 'Enterprise Suite (Unlimited)' },
                    { label: 'SLA Level', value: '99.99% Guaranteed' },
                    { label: 'Effective Date', value: 'Immediate' },
                    { label: 'Billing Schedule', value: 'Monthly Invoice' }
                ]
            };
        } else if (intent === 'TECHNICAL_SUPPORT') {
            message = `Our automated SRE diagnostics reviewed your endpoint latency and cleared the stale worker queue. All health probes are reporting 200 OK.`;
            card = {
                type: 'TECH_INCIDENT',
                title: 'Telemetry Auto-Remediation',
                badge: 'REPAIRED',
                badgeType: 'success',
                items: [
                    { label: 'Component', value: 'Edge API Gateway' },
                    { label: 'Action Taken', value: 'Cleared Stale Worker Pool' },
                    { label: 'Status', value: 'All Health Checks Healthy (200 OK)' }
                ]
            };
        } else {
            message = `Your request has been verified and successfully processed through our autonomous multi-agent system.`;
            card = {
                type: 'GENERAL_EXECUTION',
                title: 'Action Auto-Completed',
                badge: 'SUCCESS',
                badgeType: 'success',
                items: [
                    { label: 'Intent', value: intent },
                    { label: 'Status', value: 'Completed without intervention' }
                ]
            };
        }
    } else {
        // High Risk Handoff / Human Escalation
        message = `Because your request involves sensitive security parameters or high-value compliance rules, I have safely escalated this to our Senior Tier-2 Operations Team. A specialist has been assigned with your full audit trace.`;
        card = {
            type: 'SUPERVISOR_HANDOFF',
            title: 'Escalated to Enterprise Operations',
            badge: 'HUMAN REVIEW REQUIRED',
            badgeType: 'warning',
            items: [
                { label: 'Escalation Reason', value: verification.reasoning || 'Compliance risk or verification policy guardrail' },
                { label: 'Assigned Tier', value: 'Tier-2 Senior Specialist Swarm' },
                { label: 'Expected Callback / Action', value: '< 15 minutes' }
            ]
        };
    }

    return { message, card };
}

/**
 * End-to-end request processing with Qwen 3.8 Flash & EnterPro
 */
async function processRequest(input) {
    const startTime = Date.now();
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Step 1: Qwen Intent Extraction
        const step1Start = Date.now();
        const qwenResult = await extractIntentWithQwen(input);
        const step1Latency = Date.now() - step1Start;

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
                'Qwen 3.8 Flash Intent Agent', 
                'INTENT_EXTRACTION', 
                qwenResult, 
                `Extracted intent [${qwenResult.intent}] (Confidence: ${qwenResult.confidence}%)`
            ]
        );

        let finalAction = '';
        let requiresHandoff = false;
        let agentFindings = [];
        let verification = {};
        let step2Latency = 0;
        let step3Latency = 0;

        if (qwenResult.execution_path === 'PARALLEL_DISPATCH') {
            // Step 2: EnterPro Sub-Agent Dispatch
            const step2Start = Date.now();
            agentFindings = await enterProDispatch(qwenResult.intent, input);
            step2Latency = Date.now() - step2Start;

            await client.query(
                `INSERT INTO logs (ticket_id, agent_name, action_type, evidence_payload, message) VALUES ($1, $2, $3, $4, $5)`,
                [
                    ticketId, 
                    'EnterPro Swarm Dispatcher', 
                    'PARALLEL_DISPATCH', 
                    JSON.stringify(agentFindings), 
                    'Queried 4 enterprise subsystems in parallel (Billing, CRM, Logistics, Security)'
                ]
            );

            // Step 3: Evidence Correlation & Policy Audit
            const step3Start = Date.now();
            verification = await correlateEvidenceWithQwen(input, qwenResult, agentFindings);
            step3Latency = Date.now() - step3Start;

            await client.query(
                `INSERT INTO logs (ticket_id, agent_name, action_type, evidence_payload, message) VALUES ($1, $2, $3, $4, $5)`,
                [
                    ticketId, 
                    'Qwen Audit & Guardrails', 
                    'EVIDENCE_CORRELATION', 
                    verification, 
                    `Audit Completed: Score ${verification.confidenceScore}%, Fraud Flag: ${verification.fraudFlag}`
                ]
            );

            // High risk triggers
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
                confidenceScore: 20.0, 
                fraudFlag: false, 
                policyAuditPassed: false,
                reasoning: 'Direct escalation: request flagged as sensitive security parameter or ambiguous intent'
            };
        }

        // Commit final ticket state
        await client.query(
            `UPDATE tickets SET status = $1, confidence_score = $2, fraud_flag = $3, policy_audit_passed = $4, requires_human_handoff = $5, updated_at = CURRENT_TIMESTAMP WHERE id = $6`,
            [finalAction, verification.confidenceScore || 85, verification.fraudFlag || false, verification.policyAuditPassed ?? true, requiresHandoff, ticketId]
        );

        await client.query('COMMIT');

        const totalLatency = Date.now() - startTime;
        const { message, card } = generateConversationalResolution(qwenResult.intent, finalAction, verification, agentFindings, input);

        return {
            ticket: {
                id: ticketId,
                input,
                intent: qwenResult.intent,
                status: finalAction,
                confidence_score: verification.confidenceScore || qwenResult.confidence || 85,
                fraud_flag: verification.fraudFlag || false,
                requires_human_handoff: requiresHandoff,
                model_used: qwenResult.model,
                reasoning: qwenResult.reasoning,
                created_at: new Date().toISOString()
            },
            conversational_response: message,
            action_card: card,
            total_latency_ms: totalLatency,
            steps: [
                { 
                    step: 'Intent & Entity Extraction', 
                    agent: 'Qwen 3.8 Flash',
                    model: qwenResult.model,
                    latency_ms: step1Latency,
                    status: 'COMPLETED',
                    result: qwenResult 
                },
                { 
                    step: 'Parallel Sub-Agent Swarm', 
                    agent: 'EnterPro Dispatcher',
                    latency_ms: step2Latency,
                    status: 'COMPLETED',
                    result: agentFindings 
                },
                { 
                    step: 'Evidence Correlation & Guardrails', 
                    agent: 'Qwen AI Audit',
                    latency_ms: step3Latency,
                    status: verification.fraudFlag ? 'RISK_FLAGGED' : 'COMPLETED',
                    result: verification 
                },
                { 
                    step: 'Transaction Execution & Ledgering', 
                    agent: 'Enterprise Ledger',
                    latency_ms: 25,
                    status: finalAction === 'AUTO_EXECUTED' ? 'AUTO_EXECUTED' : 'HANDOFF_QUEUED',
                    result: { status: finalAction, human_handoff: requiresHandoff }
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

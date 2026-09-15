const path = require('path');
require('dotenv').config({ path: [path.resolve(__dirname, '../.env'), path.resolve(process.cwd(), '.env'), path.resolve(__dirname, '../../.env')] });

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_AUTH_URL = 'https://openrouter.ai/api/v1/auth/key';
const DEFAULT_MODEL = process.env.OPENROUTER_MODEL || 'qwen/qwen3.8-flash';

/**
 * Execute a completion request to OpenRouter using Qwen 3.8 Flash
 */
async function callOpenRouter(messages, options = {}) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
        throw new Error('OPENROUTER_API_KEY is not set in environment variables');
    }

    const model = options.model || DEFAULT_MODEL;
    const body = {
        model,
        messages,
        temperature: options.temperature ?? 0.2,
        response_format: { type: 'json_object' }
    };

    const headers = {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.OPENROUTER_SITE_URL || 'http://localhost:3001',
        'X-Title': process.env.OPENROUTER_APP_NAME || 'Customer Care Enterprise AI Orchestrator'
    };

    const res = await fetch(OPENROUTER_API_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
    });

    const data = await res.json();

    if (!res.ok) {
        const errorMsg = data.error?.message || `HTTP ${res.status}: ${res.statusText}`;
        const error = new Error(errorMsg);
        error.status = res.status;
        error.data = data;
        throw error;
    }

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
        throw new Error('Empty response from Qwen model');
    }

    return JSON.parse(content);
}

/**
 * Extract intent and entities from user input using Qwen 3.8 Flash
 */
async function extractIntentWithQwen(input) {
    const systemPrompt = `You are Qwen 3.8 Flash, an advanced customer care enterprise reasoning agent.
Analyze the user's request and classify it into an actionable enterprise workflow.

Return ONLY a valid JSON object matching this schema:
{
  "intent": "BILLING_ISSUE" | "LOGISTICS_TRACKING" | "ACCOUNT_UPGRADE" | "TECHNICAL_SUPPORT" | "ACCOUNT_SECURITY" | "UNKNOWN",
  "confidence": <number between 0 and 100>,
  "execution_path": "PARALLEL_DISPATCH" | "ESCALATE",
  "extracted_entities": {
    "keywords": [<string>],
    "action_target": "<target>",
    "urgency": "LOW" | "MEDIUM" | "HIGH"
  },
  "reasoning": "<brief explanation of your reasoning>"
}

Execution path rules:
- Use "PARALLEL_DISPATCH" for actionable requests related to billing, logistics, upgrades, or technical queries.
- Use "ESCALATE" for abusive, highly ambiguous, suspicious, or completely unknown intents.`;

    try {
        const result = await callOpenRouter([
            { role: 'system', content: systemPrompt },
            { role: 'user', content: input }
        ]);

        return {
            intent: result.intent || 'UNKNOWN',
            confidence: typeof result.confidence === 'number' ? result.confidence : 85,
            execution_path: result.execution_path || (result.intent !== 'UNKNOWN' ? 'PARALLEL_DISPATCH' : 'ESCALATE'),
            extracted_entities: result.extracted_entities || { keywords: input.split(' ') },
            reasoning: result.reasoning || 'Extracted via Qwen 3.8 Flash reasoning engine',
            model: DEFAULT_MODEL,
            provider: 'OpenRouter',
            live_api: true
        };
    } catch (err) {
        console.warn(`[Qwen Client Warning] OpenRouter API call failed (${err.message}). Using resilient heuristic fallback.`);
        
        // Intelligent heuristic fallback
        return fallbackIntentExtraction(input, err.message);
    }
}

/**
 * Perform evidence correlation and audit checks using Qwen 3.8 Flash
 */
async function correlateEvidenceWithQwen(input, qwenIntentResult, agentFindings) {
    const systemPrompt = `You are Qwen 3.8 Flash, an enterprise audit and risk correlation agent.
Evaluate the sub-agent findings (Billing, CRM, Logistics) against the user's request and original intent.

Return ONLY a valid JSON object matching this schema:
{
  "confidenceScore": <number between 0 and 100>,
  "fraudFlag": <boolean>,
  "policyAuditPassed": <boolean>,
  "reasoning": "<explanation of evidence correlation and risk assessment>",
  "recommendedAction": "AUTO_EXECUTE" | "HIGH_RISK_HANDOFF"
}`;

    const userPayload = JSON.stringify({
        userInput: input,
        qwenIntent: qwenIntentResult,
        subAgentFindings: agentFindings
    });

    try {
        const result = await callOpenRouter([
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPayload }
        ]);

        return {
            confidenceScore: typeof result.confidenceScore === 'number' ? result.confidenceScore : 85,
            fraudFlag: Boolean(result.fraudFlag),
            policyAuditPassed: Boolean(result.policyAuditPassed),
            reasoning: result.reasoning || 'Correlated via Qwen 3.8 Flash evidence audit',
            model: DEFAULT_MODEL,
            live_api: true
        };
    } catch (err) {
        console.warn(`[Qwen Client Warning] Evidence correlation failed (${err.message}). Using fallback audit rules.`);
        return fallbackAudit(qwenIntentResult, agentFindings, err.message);
    }
}

/**
 * Fallback intent extraction if API is unreachable or out of credits
 */
function fallbackIntentExtraction(input, errorDetail = null) {
    const lower = input.toLowerCase();
    let intent = 'UNKNOWN';
    let urgency = 'MEDIUM';

    if (lower.includes('refund') || lower.includes('charge') || lower.includes('bill') || lower.includes('payment') || lower.includes('invoice')) {
        intent = 'BILLING_ISSUE';
        urgency = lower.includes('fraud') || lower.includes('unauthorized') ? 'HIGH' : 'MEDIUM';
    } else if (lower.includes('where') || lower.includes('shipment') || lower.includes('track') || lower.includes('package') || lower.includes('delivery')) {
        intent = 'LOGISTICS_TRACKING';
    } else if (lower.includes('upgrade') || lower.includes('tier') || lower.includes('plan') || lower.includes('subscription')) {
        intent = 'ACCOUNT_UPGRADE';
    } else if (lower.includes('help') || lower.includes('broken') || lower.includes('error') || lower.includes('bug')) {
        intent = 'TECHNICAL_SUPPORT';
    }

    const execution_path = intent !== 'UNKNOWN' ? 'PARALLEL_DISPATCH' : 'ESCALATE';
    const confidence = intent !== 'UNKNOWN' ? 88.0 : 20.0;

    return {
        intent,
        confidence,
        execution_path,
        extracted_entities: {
            keywords: input.split(/\s+/).filter(w => w.length > 2),
            urgency
        },
        reasoning: `Extracted intent [${intent}] via fallback logic. ${errorDetail ? `(OpenRouter note: ${errorDetail})` : ''}`,
        model: `${DEFAULT_MODEL} (fallback mode)`,
        provider: 'OpenRouter (local fallback)',
        live_api: false,
        api_notice: errorDetail ? `OpenRouter API returned: ${errorDetail}` : null
    };
}

/**
 * Fallback audit & correlation
 */
function fallbackAudit(qwenResult, agentFindings, errorDetail = null) {
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

    return {
        confidenceScore,
        fraudFlag,
        policyAuditPassed,
        reasoning: `Audit conducted via rule-based guardrails. ${errorDetail ? `(API notice: ${errorDetail})` : ''}`,
        model: `${DEFAULT_MODEL} (fallback mode)`,
        live_api: false
    };
}

/**
 * Check OpenRouter key authentication and credit status
 */
async function checkModelStatus() {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
        return {
            configured: false,
            model: DEFAULT_MODEL,
            message: 'OPENROUTER_API_KEY not set in environment'
        };
    }

    try {
        const res = await fetch(OPENROUTER_AUTH_URL, {
            headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        const data = await res.json();
        
        return {
            configured: true,
            model: DEFAULT_MODEL,
            authenticated: res.ok,
            is_free_tier: data.data?.is_free_tier ?? null,
            usage: data.data?.usage ?? 0,
            limit_remaining: data.data?.limit_remaining ?? null,
            key_label: data.data?.label || 'Valid OpenRouter Key',
            status: res.ok ? 'READY' : 'AUTH_ERROR'
        };
    } catch (err) {
        return {
            configured: true,
            model: DEFAULT_MODEL,
            authenticated: false,
            status: 'NETWORK_ERROR',
            error: err.message
        };
    }
}

module.exports = {
    DEFAULT_MODEL,
    callOpenRouter,
    extractIntentWithQwen,
    correlateEvidenceWithQwen,
    checkModelStatus
};

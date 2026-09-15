# AI Agent Orchestrator: System Architecture

## Overview
This platform employs a dynamic, modular AI architecture to process user requests, extract intent with Qwen AI, and execute cross-system tasks via the EnterPro orchestration engine.

## Stack
- **Frontend**: React UI (Vite or Next.js)
- **Backend**: Node.js / Express
- **Database**: PostgreSQL
- **AI Engines**: 
  - **Qwen AI**: Dedicated to complex reasoning, NLP, and intent extraction.
  - **EnterPro**: Agent orchestration, dispatch, and parallel task execution.

## Execution Flow Workflow

1. **Input Request**: 
   - User submits a request via the React UI.
   - The Express backend receives the payload and queues a `Ticket`.

2. **Qwen Intent Extraction**: 
   - The payload is sent to the Qwen AI agent.
   - Qwen extracts the core intent and determines the necessary execution pathways.

3. **EnterPro Agent Dispatch**: 
   - EnterPro orchestrator dispatches sub-agents in parallel to interface with cross-system APIs:
     - **Billing Agent**: Checks account status, balances, and historical payments.
     - **CRM Agent**: Fetches user context, tier, and history.
     - **Logistics Agent**: Checks inventory, shipping status, and supply chain constraints.

4. **Reasoning & Evidence Correlation (Qwen)**: 
   - Sub-agent findings are returned to Qwen AI.
   - Qwen correlates the evidence to form a cohesive context mapping.

5. **Verify & Audit**: 
   - The backend computes a `confidence_score`.
   - Executes structural checks: `fraud check` and `policy audit`.
   - Enforces **Pre-execution guardrails** to block processing if anomalies are detected (high-risk logic).

6. **Act**: 
   - If confidence is high and risk is low: **Auto-execute** the transaction/action.
   - If risk thresholds are exceeded or confidence is low: Trigger **High-risk human handoff**, flagging the ticket for manual review.

## Database Schemas (PostgreSQL)
- **Tickets**: Tracks the lifecycle, intent, confidence, and handoff status of every workflow.
- **Transactions**: Logs the financial or operation actions tied to tickets (Billing, CRM).
- **Logs**: Detailed telemetry capturing agent execution steps, payloads, and evidence correlation.

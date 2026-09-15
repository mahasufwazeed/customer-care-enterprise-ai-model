-- PostgreSQL Schema: tickets, logs, transactions

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. TICKETS SCHEMA
CREATE TABLE IF NOT EXISTS tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    intent_extracted VARCHAR(255),
    status VARCHAR(50) DEFAULT 'PENDING',
    confidence_score DECIMAL(5, 2) DEFAULT 0.0,
    fraud_flag BOOLEAN DEFAULT FALSE,
    policy_audit_passed BOOLEAN DEFAULT FALSE,
    resolution_action VARCHAR(255),
    requires_human_handoff BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. TRANSACTIONS SCHEMA
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
    system_origin VARCHAR(100), -- CRM, Billing, Logistics
    transaction_type VARCHAR(100),
    amount DECIMAL(10, 2),
    currency VARCHAR(10),
    transaction_status VARCHAR(50),
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. LOGS SCHEMA (Agent Execution and Orchestration)
CREATE TABLE IF NOT EXISTS logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
    agent_name VARCHAR(100), -- e.g., Qwen AI, EnterPro Orchestrator
    action_type VARCHAR(100),
    evidence_payload JSONB,
    log_level VARCHAR(20) DEFAULT 'INFO',
    message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_tickets_status ON tickets(status);
CREATE INDEX idx_transactions_ticket_id ON transactions(ticket_id);
CREATE INDEX idx_logs_ticket_id ON logs(ticket_id);

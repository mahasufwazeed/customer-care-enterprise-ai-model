import React, { useState, useEffect } from 'react';
import './index.css';
import { RefreshCw, Play, ShieldAlert, Activity } from 'lucide-react';

function App() {
    const [activeTab, setActiveTab] = useState('new'); // 'new' or 'dashboard'
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [response, setResponse] = useState(null);
    const [tickets, setTickets] = useState([]);
    const [selectedTicket, setSelectedTicket] = useState(null);
    const [modelInfo, setModelInfo] = useState(null);

    useEffect(() => {
        fetch('http://localhost:3001/api/model-status')
            .then(res => res.json())
            .then(data => setModelInfo(data))
            .catch(err => console.warn('Could not load model status:', err));
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setResponse(null);
        try {
            const res = await fetch('http://localhost:3001/api/process-intent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ input })
            });
            const data = await res.json();
            setResponse(data);
        } catch (err) {
            console.error(err);
            alert('Failed to connect to backend. Is Postgres running and setup correctly?');
        }
        setLoading(false);
    };

    const fetchTickets = async () => {
        try {
            const res = await fetch('http://localhost:3001/api/tickets');
            const data = await res.json();
            setTickets(data);
        } catch (err) {
            console.error(err);
        }
    };

    const loadTicketDetails = async (id) => {
        try {
            const res = await fetch(`http://localhost:3001/api/tickets/${id}`);
            const data = await res.json();
            setSelectedTicket(data);
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => {
        if (activeTab === 'dashboard') {
            fetchTickets();
        }
    }, [activeTab]);

    return (
        <div className="container">
            <header className="header">
                <h1>AI Agent Orchestrator</h1>
                <p>EnterPro + Qwen 3.8 Flash Reasoning Engine</p>
                {modelInfo && (
                    <div style={{ marginTop: '8px', fontSize: '0.85rem', color: '#94a3b8' }}>
                        <span style={{ 
                            display: 'inline-flex', 
                            alignItems: 'center', 
                            gap: '6px', 
                            background: 'rgba(255,255,255,0.06)', 
                            padding: '4px 10px', 
                            borderRadius: '12px',
                            border: '1px solid rgba(255,255,255,0.1)'
                        }}>
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: modelInfo.authenticated ? '#10b981' : '#ef4444' }} />
                            Engine: <strong>{modelInfo.active_model}</strong> ({modelInfo.provider})
                        </span>
                    </div>
                )}
                <div className="tabs">
                    <button className={activeTab === 'new' ? 'active' : ''} onClick={() => setActiveTab('new')}>New Ticket</button>
                    <button className={activeTab === 'dashboard' ? 'active' : ''} onClick={() => setActiveTab('dashboard')}>System Dashboard</button>
                </div>
            </header>

            {activeTab === 'new' && (
                <main className="main-content">
                    <form onSubmit={handleSubmit} className="input-form">
                        <textarea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="System Input (e.g. 'I need a refund for my last charge' or 'Where is my shipment?')"
                            disabled={loading}
                        />
                        <button type="submit" disabled={loading || !input.trim()}>
                            {loading ? <RefreshCw className="spin" /> : <Play />} Dispatch Agents
                        </button>
                    </form>

                    {response && response.ticket && (
                        <div className="results-panel">
                            <h2>Execution Output</h2>
                            <div className={`status-badge ${response.ticket.requires_human_handoff ? 'risk' : 'success'}`}>
                                {response.ticket.status}
                            </div>

                            <div className="metrics">
                                <div className="metric">
                                    <span className="label">Intent Extraction</span>
                                    <span className="value">{response.ticket.intent}</span>
                                </div>
                                <div className="metric">
                                    <span className="label">Model</span>
                                    <span className="value" style={{ fontSize: '0.85rem' }}>{response.ticket.model_used || 'qwen/qwen3.8-flash'}</span>
                                </div>
                                <div className="metric">
                                    <span className="label">Confidence</span>
                                    <span className="value">{response.ticket.confidence_score}%</span>
                                </div>
                                <div className="metric">
                                    <span className="label">Risk Guardrails</span>
                                    <span className="value">{response.ticket.fraud_flag ? <ShieldAlert color="red" /> : <Activity color="#10b981" />}</span>
                                </div>
                            </div>

                            {response.ticket.reasoning && (
                                <div style={{ marginTop: '14px', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', fontSize: '0.88rem', borderLeft: '3px solid #3b82f6' }}>
                                    <strong style={{ color: '#60a5fa' }}>Qwen Reasoning:</strong> {response.ticket.reasoning}
                                </div>
                            )}
                        </div>
                    )}
                </main>
            )}

            {activeTab === 'dashboard' && (
                <main className="dashboard-content">
                    <div className="tickets-list">
                        <h2>Recent Tickets <button onClick={fetchTickets} className="icon-btn"><RefreshCw size={16} /></button></h2>
                        {tickets.length === 0 && <p className="text-muted">No tickets found.</p>}
                        {tickets.map(t => (
                            <div key={t.id} className="ticket-card" onClick={() => loadTicketDetails(t.id)}>
                                <div className="ticket-header">
                                    <strong>{t.intent_extracted}</strong>
                                    <span className={`badge ${t.status === 'HIGH_RISK_HANDOFF' ? 'danger' : 'success'}`}>{t.status}</span>
                                </div>
                                <div className="ticket-meta">
                                    Score: {t.confidence_score}% | ID: {t.id.split('-')[0]}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="ticket-details">
                        {selectedTicket ? (
                            <div className="details-panel">
                                <h2>Ticket Details</h2>
                                <p><strong>Intent:</strong> {selectedTicket.ticket.intent_extracted}</p>
                                <p><strong>Status:</strong> {selectedTicket.ticket.status}</p>
                                <p><strong>Confidence:</strong> {selectedTicket.ticket.confidence_score}%</p>

                                <h3>Execution Trace (Logs)</h3>
                                <div className="timeline">
                                    {selectedTicket.logs.map(log => (
                                        <div key={log.id} className="timeline-item">
                                            <span className="time">{new Date(log.created_at).toLocaleTimeString()}</span>
                                            <div className="content">
                                                <strong>{log.agent_name}</strong> - {log.action_type}
                                                <pre>{JSON.stringify(log.evidence_payload, null, 2)}</pre>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {selectedTicket.transactions.length > 0 && (
                                    <>
                                        <h3>Transactions</h3>
                                        <div className="transactions">
                                            {selectedTicket.transactions.map(tr => (
                                                <div key={tr.id} className="trx-card">
                                                    <span>{tr.transaction_type} ({tr.system_origin})</span>
                                                    <span className="badge success">{tr.transaction_status}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                        ) : (
                            <div className="empty-state">Select a ticket to view system logs and execution trace.</div>
                        )}
                    </div>
                </main>
            )}
        </div>
    );
}

export default App;

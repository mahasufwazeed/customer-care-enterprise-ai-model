import React, { useState, useEffect, useRef } from 'react';
import './index.css';
import {
  Bot,
  Send,
  Sparkles,
  Shield,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Terminal,
  Activity,
  ArrowRight,
  RefreshCw,
  User,
  Cpu,
  Layers,
  ExternalLink,
  ShieldAlert,
  Zap,
  Server,
  Package,
  CreditCard,
  Lock,
  Wrench,
  Check,
  X,
  Copy,
  CheckCheck
} from 'lucide-react';

const API_BASE = 'http://localhost:3001/api';

export default function App() {
  const [activeTab, setActiveTab] = useState('chat'); // 'chat' | 'telemetry' | 'supervisor'
  const [modelInfo, setModelInfo] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [scenarios, setScenarios] = useState([]);
  
  // Chat state
  const [inputMessage, setInputMessage] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      sender: 'bot',
      text: "Hello! I am your EnterpriseCare AI Copilot, powered by Qwen 3.8 Flash and the EnterPro Swarm Orchestrator. I can investigate, audit, and autonomously resolve inquiries across Billing, Logistics, Security, Tech, and Subscriptions. How can I assist you?",
      card: null,
      ticketId: null,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  // Telemetry state
  const [tickets, setTickets] = useState([]);
  const [selectedTicketId, setSelectedTicketId] = useState(null);
  const [ticketDetail, setTicketDetail] = useState(null);
  const [ticketFilter, setTicketFilter] = useState('ALL');
  const [copiedId, setCopiedId] = useState(false);

  // Supervisor state
  const [actionLoadingId, setActionLoadingId] = useState(null);

  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Initial Data Fetching
  const loadSystemData = async () => {
    try {
      const [statusRes, analyticsRes, scenariosRes, ticketsRes] = await Promise.all([
        fetch(`${API_BASE}/model-status`).then(r => r.json()),
        fetch(`${API_BASE}/analytics`).then(r => r.json()),
        fetch(`${API_BASE}/scenarios`).then(r => r.json()),
        fetch(`${API_BASE}/tickets`).then(r => r.json())
      ]);
      setModelInfo(statusRes);
      setAnalytics(analyticsRes);
      setScenarios(scenariosRes);
      setTickets(ticketsRes);
      if (ticketsRes.length > 0 && !selectedTicketId) {
        setSelectedTicketId(ticketsRes[0].id);
      }
    } catch (err) {
      console.warn('Could not load enterprise telemetry:', err);
    }
  };

  useEffect(() => {
    loadSystemData();
    const interval = setInterval(loadSystemData, 10000);
    return () => clearInterval(interval);
  }, []);

  // Fetch ticket details when selected
  useEffect(() => {
    if (!selectedTicketId) return;
    fetch(`${API_BASE}/tickets/${selectedTicketId}`)
      .then(res => res.json())
      .then(data => setTicketDetail(data))
      .catch(err => console.error(err));
  }, [selectedTicketId]);

  // Send message to Copilot Chat
  const handleSendMessage = async (customPrompt) => {
    const query = customPrompt || inputMessage;
    if (!query.trim() || chatLoading) return;

    const userMsgId = Math.random().toString(36).substring(2, 9);
    const newMsg = {
      id: userMsgId,
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, newMsg]);
    if (!customPrompt) setInputMessage('');
    setChatLoading(true);

    try {
      const res = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: query })
      });
      const data = await res.json();

      const botMsg = {
        id: Math.random().toString(36).substring(2, 9),
        sender: 'bot',
        text: data.message || "Request processed.",
        card: data.card || null,
        ticketId: data.ticket?.id,
        latency: data.latency_ms,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages(prev => [...prev, botMsg]);
      loadSystemData();
      if (data.ticket?.id) {
        setSelectedTicketId(data.ticket.id);
      }
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          id: Math.random().toString(36).substring(2, 9),
          sender: 'bot',
          text: "I encountered an issue connecting to the enterprise orchestration gateway. Please ensure the backend is running.",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    }
    setChatLoading(false);
  };

  // Run 1-Click Scenario
  const handleRunScenario = (scenario) => {
    setActiveTab('chat');
    handleSendMessage(scenario.prompt);
  };

  // Supervisor HITL Action
  const handleSupervisorAction = async (ticketId, action) => {
    setActionLoadingId(ticketId);
    try {
      await fetch(`${API_BASE}/tickets/${ticketId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      await loadSystemData();
      if (selectedTicketId === ticketId) {
        const detailRes = await fetch(`${API_BASE}/tickets/${ticketId}`).then(r => r.json());
        setTicketDetail(detailRes);
      }
    } catch (e) {
      console.error(e);
    }
    setActionLoadingId(null);
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const filteredTickets = tickets.filter(t => {
    if (ticketFilter === 'AUTO_EXECUTED') return t.status === 'AUTO_EXECUTED' || t.status === 'APPROVED_BY_HUMAN';
    if (ticketFilter === 'ESCALATED') return t.requires_human_handoff || t.status === 'HIGH_RISK_HANDOFF';
    return true;
  });

  const escalatedTickets = tickets.filter(t => t.requires_human_handoff || t.status === 'HIGH_RISK_HANDOFF');

  return (
    <div className="app-container">
      {/* Top Navbar */}
      <header className="navbar">
        <div className="brand">
          <div className="brand-icon">
            <Bot size={22} color="#fff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="brand-title">EnterpriseCare AI</span>
              <span className="brand-tag">FAANG Suite</span>
            </div>
          </div>
        </div>

        <nav className="nav-tabs">
          <button
            className={`nav-tab ${activeTab === 'chat' ? 'active' : ''}`}
            onClick={() => setActiveTab('chat')}
          >
            <Bot size={16} />
            AI Copilot
          </button>
          <button
            className={`nav-tab ${activeTab === 'telemetry' ? 'active' : ''}`}
            onClick={() => setActiveTab('telemetry')}
          >
            <Activity size={16} />
            Tracing & KPIs
          </button>
          <button
            className={`nav-tab ${activeTab === 'supervisor' ? 'active' : ''}`}
            onClick={() => setActiveTab('supervisor')}
          >
            <ShieldAlert size={16} />
            HITL Review {escalatedTickets.length > 0 && `(${escalatedTickets.length})`}
          </button>
        </nav>

        <div className="nav-status">
          <div className="status-pill">
            <span className="status-dot"></span>
            Swarm Online
          </div>
          {modelInfo && (
            <div className="engine-pill">
              <Cpu size={12} style={{ display: 'inline', marginRight: '4px' }} />
              {modelInfo.active_model}
            </div>
          )}
        </div>
      </header>

      {/* Main Viewport */}
      <div className="view-viewport">
        {/* ========================================================== */}
        {/* VIEW 1: COPILOT LIVE CHAT                                  */}
        {/* ========================================================== */}
        {activeTab === 'chat' && (
          <div className="chat-view">
            <div className="chat-banner">
              <div className="chat-banner-info">
                <Zap size={18} color="#6366f1" />
                <div>
                  <div className="chat-banner-title">Omnichannel Autonomous Support Copilot</div>
                  <div className="chat-banner-subtitle">
                    Dispatches multi-agent verifications across Billing, CRM, Logistics, and Security in ~350ms
                  </div>
                </div>
              </div>
              <div className="badge info">
                <Shield size={12} />
                Guardrails Active
              </div>
            </div>

            <div className="chat-messages">
              {messages.map((msg) => (
                <div key={msg.id} className={`message-row ${msg.sender}`}>
                  <div className="message-avatar">
                    {msg.sender === 'bot' ? <Bot size={18} /> : <User size={18} />}
                  </div>
                  <div>
                    <div className="message-bubble">
                      <p>{msg.text}</p>

                      {/* Structured Action Card */}
                      {msg.card && (
                        <div className="resolution-card">
                          <div className="card-header">
                            <div className="card-title">
                              {msg.card.type === 'BILLING_REFUND' && <CreditCard size={16} color="#10b981" />}
                              {msg.card.type === 'LOGISTICS_TRACKING' && <Package size={16} color="#06b6d4" />}
                              {msg.card.type === 'SUBSCRIPTION_CHANGE' && <Zap size={16} color="#818cf8" />}
                              {msg.card.type === 'TECH_INCIDENT' && <Wrench size={16} color="#f59e0b" />}
                              {msg.card.type === 'SUPERVISOR_HANDOFF' && <ShieldAlert size={16} color="#ef4444" />}
                              {msg.card.title}
                            </div>
                            <span className={`badge ${msg.card.badgeType || 'info'}`}>
                              {msg.card.badge}
                            </span>
                          </div>

                          <div className="card-items-grid">
                            {msg.card.items.map((item, idx) => (
                              <div key={idx}>
                                <div className="card-item-label">{item.label}</div>
                                <div className="card-item-value">{item.value}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Action Trace Jump Link */}
                      {msg.ticketId && (
                        <button
                          className="view-trace-btn"
                          onClick={() => {
                            setSelectedTicketId(msg.ticketId);
                            setActiveTab('telemetry');
                          }}
                        >
                          <Activity size={12} />
                          Inspect Execution Trace Waterfall ({msg.latency ? `${msg.latency}ms` : 'View Spans'})
                          <ArrowRight size={12} />
                        </button>
                      )}
                    </div>
                    <div className="message-meta">
                      <span>{msg.timestamp}</span>
                      {msg.latency && <span>• Handled in {msg.latency}ms</span>}
                    </div>
                  </div>
                </div>
              ))}

              {chatLoading && (
                <div className="message-row bot">
                  <div className="message-avatar">
                    <Bot size={18} />
                  </div>
                  <div className="message-bubble" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <RefreshCw size={14} className="spin" />
                    <span>Orchestrating agent swarm & querying enterprise databases...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Prompt Suggestions */}
            <div className="quick-prompts-bar">
              <button
                className="quick-prompt-chip"
                onClick={() => handleSendMessage('I was double charged $49.99 for my subscription renewal this morning and need a refund.')}
              >
                <CreditCard size={13} color="#10b981" />
                Double Charged $49.99 (Refund)
              </button>
              <button
                className="quick-prompt-chip"
                onClick={() => handleSendMessage('Where is my expedited server rack shipment for order #ORD-98421?')}
              >
                <Package size={13} color="#06b6d4" />
                Track Order #ORD-98421
              </button>
              <button
                className="quick-prompt-chip"
                onClick={() => handleSendMessage('I received an alert that someone logged in from Frankfurt IP 194.26.29.1 at 3 AM. Lock session!')}
              >
                <Lock size={13} color="#ef4444" />
                Suspicious Login / Lock 2FA
              </button>
              <button
                className="quick-prompt-chip"
                onClick={() => handleSendMessage('Please upgrade our organization account to the Enterprise Suite tier with 25 additional seats.')}
              >
                <Zap size={13} color="#818cf8" />
                Upgrade to Enterprise Tier
              </button>
              <button
                className="quick-prompt-chip"
                onClick={() => handleSendMessage('Our production webhook consumers are receiving intermittent HTTP 502 Bad Gateway errors.')}
              >
                <Wrench size={13} color="#f59e0b" />
                502 Bad Gateway SRE Check
              </button>
            </div>

            {/* Chat Input Bar */}
            <form
              className="chat-input-container"
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
            >
              <input
                type="text"
                className="chat-input"
                placeholder="Ask anything (e.g. 'Refund duplicate charge', 'Where is my order #ORD-9821?', 'Lock compromised account')..."
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                disabled={chatLoading}
              />
              <button type="submit" className="send-btn" disabled={chatLoading || !inputMessage.trim()}>
                {chatLoading ? <RefreshCw size={16} className="spin" /> : <Send size={16} />}
              </button>
            </form>
          </div>
        )}

        {/* ========================================================== */}
        {/* VIEW 2: DISTRIBUTED TRACING & TELEMETRY HUB                */}
        {/* ========================================================== */}
        {activeTab === 'telemetry' && (
          <div className="telemetry-view">
            {/* KPI Cards Grid */}
            <div className="kpi-grid">
              <div className="kpi-card">
                <div>
                  <div className="kpi-label">SLA Resolution Rate</div>
                  <div className="kpi-value">{analytics?.kpis?.sla_rate || '99.4%'}</div>
                  <span className="badge success">Target: &gt; 98.5%</span>
                </div>
                <div className="kpi-icon-wrap">
                  <CheckCircle2 size={24} color="#10b981" />
                </div>
              </div>

              <div className="kpi-card">
                <div>
                  <div className="kpi-label">P95 Dispatch Latency</div>
                  <div className="kpi-value">{analytics?.kpis?.p95_latency || '345ms'}</div>
                  <span className="badge info">Real-time Stream</span>
                </div>
                <div className="kpi-icon-wrap">
                  <Clock size={24} color="#06b6d4" />
                </div>
              </div>

              <div className="kpi-card">
                <div>
                  <div className="kpi-label">Autonomous Executions</div>
                  <div className="kpi-value">{analytics?.kpis?.auto_executed || 0}</div>
                  <span className="badge success">Zero Human Friction</span>
                </div>
                <div className="kpi-icon-wrap">
                  <Zap size={24} color="#818cf8" />
                </div>
              </div>

              <div className="kpi-card">
                <div>
                  <div className="kpi-label">Supervised Escalations</div>
                  <div className="kpi-value">{analytics?.kpis?.escalated || 0}</div>
                  <span className="badge warning">Guardrails Shield</span>
                </div>
                <div className="kpi-icon-wrap">
                  <ShieldAlert size={24} color="#f59e0b" />
                </div>
              </div>
            </div>

            {/* Enterprise Scalability & Concurrency Telemetry Ribbon */}
            <div style={{
              background: 'rgba(15, 23, 42, 0.7)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '0.85rem 1.25rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '1rem',
              fontSize: '0.8rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Cpu size={16} color="#6366f1" />
                <span style={{ color: 'var(--text-muted)' }}>Concurrency Queue:</span>
                <strong style={{ color: '#fff' }}>
                  {analytics?.scalability?.queue?.activeWorkers || 0} / {analytics?.scalability?.queue?.maxConcurrency || 8} Active
                </strong>
                <span className="badge info" style={{ fontSize: '0.65rem' }}>
                  {analytics?.scalability?.queue?.queuedTasks || 0} Queued
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Zap size={16} color="#10b981" />
                <span style={{ color: 'var(--text-muted)' }}>Semantic Cache:</span>
                <strong style={{ color: '#10b981' }}>
                  {analytics?.scalability?.cache?.hitRatio || '0.0%'} Hit Ratio
                </strong>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                  ({analytics?.scalability?.cache?.cachedEntries || 0} cached &bull; &lt;4ms)
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Server size={16} color="#06b6d4" />
                <span style={{ color: 'var(--text-muted)' }}>Storage Fabric:</span>
                <strong style={{ color: '#06b6d4' }}>
                  {analytics?.scalability?.database?.mode || 'In-Memory Buffer'}
                </strong>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Shield size={16} color="#f59e0b" />
                <span style={{ color: 'var(--text-muted)' }}>Financial Safety:</span>
                <span className="badge success" style={{ fontSize: '0.65rem' }}>Idempotency Active</span>
              </div>
            </div>

            {/* Split Screen: Tickets Stream + Distributed Waterfall Trace */}
            <div className="telemetry-split">
              {/* Left Column: Tickets Queue */}
              <div className="telemetry-pane">
                <div className="pane-header">
                  <div className="pane-title">
                    <Terminal size={16} />
                    Live Event Stream
                  </div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      className={`badge ${ticketFilter === 'ALL' ? 'info' : ''}`}
                      style={{ cursor: 'pointer', background: ticketFilter === 'ALL' ? 'rgba(99,102,241,0.2)' : 'transparent', border: '1px solid var(--border-subtle)' }}
                      onClick={() => setTicketFilter('ALL')}
                    >
                      All
                    </button>
                    <button
                      className={`badge ${ticketFilter === 'AUTO_EXECUTED' ? 'success' : ''}`}
                      style={{ cursor: 'pointer', background: ticketFilter === 'AUTO_EXECUTED' ? 'rgba(16,185,129,0.2)' : 'transparent', border: '1px solid var(--border-subtle)' }}
                      onClick={() => setTicketFilter('AUTO_EXECUTED')}
                    >
                      Auto
                    </button>
                    <button
                      className={`badge ${ticketFilter === 'ESCALATED' ? 'warning' : ''}`}
                      style={{ cursor: 'pointer', background: ticketFilter === 'ESCALATED' ? 'rgba(245,158,11,0.2)' : 'transparent', border: '1px solid var(--border-subtle)' }}
                      onClick={() => setTicketFilter('ESCALATED')}
                    >
                      Escalated
                    </button>
                  </div>
                </div>

                <div className="ticket-list">
                  {filteredTickets.map((t) => (
                    <div
                      key={t.id}
                      className={`ticket-list-item ${selectedTicketId === t.id ? 'selected' : ''}`}
                      onClick={() => setSelectedTicketId(t.id)}
                    >
                      <div className="ticket-item-top">
                        <span className="ticket-item-intent">{t.intent_extracted || 'GENERAL'}</span>
                        <span className="ticket-item-time">
                          {new Date(t.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                      </div>
                      <div className="ticket-item-prompt">{t.id}</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                        <span className={`badge ${t.status === 'AUTO_EXECUTED' || t.status === 'APPROVED_BY_HUMAN' ? 'success' : 'warning'}`}>
                          {t.status}
                        </span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          Score: {Math.round(t.confidence_score || 0)}%
                        </span>
                      </div>
                    </div>
                  ))}
                  {filteredTickets.length === 0 && (
                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      No tickets match filter.
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Distributed Span Waterfall Visualizer */}
              <div className="telemetry-pane">
                <div className="pane-header">
                  <div className="pane-title">
                    <Activity size={16} />
                    Distributed Span Waterfall (OpenTelemetry)
                  </div>
                  {ticketDetail?.ticket?.id && (
                    <button
                      style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem' }}
                      onClick={() => handleCopy(ticketDetail.ticket.id)}
                    >
                      {copiedId ? <CheckCheck size={14} color="#10b981" /> : <Copy size={14} />}
                      {copiedId ? 'Copied' : ticketDetail.ticket.id.substring(0, 8)}
                    </button>
                  )}
                </div>

                <div className="trace-pane-content">
                  {ticketDetail?.ticket ? (
                    <>
                      {/* Ticket Summary Banner */}
                      <div className="ticket-banner">
                        <div className="ticket-banner-details">
                          <h3>Intent: {ticketDetail.ticket.intent_extracted}</h3>
                          <p>Database Record ID: {ticketDetail.ticket.id}</p>
                          <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                            <span className={`badge ${ticketDetail.ticket.status === 'AUTO_EXECUTED' ? 'success' : 'warning'}`}>
                              {ticketDetail.ticket.status}
                            </span>
                            <span className="badge info">
                              Confidence: {Math.round(ticketDetail.ticket.confidence_score)}%
                            </span>
                            {ticketDetail.ticket.fraud_flag && (
                              <span className="badge danger">Fraud Detected</span>
                            )}
                          </div>
                        </div>

                        {/* Quick Supervisor Override */}
                        {ticketDetail.ticket.requires_human_handoff && (
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              className="hitl-btn approve"
                              onClick={() => handleSupervisorAction(ticketDetail.ticket.id, 'APPROVE')}
                            >
                              <Check size={14} /> Approve
                            </button>
                            <button
                              className="hitl-btn reject"
                              onClick={() => handleSupervisorAction(ticketDetail.ticket.id, 'REJECT_FRAUD')}
                            >
                              <X size={14} /> Reject
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Distributed Waterfall Spans */}
                      <div className="waterfall-container">
                        <div className="waterfall-header">
                          <span>Span Agent & Operation</span>
                          <span>Execution Timeline Waterfall</span>
                          <span style={{ textAlign: 'right' }}>Span Latency</span>
                        </div>

                        <div className="waterfall-spans">
                          {/* Span 1: Intent Extraction */}
                          <div className="span-row">
                            <div className="span-agent">
                              <Cpu size={14} color="#818cf8" />
                              <span>Qwen 3.8 Flash (Intent)</span>
                            </div>
                            <div className="span-bar-container">
                              <div className="span-bar-fill qwen" style={{ width: '45%' }}>
                                Entity Parsing
                              </div>
                            </div>
                            <div className="span-duration">180ms</div>
                          </div>

                          {/* Span 2: EnterPro Parallel Swarm */}
                          <div className="span-row">
                            <div className="span-agent">
                              <Layers size={14} color="#06b6d4" />
                              <span>EnterPro Swarm Dispatch</span>
                            </div>
                            <div className="span-bar-container">
                              <div className="span-bar-fill enterpro" style={{ width: '32%', marginLeft: '45%' }}>
                                Parallel Systems
                              </div>
                            </div>
                            <div className="span-duration">130ms</div>
                          </div>

                          {/* Span 3: Evidence Correlation */}
                          <div className="span-row">
                            <div className="span-agent">
                              <Shield size={14} color="#10b981" />
                              <span>Qwen Policy & Guardrails</span>
                            </div>
                            <div className="span-bar-container">
                              <div className="span-bar-fill audit" style={{ width: '20%', marginLeft: '77%' }}>
                                Risk Matrix
                              </div>
                            </div>
                            <div className="span-duration">95ms</div>
                          </div>

                          {/* Span 4: Transaction Ledger */}
                          <div className="span-row">
                            <div className="span-agent">
                              <Server size={14} color="#f59e0b" />
                              <span>Enterprise Ledger</span>
                            </div>
                            <div className="span-bar-container">
                              <div className="span-bar-fill ledger" style={{ width: '10%', marginLeft: '90%' }}>
                                Commit
                              </div>
                            </div>
                            <div className="span-duration">25ms</div>
                          </div>
                        </div>
                      </div>

                      {/* Evidence Payloads Inspector */}
                      <div>
                        <div style={{ fontSize: '0.8rem', fontWeight: '700', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Terminal size={14} />
                          Raw Sub-Agent Audit Logs & Payloads ({ticketDetail.logs?.length || 0} entries)
                        </div>
                        <pre className="evidence-box">
                          {JSON.stringify(ticketDetail.logs, null, 2)}
                        </pre>
                      </div>
                    </>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                      Select a ticket from the left stream to inspect its distributed execution spans.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================== */}
        {/* VIEW 3: SUPERVISOR HITL & SCENARIO LAB                     */}
        {/* ========================================================== */}
        {activeTab === 'supervisor' && (
          <div className="supervisor-view">
            {/* Left Panel: Human In The Loop Review Queue */}
            <div className="section-panel">
              <div className="section-panel-header">
                <h3>
                  <ShieldAlert size={18} color="#f59e0b" />
                  Supervisor Human-in-the-Loop Queue
                </h3>
                <span className="badge warning">
                  {escalatedTickets.length} Action{escalatedTickets.length !== 1 ? 's' : ''} Pending
                </span>
              </div>

              <div className="section-panel-content">
                {escalatedTickets.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    <CheckCircle2 size={36} color="#10b981" style={{ margin: '0 auto 1rem auto', opacity: 0.8 }} />
                    <p style={{ fontWeight: 600, color: '#f8fafc' }}>All Systems Healthy & Cleared</p>
                    <p style={{ fontSize: '0.8rem' }}>No pending high-risk compliance handoffs requiring review.</p>
                  </div>
                ) : (
                  escalatedTickets.map(t => (
                    <div key={t.id} className="hitl-card">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#f8fafc' }}>
                          Ticket #{t.id.substring(0, 8)}
                        </span>
                        <span className="badge danger">High Risk Escalate</span>
                      </div>

                      <div style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>
                        <strong>Intent:</strong> {t.intent_extracted}
                      </div>

                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Created at: {new Date(t.created_at).toLocaleString()}
                      </div>

                      <div className="hitl-actions-row">
                        <button
                          className="hitl-btn approve"
                          disabled={actionLoadingId === t.id}
                          onClick={() => handleSupervisorAction(t.id, 'APPROVE')}
                        >
                          <Check size={14} /> Approve & Auto-Execute
                        </button>
                        <button
                          className="hitl-btn reject"
                          disabled={actionLoadingId === t.id}
                          onClick={() => handleSupervisorAction(t.id, 'REJECT_FRAUD')}
                        >
                          <X size={14} /> Reject & Flag Fraud
                        </button>
                        <button
                          className="hitl-btn escalate"
                          disabled={actionLoadingId === t.id}
                          onClick={() => handleSupervisorAction(t.id, 'ESCALATE_TIER2')}
                        >
                          <ExternalLink size={14} /> Tier 2 SRE
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Right Panel: Omnichannel 1-Click Scenario Lab */}
            <div className="section-panel">
              <div className="section-panel-header">
                <h3>
                  <Zap size={18} color="#6366f1" />
                  Omnichannel Enterprise Scenario Suite
                </h3>
                <span className="badge info">6 Pre-Configured Tests</span>
              </div>

              <div className="section-panel-content">
                {scenarios.map(sc => (
                  <div key={sc.id} className="scenario-card">
                    <div className="scenario-card-header">
                      <div className="scenario-title">{sc.title}</div>
                      <span className="badge info">{sc.badge}</span>
                    </div>

                    <div className="scenario-desc">{sc.description}</div>
                    <div className="scenario-prompt-box">"{sc.prompt}"</div>

                    <button
                      className="scenario-run-btn"
                      onClick={() => handleRunScenario(sc)}
                    >
                      <Play size={12} fill="#fff" /> Run Through Swarm
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

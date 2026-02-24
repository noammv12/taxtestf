'use client';

import { useState, useEffect, use } from 'react';
import AppShell from '@/components/AppShell';
import StateBadge from '@/components/StateBadge';

function fmt(val) {
    if (val === null || val === undefined) return '—';
    if (typeof val === 'number') return val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return String(val);
}

function fmtUSD(val) {
    if (val === null || val === undefined) return '—';
    const n = Number(val);
    if (isNaN(n)) return String(val);
    const prefix = n < 0 ? '-$' : '$';
    return prefix + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function valColor(val) {
    const n = Number(val);
    if (isNaN(n)) return '';
    return n > 0 ? 'positive' : n < 0 ? 'negative' : '';
}

export default function Client360Page({ params }) {
    const resolvedParams = use(params);
    const id = resolvedParams.id;
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState(0);
    const [expandedReport, setExpandedReport] = useState(null);

    useEffect(() => {
        fetch(`/api/clients/${id}`)
            .then(r => r.json())
            .then(d => { setData(d); setLoading(false); })
            .catch(() => setLoading(false));
    }, [id]);

    if (loading) return <AppShell><div className="page-container"><div className="loading-spinner"><div className="spinner"></div> Loading client data...</div></div></AppShell>;
    if (!data || data.error) return <AppShell><div className="page-container"><div className="notification-banner error">Client not found</div></div></AppShell>;

    const { client, reports, active_reports, audit_events, exceptions } = data;
    const latestReport = active_reports?.[active_reports.length - 1];

    const tabs = ['Source Reports', 'P&L Summary', 'Tax-Cleaned', 'Validation & Reconciliation', 'History & Audit'];

    return (
        <AppShell exceptionCount={exceptions?.filter(e => e.status === 'OPEN').length || 0}>
            <div className="page-container">
                {/* Client Header */}
                <div className="card animate-fade-in" style={{ marginBottom: 24, padding: '24px 28px', background: 'linear-gradient(135deg, var(--bg-secondary), var(--bg-tertiary))' }}>
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>{client.client_display_name}</h1>
                            <div className="flex gap-md items-center" style={{ marginTop: 8 }}>
                                <span className="text-sm" style={{ fontFamily: 'monospace', color: 'var(--accent)' }}>🏷️ {client.account_id}</span>
                                <span className="text-sm text-muted">👤 {client.username}</span>
                                <span className="text-sm text-muted">📊 {client.report_count} reports</span>
                            </div>
                        </div>
                        <div className="flex gap-sm items-center">
                            <StateBadge state={client.status} />
                            {client.years_on_file?.map(y => (
                                <span key={y} className="badge badge-new" style={{ fontSize: 11 }}>{y}</span>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Tab Navigation */}
                <div className="tabs">
                    {tabs.map((tab, i) => (
                        <button key={tab} className={`tab ${activeTab === i ? 'active' : ''}`} onClick={() => setActiveTab(i)}>
                            {tab}
                            {i === 0 && reports?.length > 0 && <span style={{ marginLeft: 6, opacity: 0.6 }}>({reports.length})</span>}
                            {i === 3 && exceptions?.length > 0 && <span style={{ marginLeft: 6, opacity: 0.6 }}>({exceptions.length})</span>}
                            {i === 4 && audit_events?.length > 0 && <span style={{ marginLeft: 6, opacity: 0.6 }}>({audit_events.length})</span>}
                        </button>
                    ))}
                </div>

                {/* Tab 0: Source Reports */}
                {activeTab === 0 && (
                    <div className="tab-content animate-fade-in">
                        {reports?.length === 0 ? (
                            <div className="table-empty"><div className="table-empty-icon">📄</div>No reports imported yet</div>
                        ) : (
                            <div className="table-container">
                                <div className="table-scroll">
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>Report ID</th>
                                                <th>Scenario</th>
                                                <th>Year</th>
                                                <th>Period</th>
                                                <th>State</th>
                                                <th>Version</th>
                                                <th>Active</th>
                                                <th className="number">Net P&L</th>
                                                <th>Stored</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {reports.map(r => (
                                                <>
                                                    <tr key={r.id} className="clickable" onClick={() => setExpandedReport(expandedReport === r.id ? null : r.id)}>
                                                        <td style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: 11 }}>{r.id}</td>
                                                        <td className="text-xs">{r.scenarioId || '—'}</td>
                                                        <td className="font-bold">{r.header?.year}</td>
                                                        <td className="text-xs">{r.header?.report_period_start} — {r.header?.report_period_end}</td>
                                                        <td><StateBadge state={r.state} /></td>
                                                        <td className="font-mono text-xs">v{r.version}</td>
                                                        <td>{r.is_active ? <StateBadge state="ACTIVE" /> : <span className="text-xs text-muted">archived</span>}</td>
                                                        <td className={`number font-mono ${valColor(r.grandTotals?.net_pnl)}`}>{fmtUSD(r.grandTotals?.net_pnl)}</td>
                                                        <td className="text-xs text-muted">{r.stored_at ? new Date(r.stored_at).toLocaleString() : '—'}</td>
                                                    </tr>
                                                    {expandedReport === r.id && (
                                                        <tr key={`${r.id}-detail`}>
                                                            <td colSpan={9} style={{ padding: 0 }}>
                                                                <div style={{ padding: '16px 20px', background: 'var(--bg-tertiary)' }}>
                                                                    <div className="text-xs font-bold mb-sm">Raw Payload (JSON)</div>
                                                                    <div className="json-viewer">{JSON.stringify(r.rawPayload, null, 2)}</div>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Tab 1: P&L Summary */}
                {activeTab === 1 && latestReport && (
                    <div className="tab-content animate-fade-in">
                        <div className="colmex-report">
                            <div className="colmex-report-header">
                                <h2>ColmexPro — Profit & Loss Report</h2>
                                <div className="report-meta">
                                    <span>Account: <strong>{latestReport.header.account_id}</strong></span>
                                    <span>Year: <strong>{latestReport.header.year}</strong></span>
                                    <span>Period: <strong>{latestReport.header.report_period_start} — {latestReport.header.report_period_end}</strong></span>
                                    <StateBadge state={latestReport.state} />
                                </div>
                            </div>

                            {/* Summary Totals */}
                            <div className="summary-totals">
                                {[
                                    { label: 'Opening Balance', value: latestReport.summaryTotals?.opening_balance },
                                    { label: 'Total Deposit & Withdrawal', value: latestReport.summaryTotals?.total_deposit_withdrawal },
                                    { label: 'Total Credit & Debit', value: latestReport.summaryTotals?.total_credit_debit },
                                    { label: 'Profit & Loss', value: latestReport.summaryTotals?.profit_loss },
                                    { label: 'Closing Balance / Equity', value: latestReport.summaryTotals?.closing_balance_equity },
                                ].map(item => (
                                    <div className="summary-total-item" key={item.label}>
                                        <div className="summary-total-label">{item.label}</div>
                                        <div className={`summary-total-value ${valColor(item.value)}`}>{fmtUSD(item.value)}</div>
                                    </div>
                                ))}
                            </div>

                            {/* Monthly P&L Table */}
                            <div className="table-scroll">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Month</th>
                                            <th>Trade Date</th>
                                            <th className="number">Total Comm</th>
                                            <th className="number">SEC Fee</th>
                                            <th className="number">NASD Fee</th>
                                            <th className="number">ECN Take</th>
                                            <th className="number">ECN Add</th>
                                            <th className="number">Routing Fee</th>
                                            <th className="number">NSCC Fee</th>
                                            <th className="number">Net P&L</th>
                                            <th className="number">Net Cash</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {latestReport.monthlyRows?.map(row => (
                                            <tr key={row.month}>
                                                <td style={{ fontWeight: 600 }}>{row.month}</td>
                                                <td>{row.trade_date}</td>
                                                <td className="number font-mono">{fmt(row.total_comm)}</td>
                                                <td className="number font-mono">{typeof row.sec_fee === 'number' ? fmt(row.sec_fee) : <span style={{ color: 'var(--error)' }}>{String(row.sec_fee)}</span>}</td>
                                                <td className="number font-mono">{fmt(row.nasd_fee)}</td>
                                                <td className="number font-mono">{fmt(row.ecn_take)}</td>
                                                <td className="number font-mono">{fmt(row.ecn_add)}</td>
                                                <td className="number font-mono">{fmt(row.routing_fee)}</td>
                                                <td className="number font-mono">{fmt(row.nscc_fee)}</td>
                                                <td className={`number font-mono ${valColor(row.net_pnl)}`}>{fmtUSD(row.net_pnl)}</td>
                                                <td className={`number font-mono ${valColor(row.net_cash)}`}>{fmtUSD(row.net_cash)}</td>
                                            </tr>
                                        ))}
                                        {/* Grand Totals Row */}
                                        {latestReport.grandTotals && (
                                            <tr className="table-grand-total">
                                                <td colSpan={2} style={{ fontWeight: 800 }}>Grand Totals</td>
                                                <td className="number font-mono">{fmt(latestReport.grandTotals.total_comm)}</td>
                                                <td className="number font-mono">{fmt(latestReport.grandTotals.sec_fee)}</td>
                                                <td className="number font-mono">{fmt(latestReport.grandTotals.nasd_fee)}</td>
                                                <td className="number font-mono">{fmt(latestReport.grandTotals.ecn_take)}</td>
                                                <td className="number font-mono">{fmt(latestReport.grandTotals.ecn_add)}</td>
                                                <td className="number font-mono">{fmt(latestReport.grandTotals.routing_fee)}</td>
                                                <td className="number font-mono">{fmt(latestReport.grandTotals.nscc_fee)}</td>
                                                <td className={`number font-mono ${valColor(latestReport.grandTotals.net_pnl)}`} style={{ fontSize: 14 }}>{fmtUSD(latestReport.grandTotals.net_pnl)}</td>
                                                <td className={`number font-mono ${valColor(latestReport.grandTotals.net_cash)}`} style={{ fontSize: 14 }}>{fmtUSD(latestReport.grandTotals.net_cash)}</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* Tab 2: Tax-Cleaned */}
                {activeTab === 2 && (
                    <div className="tab-content animate-fade-in">
                        {latestReport?.taxCleanedResult?.status === 'GENERATED' ? (
                            <>
                                <div className="flex gap-sm mb-md">
                                    {latestReport.taxCleanedResult.derived_fields?.client_report_status_badges?.map(b => (
                                        <StateBadge key={b} state={b} />
                                    ))}
                                </div>

                                <div className="notification-banner info mb-md">
                                    ℹ️ Tax-cleaned outputs are derived from Colmex P&L summaries. Estimates are non-official and for internal reference only.
                                </div>

                                {/* Key Metrics */}
                                <div className="metrics-grid mb-lg">
                                    <div className="metric-card accent">
                                        <div className="metric-label">Annual Reported P&L</div>
                                        <div className={`metric-value ${valColor(latestReport.taxCleanedResult.derived_fields?.ytd_reported_pnl)}`}>
                                            {fmtUSD(latestReport.taxCleanedResult.derived_fields?.ytd_reported_pnl)}
                                        </div>
                                        <div className="metric-sub">Source: Grand Totals Net P&L</div>
                                    </div>
                                    <div className="metric-card warning">
                                        <div className="metric-label">Total Fee Burden</div>
                                        <div className="metric-value" style={{ color: 'var(--revision)' }}>
                                            {fmtUSD(latestReport.taxCleanedResult.derived_fields?.fee_total)}
                                        </div>
                                        <div className="metric-sub">
                                            {latestReport.taxCleanedResult.derived_fields?.fee_to_pnl_ratio != null
                                                ? `${latestReport.taxCleanedResult.derived_fields.fee_to_pnl_ratio}% of |P&L|`
                                                : 'N/A ratio'}
                                        </div>
                                    </div>
                                    <div className="metric-card purple">
                                        <div className="metric-label">Est. Tax Reserve (25%)</div>
                                        <div className="metric-value" style={{ color: 'var(--generated)' }}>
                                            {fmtUSD(latestReport.taxCleanedResult.derived_fields?.estimated_tax_reserve)}
                                        </div>
                                        <div className="metric-sub"><StateBadge state="NON-OFFICIAL" /></div>
                                    </div>
                                    <div className="metric-card info">
                                        <div className="metric-label">Annual Net Cash</div>
                                        <div className={`metric-value ${valColor(latestReport.taxCleanedResult.derived_fields?.annual_net_cash)}`}>
                                            {fmtUSD(latestReport.taxCleanedResult.derived_fields?.annual_net_cash)}
                                        </div>
                                        <div className="metric-sub">Cash flow from trading</div>
                                    </div>
                                </div>

                                {/* Monthly Cleaned P&L Table */}
                                <div className="section-header">
                                    <h2>Monthly Cleaned P&L</h2>
                                    <span className="text-xs text-muted">Year {latestReport.taxCleanedResult.derived_fields?.report_year}</span>
                                </div>

                                {/* Mini Bar Chart */}
                                <div className="card mb-md" style={{ padding: '20px' }}>
                                    <div className="text-xs text-muted mb-sm font-bold">Monthly Net P&L Distribution</div>
                                    <div className="bar-chart" style={{ height: 100 }}>
                                        {latestReport.taxCleanedResult.derived_fields?.monthly_cleaned_pnl?.map(m => {
                                            const maxAbs = Math.max(...latestReport.taxCleanedResult.derived_fields.monthly_cleaned_pnl.map(x => Math.abs(x.net_pnl)), 1);
                                            const pct = Math.abs(m.net_pnl) / maxAbs * 90;
                                            return (
                                                <div key={m.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                                                    <div
                                                        className={`bar-chart-bar ${m.net_pnl >= 0 ? 'positive' : 'negative'}`}
                                                        style={{ height: `${Math.max(pct, 4)}%`, width: '100%' }}
                                                        title={fmtUSD(m.net_pnl)}
                                                    ></div>
                                                    <div className="bar-chart-label">M{m.month}</div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="table-container">
                                    <div className="table-scroll">
                                        <table>
                                            <thead>
                                                <tr>
                                                    <th>Month</th>
                                                    <th>Trade Date</th>
                                                    <th className="number">Net P&L</th>
                                                    <th className="number">Net Cash</th>
                                                    <th className="number">Fees</th>
                                                    <th className="number">YTD P&L</th>
                                                    <th className="number">YTD Fees</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {latestReport.taxCleanedResult.derived_fields?.monthly_cleaned_pnl?.map(m => (
                                                    <tr key={m.month}>
                                                        <td style={{ fontWeight: 600 }}>{m.month}</td>
                                                        <td>{m.trade_date}</td>
                                                        <td className={`number font-mono ${valColor(m.net_pnl)}`}>{fmtUSD(m.net_pnl)}</td>
                                                        <td className={`number font-mono ${valColor(m.net_cash)}`}>{fmtUSD(m.net_cash)}</td>
                                                        <td className="number font-mono" style={{ color: 'var(--revision)' }}>{fmtUSD(m.fees)}</td>
                                                        <td className={`number font-mono ${valColor(m.ytd_pnl)}`}>{fmtUSD(m.ytd_pnl)}</td>
                                                        <td className="number font-mono" style={{ color: 'var(--revision)' }}>{fmtUSD(m.ytd_fees)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* How derived values are computed */}
                                <div className="card mt-lg" style={{ padding: 20 }}>
                                    <h3 style={{ fontSize: 13, marginBottom: 12 }}>📐 How Derived Values Are Computed</h3>
                                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 2 }}>
                                        <div><strong>Annual Reported P&L</strong> = Grand Totals Net P&L from the Colmex report</div>
                                        <div><strong>Total Fee Burden</strong> = Σ (Total Comm + SEC Fee + NASD Fee + ECN Take + ECN Add + Routing Fee + NSCC Fee)</div>
                                        <div><strong>Estimated Tax Reserve</strong> = 25% × Annual Reported P&L (only if positive; $0 if negative)</div>
                                        <div><strong>Fee-to-P&L Ratio</strong> = Total Fee Burden ÷ |Annual P&L| × 100</div>
                                        <div><strong>YTD</strong> = Running cumulative sum of monthly values</div>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="card" style={{ textAlign: 'center', padding: 40 }}>
                                <StateBadge state={latestReport?.taxCleanedResult?.status || 'BLOCKED'} />
                                <p className="text-muted mt-md">{latestReport?.taxCleanedResult?.reason || 'Tax-cleaned outputs not available for this report'}</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Tab 3: Validation & Reconciliation */}
                {activeTab === 3 && latestReport && (
                    <div className="tab-content animate-fade-in">
                        <div className="grid-2 mb-lg">
                            {/* Validation */}
                            <div className="card">
                                <div className="flex justify-between items-center mb-md">
                                    <h3 style={{ fontSize: 14, fontWeight: 700 }}>Validation</h3>
                                    <StateBadge state={latestReport.validationResult?.status} />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    {Object.entries(latestReport.validationResult?.checks || {}).map(([check, passed]) => (
                                        <div key={check} className="flex justify-between items-center" style={{ padding: '8px 12px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)' }}>
                                            <span className="text-sm">{check.replace(/_/g, ' ')}</span>
                                            <span style={{ fontSize: 16 }}>{passed ? '✅' : '❌'}</span>
                                        </div>
                                    ))}
                                </div>
                                {latestReport.validationResult?.warnings?.length > 0 && (
                                    <div className="mt-md">
                                        <div className="text-xs font-bold mb-sm" style={{ color: 'var(--revision)' }}>⚠ Warnings</div>
                                        {latestReport.validationResult.warnings.map((w, i) => (
                                            <div key={i} className="text-xs text-muted" style={{ padding: '4px 0' }}>{w}</div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Reconciliation */}
                            <div className="card">
                                <div className="flex justify-between items-center mb-md">
                                    <h3 style={{ fontSize: 14, fontWeight: 700 }}>Reconciliation</h3>
                                    <StateBadge state={latestReport.reconciliationResult?.status} />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    {Object.entries(latestReport.reconciliationResult?.checks || {}).map(([check, passed]) => (
                                        <div key={check} className="flex justify-between items-center" style={{ padding: '8px 12px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)' }}>
                                            <span className="text-sm">{check.replace(/_/g, ' ')}</span>
                                            <span style={{ fontSize: 16 }}>{passed ? '✅' : '❌'}</span>
                                        </div>
                                    ))}
                                </div>
                                {latestReport.reconciliationResult?.details?.length > 0 && (
                                    <div className="mt-md">
                                        <div className="text-xs font-bold mb-sm" style={{ color: 'var(--error)' }}>✕ Mismatch Details</div>
                                        {latestReport.reconciliationResult.details.map((d, i) => (
                                            <div key={i} className="notification-banner error" style={{ fontSize: 12, padding: '8px 12px', marginBottom: 6 }}>
                                                <div>
                                                    <strong>{d.field}</strong>: {d.message}
                                                    {d.difference && <span> (Δ {fmtUSD(d.difference)})</span>}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Exceptions for this client */}
                        {exceptions?.length > 0 && (
                            <>
                                <div className="section-header">
                                    <h2>Exceptions</h2>
                                    <span className="text-xs text-muted">{exceptions.filter(e => e.status === 'OPEN').length} open</span>
                                </div>
                                {exceptions.map(exc => (
                                    <div className="exception-card" key={exc.id}>
                                        <div className="exception-card-header">
                                            <div className="flex gap-sm items-center">
                                                <span className="exception-card-id">{exc.id}</span>
                                                <StateBadge state={exc.type?.includes('MISMATCH') ? 'MISMATCH' : exc.type?.includes('CONFLICT') ? 'CONFLICT' : 'REVIEW_REQUIRED'} />
                                            </div>
                                            <StateBadge state={exc.status} />
                                        </div>
                                        <div className="exception-card-detail">
                                            <strong>{exc.type}</strong> — {exc.detail}
                                        </div>
                                    </div>
                                ))}
                            </>
                        )}
                    </div>
                )}

                {/* Tab 4: History & Audit */}
                {activeTab === 4 && (
                    <div className="tab-content animate-fade-in">
                        {/* Version History (before/after if revision) */}
                        {reports?.filter(r => !r.is_active).length > 0 && (
                            <>
                                <div className="section-header">
                                    <h2>Version History</h2>
                                </div>
                                <div className="card mb-lg">
                                    {reports.map(r => (
                                        <div key={r.id} className="flex justify-between items-center" style={{ padding: '10px 0', borderBottom: '1px solid var(--border-primary)' }}>
                                            <div className="flex gap-md items-center">
                                                <span className="font-mono text-xs" style={{ minWidth: 180 }}>{r.id}</span>
                                                <StateBadge state={r.state} />
                                                <span className="text-xs">v{r.version}</span>
                                            </div>
                                            <div className="flex gap-sm items-center">
                                                {r.is_active ? <StateBadge state="ACTIVE" /> : <span className="text-xs text-muted">archived</span>}
                                                <span className="text-xs text-muted">{new Date(r.stored_at).toLocaleString()}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}

                        {/* Audit Timeline */}
                        <div className="section-header">
                            <h2>Audit Trail</h2>
                            <span className="text-xs text-muted">{audit_events?.length || 0} events</span>
                        </div>
                        <div className="timeline">
                            {audit_events?.map(evt => (
                                <div key={evt.id} className={`timeline-event ${evt.event_type.includes('ERROR') || evt.event_type.includes('CONFLICT') ? 'error' : evt.event_type.includes('WARNING') || evt.event_type.includes('EXCEPTION') ? 'warning' : 'success'}`}>
                                    <div className="timeline-event-header">
                                        <span className="timeline-event-type">{evt.event_type.replace(/_/g, ' ')}</span>
                                        <span className="timeline-event-time">{new Date(evt.timestamp).toLocaleString()}</span>
                                    </div>
                                    <div className="timeline-event-detail">
                                        {evt.detail || evt.report_state || evt.validation_status || evt.reconciliation_status || evt.scenario_id || ''}
                                        {evt.payload_hash && <span className="text-xs text-muted" style={{ marginLeft: 8 }}>hash: {evt.payload_hash?.substring(0, 8)}...</span>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </AppShell>
    );
}

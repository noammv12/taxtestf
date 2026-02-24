'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AppShell from '@/components/AppShell';
import StateBadge from '@/components/StateBadge';
import Link from 'next/link';

export default function TaxReportDetailPage() {
    const { id } = useParams();
    const router = useRouter();
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('summary');
    const [approving, setApproving] = useState(false);
    const [notes, setNotes] = useState('');

    const fetchReport = async () => {
        try {
            const res = await fetch(`/api/reports/${id}`);
            if (!res.ok) throw new Error('Not found');
            setReport(await res.json());
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchReport(); }, [id]);

    const handleAction = async (action) => {
        setApproving(true);
        await fetch(`/api/reports/${id}/approve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, notes }),
        });
        await fetchReport();
        setNotes('');
        setApproving(false);
    };

    const fmt = (val) => {
        if (val === null || val === undefined) return '—';
        const sign = val < 0 ? '-' : '';
        return `${sign}$${Math.abs(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    if (loading) {
        return <AppShell><div className="page-container"><div className="loading-spinner"><div className="spinner"></div> Loading report...</div></div></AppShell>;
    }

    if (!report) {
        return (
            <AppShell>
                <div className="page-container">
                    <div className="batch-hero">
                        <h2>Report Not Found</h2>
                        <p>The tax report you're looking for doesn't exist</p>
                        <Link href="/reports" className="btn btn-primary">Back to Reports</Link>
                    </div>
                </div>
            </AppShell>
        );
    }

    const td = report.tax_data;
    const as = td?.annual_summary;
    const cs = td?.client_summary;
    const mb = td?.monthly_breakdown || [];
    const fs = td?.fee_schedule;
    const la = td?.loss_analysis;
    const explanations = td?.explanations || [];
    const complianceNotes = td?.compliance_notes || [];
    const acctSummary = td?.account_summary;

    const tabs = [
        { key: 'summary', label: 'Summary' },
        { key: 'monthly', label: 'Monthly Breakdown' },
        { key: 'fees', label: 'Fee Analysis' },
        { key: 'walkthrough', label: 'Tax Calculation' },
        { key: 'compliance', label: 'Compliance' },
        { key: 'approval', label: 'Approval' },
    ];

    return (
        <AppShell>
            <div className="page-container">
                {/* Header */}
                <div className="page-header">
                    <div>
                        <div className="flex items-center gap-md mb-sm">
                            <Link href="/reports" className="btn btn-secondary" style={{ padding: '4px 14px', fontSize: 13 }}>← Back</Link>
                            <span className="font-mono text-muted text-sm">{report.id}</span>
                            <StateBadge state={report.status} />
                        </div>
                        <h1>Tax Report: {cs?.client_name || report.client_name}</h1>
                        <p>{cs?.account_id} · Tax Year {cs?.tax_year} · {cs?.report_period}</p>
                    </div>
                    <div className="text-xs text-muted text-right">
                        <div>Generated: {new Date(report.generated_at).toLocaleString()}</div>
                        <div>v{report.version}</div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="tabs">
                    {tabs.map(t => (
                        <button key={t.key} className={`tab ${activeTab === t.key ? 'active' : ''}`} onClick={() => setActiveTab(t.key)}>
                            {t.label}
                        </button>
                    ))}
                </div>

                {/* ═══ SUMMARY TAB ═══ */}
                {activeTab === 'summary' && (
                    <>
                        <div className="metrics-grid">
                            <div className="metric-card">
                                <div className="metric-label">Gross Trading P&L</div>
                                <div className="metric-value" style={{ color: as?.gross_trading_pnl > 0 ? 'var(--positive)' : 'var(--negative)' }}>
                                    {fmt(as?.gross_trading_pnl)}
                                </div>
                                <div className="metric-sub">before fee deductions</div>
                            </div>
                            <div className="metric-card">
                                <div className="metric-label">Deductible Fees</div>
                                <div className="metric-value" style={{ color: 'var(--negative)' }}>
                                    -{fmt(as?.total_deductible_fees)}
                                </div>
                                <div className="metric-sub">trading expenses</div>
                            </div>
                            <div className="metric-card">
                                <div className="metric-label">Net Taxable P&L</div>
                                <div className="metric-value" style={{ color: as?.net_taxable_pnl > 0 ? 'var(--positive)' : 'var(--negative)', fontSize: 28 }}>
                                    {fmt(as?.net_taxable_pnl)}
                                </div>
                                <div className="metric-sub">after deductions</div>
                            </div>
                            <div className="metric-card" style={{ background: 'var(--accent-soft)' }}>
                                <div className="metric-label" style={{ color: 'var(--accent)', fontWeight: 600 }}>Tax Liability (25%)</div>
                                <div className="metric-value" style={{ color: 'var(--accent)', fontSize: 28 }}>{fmt(as?.computed_tax_liability)}</div>
                                <div className="metric-sub">{as?.is_profit_year ? `effective rate: ${as?.effective_tax_rate}%` : 'loss year — no tax due'}</div>
                            </div>
                        </div>

                        {/* Account Overview */}
                        <div className="card">
                            <h3 className="mb-md" style={{ fontSize: 15, fontWeight: 600 }}>Colmex Account Overview</h3>
                            <div className="metrics-grid" style={{ marginBottom: 0 }}>
                                {[
                                    { label: 'Opening Balance', value: acctSummary?.opening_balance },
                                    { label: 'Deposits / Withdrawals', value: acctSummary?.total_deposit_withdrawal },
                                    { label: 'Credits / Debits', value: acctSummary?.total_credit_debit },
                                    { label: 'Profit & Loss', value: acctSummary?.profit_loss },
                                    { label: 'Closing Equity', value: acctSummary?.closing_balance_equity },
                                ].map((item, i) => (
                                    <div key={i} style={{ textAlign: 'center' }}>
                                        <div className="text-xs text-muted" style={{ textTransform: 'uppercase', marginBottom: 4 }}>{item.label}</div>
                                        <div className="font-mono font-bold" style={{ fontSize: 16 }}>{fmt(item.value)}</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Loss carry-forward alert */}
                        {!as?.is_profit_year && (
                            <div className="card" style={{ borderLeft: '3px solid var(--accent)' }}>
                                <h3 className="mb-sm" style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent)' }}>Loss Year — Carry Forward</h3>
                                <p className="text-sm" style={{ color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 }}>
                                    This client had a net loss of <strong>{fmt(as?.net_taxable_pnl)}</strong> in {cs?.tax_year}.
                                    No capital gains tax is due. The loss of <strong>{fmt(la?.carry_forward_amount)}</strong> can be carried forward
                                    indefinitely to offset future capital gains under Section 92 of the Israeli Income Tax Ordinance.
                                </p>
                            </div>
                        )}

                        {/* Performance */}
                        <div className="card">
                            <h3 className="mb-md" style={{ fontSize: 15, fontWeight: 600 }}>Trading Performance</h3>
                            <div className="metrics-grid" style={{ marginBottom: 0 }}>
                                <div style={{ textAlign: 'center' }}>
                                    <div className="text-xs text-muted" style={{ textTransform: 'uppercase', marginBottom: 4 }}>Gain Months</div>
                                    <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--positive)' }}>{la?.gain_months || 0}</div>
                                </div>
                                <div style={{ textAlign: 'center' }}>
                                    <div className="text-xs text-muted" style={{ textTransform: 'uppercase', marginBottom: 4 }}>Loss Months</div>
                                    <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--negative)' }}>{la?.loss_months || 0}</div>
                                </div>
                                <div style={{ textAlign: 'center' }}>
                                    <div className="text-xs text-muted" style={{ textTransform: 'uppercase', marginBottom: 4 }}>Best Month</div>
                                    <div className="font-bold" style={{ color: 'var(--positive)' }}>{la?.best_month?.trade_date}</div>
                                    <div className="font-mono text-xs">{fmt(la?.best_month?.net_pnl)}</div>
                                </div>
                                <div style={{ textAlign: 'center' }}>
                                    <div className="text-xs text-muted" style={{ textTransform: 'uppercase', marginBottom: 4 }}>Worst Month</div>
                                    <div className="font-bold" style={{ color: 'var(--negative)' }}>{la?.worst_month?.trade_date}</div>
                                    <div className="font-mono text-xs">{fmt(la?.worst_month?.net_pnl)}</div>
                                </div>
                            </div>
                        </div>
                    </>
                )}

                {/* ═══ MONTHLY BREAKDOWN TAB ═══ */}
                {activeTab === 'monthly' && (
                    <div className="table-container animate-fade-in">
                        <div className="table-header">
                            <h3>Monthly P&L Breakdown</h3>
                            <span className="text-sm text-muted">Detailed monthly trading performance with cumulative YTD totals</span>
                        </div>
                        <div className="table-scroll">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Month</th>
                                        <th className="number">Gross P&L</th>
                                        <th className="number">Fees</th>
                                        <th className="number">Net P&L</th>
                                        <th className="number">Net Cash</th>
                                        <th className="number">YTD P&L</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {mb.map((m, i) => (
                                        <tr key={i}>
                                            <td className="font-bold">{m.trade_date}</td>
                                            <td className="number font-mono">{fmt(m.gross_pnl)}</td>
                                            <td className="number font-mono text-muted">{fmt(m.fees)}</td>
                                            <td className={`number font-mono font-bold ${m.net_pnl > 0 ? 'positive' : ''}`} style={{ color: m.net_pnl < 0 ? 'var(--negative)' : undefined }}>
                                                {fmt(m.net_pnl)}
                                            </td>
                                            <td className="number font-mono text-muted">{fmt(m.net_cash)}</td>
                                            <td className={`number font-mono font-bold ${m.cumulative_pnl > 0 ? 'positive' : ''}`} style={{ color: m.cumulative_pnl < 0 ? 'var(--negative)' : undefined }}>
                                                {fmt(m.cumulative_pnl)}
                                            </td>
                                            <td><StateBadge state={m.is_profit ? 'SUCCESS' : m.is_loss ? 'FAILED' : 'SKIPPED'} /></td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="table-grand-total">
                                        <td>Annual Total</td>
                                        <td className="number font-mono">{fmt(as?.gross_trading_pnl)}</td>
                                        <td className="number font-mono text-muted">{fmt(as?.total_deductible_fees)}</td>
                                        <td className="number font-mono font-bold" style={{ color: as?.net_taxable_pnl > 0 ? 'var(--positive)' : 'var(--negative)' }}>{fmt(as?.net_taxable_pnl)}</td>
                                        <td className="number font-mono text-muted">—</td>
                                        <td className="number font-mono font-bold" style={{ color: as?.net_taxable_pnl > 0 ? 'var(--positive)' : 'var(--negative)' }}>{fmt(as?.net_taxable_pnl)}</td>
                                        <td></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                )}

                {/* ═══ FEE ANALYSIS TAB ═══ */}
                {activeTab === 'fees' && (
                    <>
                        <div className="table-container animate-fade-in mb-lg">
                            <div className="table-header">
                                <h3>Fee Schedule (Tax-Deductible Expenses)</h3>
                            </div>
                            <div className="table-scroll">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Fee Type</th>
                                            <th>Description</th>
                                            <th className="number">Amount (USD)</th>
                                            <th className="number">% of Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {[
                                            { key: 'commissions', label: 'Trading Commissions', desc: 'Broker commission per trade' },
                                            { key: 'sec_fee', label: 'SEC Fee', desc: 'Securities and Exchange Commission regulatory fee' },
                                            { key: 'nasd_fee', label: 'NASD/FINRA Fee', desc: 'Financial Industry Regulatory Authority fee' },
                                            { key: 'ecn_take', label: 'ECN Take Fee', desc: 'ECN liquidity removal' },
                                            { key: 'ecn_add', label: 'ECN Add Fee', desc: 'ECN liquidity provision' },
                                            { key: 'routing_fee', label: 'Routing Fee', desc: 'Order routing and execution fee' },
                                            { key: 'nscc_fee', label: 'NSCC Fee', desc: 'National Securities Clearing Corporation fee' },
                                        ].map(fee => {
                                            const amount = fs?.[fee.key] || 0;
                                            const pct = fs?.total > 0 ? ((amount / fs.total) * 100).toFixed(1) : '0.0';
                                            return (
                                                <tr key={fee.key} style={{ opacity: amount === 0 ? 0.4 : 1 }}>
                                                    <td className="font-bold">{fee.label}</td>
                                                    <td className="text-sm text-muted">{fee.desc}</td>
                                                    <td className="number font-mono font-bold">{fmt(amount)}</td>
                                                    <td className="number font-mono text-muted">{amount > 0 ? `${pct}%` : '—'}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                    <tfoot>
                                        <tr className="table-grand-total">
                                            <td colSpan={2}>Total Deductible Expenses</td>
                                            <td className="number font-mono" style={{ fontSize: 16 }}>{fmt(fs?.total)}</td>
                                            <td className="number font-mono">100%</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>

                        {/* Fee Impact Cards */}
                        <div className="metrics-grid">
                            <div className="metric-card">
                                <div className="metric-label">Fee-to-Gross P&L Ratio</div>
                                <div className="metric-value" style={{ color: 'var(--accent)' }}>
                                    {fs?.fee_to_gross_pnl_ratio !== null ? `${fs.fee_to_gross_pnl_ratio}%` : 'N/A'}
                                </div>
                                <div className="metric-sub">of gross income consumed by fees</div>
                            </div>
                            <div className="metric-card success">
                                <div className="metric-label">Tax Saved via Deductions</div>
                                <div className="metric-value">{fmt((fs?.total || 0) * 0.25)}</div>
                                <div className="metric-sub">25% of deductible fees</div>
                            </div>
                            <div className="metric-card">
                                <div className="metric-label">Effective Tax Rate</div>
                                <div className="metric-value" style={{ color: 'var(--state-tax)' }}>{as?.effective_tax_rate}%</div>
                                <div className="metric-sub">on gross trading income</div>
                            </div>
                        </div>
                    </>
                )}

                {/* ═══ TAX CALCULATION WALKTHROUGH TAB ═══ */}
                {activeTab === 'walkthrough' && (
                    <>
                        <div className="card mb-md" style={{ borderLeft: '3px solid var(--accent)' }}>
                            <p className="text-sm" style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                                Step-by-step explanation of how the tax liability was calculated,
                                including legal basis under Israeli tax law. Each step shows the formula and numbers used.
                            </p>
                        </div>

                        {explanations.map((exp, i) => (
                            <div key={i} className="card" style={{ marginBottom: 12, padding: 24 }}>
                                <div className="flex gap-md" style={{ alignItems: 'flex-start' }}>
                                    <div style={{
                                        width: 32, height: 32, borderRadius: '50%',
                                        background: 'var(--accent-soft)', color: 'var(--accent)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: 14, fontWeight: 700, flexShrink: 0,
                                    }}>
                                        {exp.step}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <h4 className="mb-sm" style={{ fontSize: 14, fontWeight: 600 }}>{exp.title}</h4>
                                        <p className="text-sm mb-sm" style={{ color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 }}>
                                            {exp.text}
                                        </p>
                                        {exp.formula && (
                                            <div className="font-mono text-xs" style={{
                                                background: 'var(--bg-tertiary)', border: '1px solid var(--border-secondary)',
                                                borderRadius: 'var(--radius-sm)', padding: '10px 14px', marginTop: 8, marginBottom: 8,
                                            }}>
                                                {exp.formula}
                                            </div>
                                        )}
                                        {exp.items && exp.items.length > 0 && (
                                            <ul style={{ margin: '8px 0', paddingLeft: 20, listStyle: 'none' }}>
                                                {exp.items.map((item, j) => (
                                                    <li key={j} className="font-mono text-xs" style={{
                                                        padding: '4px 0', borderBottom: '1px solid var(--border-primary)',
                                                    }}>
                                                        {item}
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                        {exp.legal_basis && (
                                            <div className="text-xs" style={{
                                                color: 'var(--text-tertiary)', fontStyle: 'italic',
                                                background: '#fefce8', border: '1px solid #fef08a',
                                                borderRadius: 'var(--radius-sm)', padding: '6px 10px', marginTop: 8,
                                            }}>
                                                Legal basis: {exp.legal_basis}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </>
                )}

                {/* ═══ COMPLIANCE TAB ═══ */}
                {activeTab === 'compliance' && (
                    <>
                        <div className="card mb-lg">
                            <h3 className="mb-md" style={{ fontSize: 15, fontWeight: 600 }}>Compliance & Regulatory Notes</h3>
                            <div className="flex flex-col gap-sm">
                                {complianceNotes.map((note, i) => (
                                    <div key={i} className="exception-card" style={{
                                        borderLeft: note.includes('WARNING') ? '3px solid var(--state-revision)' :
                                            note.includes('NOT') ? '3px solid var(--state-error)' :
                                                note.includes('Recommended') ? '3px solid var(--accent)' : '3px solid var(--border-secondary)',
                                    }}>
                                        <span className="text-sm" style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>{note}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="table-container">
                            <div className="table-header"><h3>Report Metadata</h3></div>
                            <table>
                                <tbody>
                                    {[
                                        ['Source Report Type', td?.report_metadata?.source_report_type],
                                        ['Template Version', td?.report_metadata?.template_version],
                                        ['Tax Jurisdiction', td?.report_metadata?.tax_jurisdiction],
                                        ['Applicable Law', td?.report_metadata?.applicable_law],
                                        ['Tax Rate Basis', td?.report_metadata?.tax_rate_basis],
                                        ['Validation Status', td?.report_metadata?.validation_status],
                                        ['Reconciliation Status', td?.report_metadata?.reconciliation_status],
                                    ].map(([label, value], i) => (
                                        <tr key={i}>
                                            <td className="font-bold" style={{ width: 220 }}>{label}</td>
                                            <td className="font-mono text-xs">{value || '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}

                {/* ═══ APPROVAL TAB ═══ */}
                {activeTab === 'approval' && (
                    <>
                        <div className="card mb-lg" style={{ textAlign: 'center', padding: 40 }}>
                            <div className="mb-sm" style={{ fontSize: 24 }}>
                                <StateBadge state={report.status} size="large" />
                            </div>
                            {report.approved_at && (
                                <p className="text-sm text-muted">Approved by {report.approved_by} on {new Date(report.approved_at).toLocaleString()}</p>
                            )}
                            {report.rejected_at && (
                                <p className="text-sm text-muted">Rejected by {report.rejected_by} on {new Date(report.rejected_at).toLocaleString()}</p>
                            )}
                            {report.review_notes && (
                                <p className="text-sm mt-sm" style={{ fontStyle: 'italic' }}>"{report.review_notes}"</p>
                            )}
                        </div>

                        <div className="card">
                            <h3 className="mb-md" style={{ fontSize: 15, fontWeight: 600 }}>Review Actions</h3>
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Add review notes (optional)..."
                                rows={3}
                                style={{
                                    width: '100%', padding: '12px 16px', borderRadius: 'var(--radius-sm)',
                                    border: '1px solid var(--border-secondary)', fontSize: 14, resize: 'vertical',
                                    fontFamily: 'inherit', marginBottom: 16,
                                }}
                            />
                            <div className="flex gap-md">
                                <button className="btn btn-primary" onClick={() => handleAction('approve')} disabled={approving} style={{ flex: 1, background: 'var(--positive)' }}>
                                    {approving ? 'Processing...' : 'Approve Report'}
                                </button>
                                <button className="btn btn-secondary" onClick={() => handleAction('flag')} disabled={approving} style={{ flex: 1 }}>
                                    Flag for Review
                                </button>
                                <button className="btn btn-secondary" onClick={() => handleAction('reject')} disabled={approving} style={{ flex: 1, color: 'var(--negative)', borderColor: 'var(--negative)' }}>
                                    Reject
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </AppShell>
    );
}

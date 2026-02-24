'use client';

import { useState, useEffect, use } from 'react';
import AppShell from '@/components/AppShell';
import StateBadge from '@/components/StateBadge';
import Link from 'next/link';

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

export default function Client360Page({ params }) {
    const resolvedParams = use(params);
    const id = resolvedParams.id;
    const [data, setData] = useState(null);
    const [taxReports, setTaxReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState(0);

    useEffect(() => {
        Promise.all([
            fetch(`/api/clients/${id}`).then(r => r.json()),
            fetch('/api/reports').then(r => r.json()),
        ]).then(([clientData, reportsData]) => {
            setData(clientData);
            const clientReports = (reportsData.reports || []).filter(r => r.account_id === id);
            setTaxReports(clientReports);
            setLoading(false);
        }).catch(() => setLoading(false));
    }, [id]);

    if (loading) return <AppShell><div className="page-container"><div className="loading-spinner"><div className="spinner"></div> Loading client data...</div></div></AppShell>;
    if (!data || data.error) return <AppShell><div className="page-container"><div className="batch-hero"><h2>Client Not Found</h2><p>No data for account {id}</p><Link href="/clients" className="btn btn-primary">Back to Clients</Link></div></div></AppShell>;

    const { client, reports, active_reports, audit_events, exceptions } = data;
    const latestReport = active_reports?.[active_reports.length - 1];
    const latestTaxReport = taxReports[taxReports.length - 1];
    const td = latestTaxReport?.tax_data;
    const as = td?.annual_summary;

    // Compute monthly tax withholding from tax report data
    const monthlyWithholding = td?.monthly_breakdown?.map(m => {
        const taxRate = 0.25;
        const taxableAmount = m.net_pnl > 0 ? m.net_pnl : 0;
        return {
            ...m,
            monthly_tax: taxableAmount * taxRate,
            cumulative_tax: 0, // computed below
        };
    }) || [];
    let runningTax = 0;
    monthlyWithholding.forEach(m => {
        runningTax += m.monthly_tax;
        m.cumulative_tax = runningTax;
    });

    const tabs = ['Overview', 'P&L Detail', 'Tax Position', 'Validation', 'Audit Trail'];

    return (
        <AppShell exceptionCount={exceptions?.filter(e => e.status === 'OPEN').length || 0}>
            <div className="page-container">
                {/* Client Header */}
                <div className="page-header">
                    <div>
                        <div className="flex items-center gap-md mb-sm">
                            <Link href="/clients" className="btn btn-secondary" style={{ padding: '4px 14px', fontSize: 13 }}>Back</Link>
                            <StateBadge state={client.status} />
                            {client.years_on_file?.map(y => (
                                <span key={y} className="badge badge-new" style={{ fontSize: 11 }}>{y}</span>
                            ))}
                        </div>
                        <h1>{client.client_display_name}</h1>
                        <p>
                            <span className="font-mono" style={{ color: 'var(--accent)' }}>{client.account_id}</span>
                            <span className="text-muted" style={{ margin: '0 12px' }}>·</span>
                            <span className="text-muted">{client.username}</span>
                            <span className="text-muted" style={{ margin: '0 12px' }}>·</span>
                            <span className="text-muted">{client.report_count} reports on file</span>
                        </p>
                    </div>
                    {latestTaxReport && (
                        <Link href={`/reports/${latestTaxReport.id}`} className="btn btn-primary">
                            View Tax Report
                        </Link>
                    )}
                </div>

                {/* Tabs */}
                <div className="tabs">
                    {tabs.map((tab, i) => (
                        <button key={tab} className={`tab ${activeTab === i ? 'active' : ''}`} onClick={() => setActiveTab(i)}>
                            {tab}
                        </button>
                    ))}
                </div>

                {/* ═══ TAB 0: OVERVIEW ═══ */}
                {activeTab === 0 && (
                    <div className="animate-fade-in">
                        {/* Key Metrics */}
                        <div className="metrics-grid">
                            <div className="metric-card">
                                <div className="metric-label">Net Taxable P&L</div>
                                <div className="metric-value" style={{ color: as?.net_taxable_pnl > 0 ? 'var(--positive)' : as?.net_taxable_pnl < 0 ? 'var(--negative)' : undefined }}>
                                    {fmtUSD(as?.net_taxable_pnl)}
                                </div>
                                <div className="metric-sub">{as?.is_profit_year ? 'profit year' : 'loss year'}</div>
                            </div>
                            <div className="metric-card" style={{ background: 'var(--accent-soft)' }}>
                                <div className="metric-label" style={{ color: 'var(--accent)', fontWeight: 600 }}>Tax Liability</div>
                                <div className="metric-value" style={{ color: 'var(--accent)' }}>
                                    {fmtUSD(as?.computed_tax_liability)}
                                </div>
                                <div className="metric-sub">{as?.effective_tax_rate}% effective rate</div>
                            </div>
                            <div className="metric-card">
                                <div className="metric-label">Total Fees</div>
                                <div className="metric-value" style={{ color: 'var(--negative)' }}>
                                    {fmtUSD(as?.total_deductible_fees)}
                                </div>
                                <div className="metric-sub">tax-deductible expenses</div>
                            </div>
                            <div className="metric-card">
                                <div className="metric-label">Monthly Tax Withheld</div>
                                <div className="metric-value">{fmtUSD(runningTax)}</div>
                                <div className="metric-sub">YTD cumulative</div>
                            </div>
                        </div>

                        {/* Account Summary */}
                        {latestReport && (
                            <div className="card">
                                <h3 className="mb-md" style={{ fontSize: 15, fontWeight: 600 }}>Account Summary</h3>
                                <div className="metrics-grid" style={{ marginBottom: 0 }}>
                                    {[
                                        { label: 'Opening Balance', value: latestReport.summaryTotals?.opening_balance },
                                        { label: 'Deposits / Withdrawals', value: latestReport.summaryTotals?.total_deposit_withdrawal },
                                        { label: 'Credits / Debits', value: latestReport.summaryTotals?.total_credit_debit },
                                        { label: 'Profit & Loss', value: latestReport.summaryTotals?.profit_loss },
                                        { label: 'Closing Equity', value: latestReport.summaryTotals?.closing_balance_equity },
                                    ].map((item, i) => (
                                        <div key={i} style={{ textAlign: 'center' }}>
                                            <div className="text-xs text-muted" style={{ textTransform: 'uppercase', marginBottom: 4 }}>{item.label}</div>
                                            <div className="font-mono font-bold" style={{ fontSize: 16 }}>{fmtUSD(item.value)}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Loss Carry Forward */}
                        {as && !as.is_profit_year && (
                            <div className="card" style={{ borderLeft: '3px solid var(--accent)' }}>
                                <h3 className="mb-sm" style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent)' }}>Loss Year — Carry Forward</h3>
                                <p className="text-sm" style={{ color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 }}>
                                    Net loss of <strong>{fmtUSD(as.net_taxable_pnl)}</strong> can be carried forward indefinitely to offset future capital gains under Section 92 of the Israeli Income Tax Ordinance.
                                </p>
                            </div>
                        )}

                        {/* Tax Report Links */}
                        {taxReports.length > 0 && (
                            <div className="table-container">
                                <div className="table-header">
                                    <h3>Tax Reports</h3>
                                </div>
                                <div className="table-scroll">
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>Report ID</th>
                                                <th>Year</th>
                                                <th className="number">Net P&L</th>
                                                <th className="number">Tax Liability</th>
                                                <th>Status</th>
                                                <th>Generated</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {taxReports.map(r => (
                                                <tr key={r.id} className="clickable" onClick={() => window.location.href = `/reports/${r.id}`}>
                                                    <td className="font-mono text-xs" style={{ color: 'var(--accent)' }}>{r.id}</td>
                                                    <td className="font-bold">{r.year}</td>
                                                    <td className="number font-mono font-bold" style={{ color: r.tax_data?.annual_summary?.net_taxable_pnl > 0 ? 'var(--positive)' : 'var(--negative)' }}>
                                                        {fmtUSD(r.tax_data?.annual_summary?.net_taxable_pnl)}
                                                    </td>
                                                    <td className="number font-mono font-bold" style={{ color: 'var(--accent)' }}>
                                                        {fmtUSD(r.tax_data?.annual_summary?.computed_tax_liability)}
                                                    </td>
                                                    <td><StateBadge state={r.status} /></td>
                                                    <td className="text-xs text-muted">{new Date(r.generated_at).toLocaleDateString()}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ═══ TAB 1: P&L DETAIL ═══ */}
                {activeTab === 1 && latestReport && (
                    <div className="animate-fade-in">
                        {/* Source Report Header */}
                        <div className="card mb-md">
                            <div className="flex justify-between items-center">
                                <div>
                                    <span className="font-bold">P&L Report</span>
                                    <span className="text-sm text-muted" style={{ marginLeft: 12 }}>
                                        {latestReport.header?.report_period_start} — {latestReport.header?.report_period_end}
                                    </span>
                                </div>
                                <div className="flex gap-sm items-center">
                                    <StateBadge state={latestReport.state} />
                                    <span className="font-mono text-xs text-muted">v{latestReport.version}</span>
                                </div>
                            </div>
                        </div>

                        {/* Monthly Table */}
                        <div className="table-container">
                            <div className="table-header">
                                <h3>Monthly Trading Performance</h3>
                            </div>
                            <div className="table-scroll">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Month</th>
                                            <th>Trade Date</th>
                                            <th className="number">Commissions</th>
                                            <th className="number">Fees</th>
                                            <th className="number">Net P&L</th>
                                            <th className="number">Net Cash</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {latestReport.monthlyRows?.map(row => (
                                            <tr key={row.month}>
                                                <td className="font-bold">{row.month}</td>
                                                <td className="text-xs">{row.trade_date}</td>
                                                <td className="number font-mono">{fmtUSD(row.total_comm)}</td>
                                                <td className="number font-mono text-muted">
                                                    {fmtUSD((row.sec_fee || 0) + (row.nasd_fee || 0) + (row.ecn_take || 0) + (row.ecn_add || 0) + (row.routing_fee || 0) + (row.nscc_fee || 0))}
                                                </td>
                                                <td className="number font-mono font-bold" style={{ color: row.net_pnl > 0 ? 'var(--positive)' : row.net_pnl < 0 ? 'var(--negative)' : undefined }}>
                                                    {fmtUSD(row.net_pnl)}
                                                </td>
                                                <td className="number font-mono" style={{ color: row.net_cash > 0 ? 'var(--positive)' : row.net_cash < 0 ? 'var(--negative)' : undefined }}>
                                                    {fmtUSD(row.net_cash)}
                                                </td>
                                            </tr>
                                        ))}
                                        {latestReport.grandTotals && (
                                            <tr className="table-grand-total">
                                                <td colSpan={2} style={{ fontWeight: 800 }}>Annual Totals</td>
                                                <td className="number font-mono">{fmtUSD(latestReport.grandTotals.total_comm)}</td>
                                                <td className="number font-mono text-muted">
                                                    {fmtUSD((latestReport.grandTotals.sec_fee || 0) + (latestReport.grandTotals.nasd_fee || 0) + (latestReport.grandTotals.ecn_take || 0) + (latestReport.grandTotals.ecn_add || 0) + (latestReport.grandTotals.routing_fee || 0) + (latestReport.grandTotals.nscc_fee || 0))}
                                                </td>
                                                <td className="number font-mono font-bold" style={{ color: latestReport.grandTotals.net_pnl > 0 ? 'var(--positive)' : 'var(--negative)', fontSize: 14 }}>
                                                    {fmtUSD(latestReport.grandTotals.net_pnl)}
                                                </td>
                                                <td className="number font-mono font-bold" style={{ color: latestReport.grandTotals.net_cash > 0 ? 'var(--positive)' : 'var(--negative)', fontSize: 14 }}>
                                                    {fmtUSD(latestReport.grandTotals.net_cash)}
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* All Source Reports */}
                        {reports?.length > 1 && (
                            <div className="table-container" style={{ marginTop: 24 }}>
                                <div className="table-header">
                                    <h3>All Ingested Reports</h3>
                                    <span className="text-xs text-muted">{reports.length} total</span>
                                </div>
                                <div className="table-scroll">
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>Report ID</th>
                                                <th>Year</th>
                                                <th>State</th>
                                                <th>Version</th>
                                                <th>Active</th>
                                                <th className="number">Net P&L</th>
                                                <th>Stored</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {reports.map(r => (
                                                <tr key={r.id}>
                                                    <td className="font-mono text-xs">{r.id}</td>
                                                    <td className="font-bold">{r.header?.year}</td>
                                                    <td><StateBadge state={r.state} /></td>
                                                    <td className="font-mono text-xs">v{r.version}</td>
                                                    <td>{r.is_active ? <StateBadge state="ACTIVE" /> : <span className="text-xs text-muted">archived</span>}</td>
                                                    <td className="number font-mono font-bold" style={{ color: r.grandTotals?.net_pnl > 0 ? 'var(--positive)' : r.grandTotals?.net_pnl < 0 ? 'var(--negative)' : undefined }}>
                                                        {fmtUSD(r.grandTotals?.net_pnl)}
                                                    </td>
                                                    <td className="text-xs text-muted">{r.stored_at ? new Date(r.stored_at).toLocaleDateString() : '—'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ═══ TAB 2: TAX POSITION ═══ */}
                {activeTab === 2 && (
                    <div className="animate-fade-in">
                        {!td ? (
                            <div className="batch-hero">
                                <h2>No Tax Data</h2>
                                <p>Upload this client's P&L report to generate tax calculations</p>
                                <Link href="/upload" className="btn btn-primary">Go to Upload</Link>
                            </div>
                        ) : (
                            <>
                                {/* Tax Summary */}
                                <div className="card mb-md" style={{ borderLeft: '3px solid var(--accent)', padding: 20 }}>
                                    <p className="text-sm" style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                                        Tax position calculated under Israeli Income Tax Ordinance. Capital gains taxed at 25% (Section 91).
                                        Deductible fees reduce the taxable base. {as?.is_profit_year ? '' : 'Net losses carry forward indefinitely under Section 92.'}
                                    </p>
                                </div>

                                {/* Monthly Tax Withholding Schedule */}
                                <div className="table-container mb-lg">
                                    <div className="table-header">
                                        <h3>Monthly Tax Withholding Schedule</h3>
                                        <span className="text-sm text-muted">Form 867 precursor — monthly withholding at 25%</span>
                                    </div>
                                    <div className="table-scroll">
                                        <table>
                                            <thead>
                                                <tr>
                                                    <th>Month</th>
                                                    <th className="number">Net P&L</th>
                                                    <th className="number">Fees</th>
                                                    <th className="number">Taxable Amount</th>
                                                    <th className="number">Monthly Tax (25%)</th>
                                                    <th className="number">YTD P&L</th>
                                                    <th className="number">YTD Tax Withheld</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {monthlyWithholding.map((m, i) => (
                                                    <tr key={i}>
                                                        <td className="font-bold">{m.trade_date}</td>
                                                        <td className="number font-mono" style={{ color: m.net_pnl > 0 ? 'var(--positive)' : m.net_pnl < 0 ? 'var(--negative)' : undefined }}>
                                                            {fmtUSD(m.net_pnl)}
                                                        </td>
                                                        <td className="number font-mono text-muted">{fmtUSD(m.fees)}</td>
                                                        <td className="number font-mono">{m.net_pnl > 0 ? fmtUSD(m.net_pnl) : '—'}</td>
                                                        <td className="number font-mono font-bold" style={{ color: m.monthly_tax > 0 ? 'var(--accent)' : undefined }}>
                                                            {m.monthly_tax > 0 ? fmtUSD(m.monthly_tax) : '—'}
                                                        </td>
                                                        <td className="number font-mono" style={{ color: m.cumulative_pnl > 0 ? 'var(--positive)' : m.cumulative_pnl < 0 ? 'var(--negative)' : undefined }}>
                                                            {fmtUSD(m.cumulative_pnl)}
                                                        </td>
                                                        <td className="number font-mono font-bold" style={{ color: 'var(--accent)' }}>
                                                            {fmtUSD(m.cumulative_tax)}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                            <tfoot>
                                                <tr className="table-grand-total">
                                                    <td>Annual Total</td>
                                                    <td className="number font-mono font-bold" style={{ color: as?.net_taxable_pnl > 0 ? 'var(--positive)' : 'var(--negative)' }}>
                                                        {fmtUSD(as?.net_taxable_pnl)}
                                                    </td>
                                                    <td className="number font-mono text-muted">{fmtUSD(as?.total_deductible_fees)}</td>
                                                    <td className="number font-mono">{fmtUSD(as?.net_taxable_pnl > 0 ? as?.net_taxable_pnl : 0)}</td>
                                                    <td className="number font-mono font-bold" style={{ color: 'var(--accent)' }}>{fmtUSD(as?.computed_tax_liability)}</td>
                                                    <td className="number font-mono font-bold">{fmtUSD(as?.net_taxable_pnl)}</td>
                                                    <td className="number font-mono font-bold" style={{ color: 'var(--accent)', fontSize: 15 }}>{fmtUSD(as?.computed_tax_liability)}</td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                </div>

                                {/* Fee Breakdown */}
                                <div className="card">
                                    <h3 className="mb-md" style={{ fontSize: 15, fontWeight: 600 }}>Deductible Fee Breakdown</h3>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        {[
                                            { label: 'Trading Commissions', key: 'commissions' },
                                            { label: 'SEC Fee', key: 'sec_fee' },
                                            { label: 'NASD/FINRA Fee', key: 'nasd_fee' },
                                            { label: 'ECN Take Fee', key: 'ecn_take' },
                                            { label: 'ECN Add Fee', key: 'ecn_add' },
                                            { label: 'Routing Fee', key: 'routing_fee' },
                                            { label: 'NSCC Fee', key: 'nscc_fee' },
                                        ].map(fee => {
                                            const amount = td?.fee_schedule?.[fee.key] || 0;
                                            const total = td?.fee_schedule?.total || 1;
                                            const pct = (amount / total * 100);
                                            return (
                                                <div key={fee.key} className="flex justify-between items-center" style={{ padding: '8px 12px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', opacity: amount === 0 ? 0.4 : 1 }}>
                                                    <span className="text-sm">{fee.label}</span>
                                                    <div className="flex gap-md items-center">
                                                        <div style={{ width: 80, height: 4, background: 'var(--border-secondary)', borderRadius: 2, overflow: 'hidden' }}>
                                                            <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', background: 'var(--accent)', borderRadius: 2 }}></div>
                                                        </div>
                                                        <span className="font-mono text-xs" style={{ minWidth: 70, textAlign: 'right' }}>{fmtUSD(amount)}</span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        <div className="flex justify-between items-center" style={{ padding: '10px 12px', borderTop: '2px solid var(--border-secondary)', marginTop: 4 }}>
                                            <span className="font-bold text-sm">Total Deductible</span>
                                            <span className="font-mono font-bold">{fmtUSD(td?.fee_schedule?.total)}</span>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* ═══ TAB 3: VALIDATION ═══ */}
                {activeTab === 3 && latestReport && (
                    <div className="animate-fade-in">
                        <div className="grid-2 mb-lg">
                            {/* Validation */}
                            <div className="card">
                                <div className="flex justify-between items-center mb-md">
                                    <h3 style={{ fontSize: 14, fontWeight: 700 }}>Validation</h3>
                                    <StateBadge state={latestReport.validationResult?.status} />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {Object.entries(latestReport.validationResult?.checks || {}).map(([check, passed]) => (
                                        <div key={check} className="flex justify-between items-center" style={{ padding: '8px 12px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)' }}>
                                            <span className="text-sm">{check.replace(/_/g, ' ')}</span>
                                            <StateBadge state={passed ? 'SUCCESS' : 'FAILED'} />
                                        </div>
                                    ))}
                                </div>
                                {latestReport.validationResult?.warnings?.length > 0 && (
                                    <div className="mt-md">
                                        <div className="text-xs font-bold mb-sm" style={{ color: 'var(--state-revision)' }}>Warnings</div>
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
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {Object.entries(latestReport.reconciliationResult?.checks || {}).map(([check, passed]) => (
                                        <div key={check} className="flex justify-between items-center" style={{ padding: '8px 12px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)' }}>
                                            <span className="text-sm">{check.replace(/_/g, ' ')}</span>
                                            <StateBadge state={passed ? 'SUCCESS' : 'FAILED'} />
                                        </div>
                                    ))}
                                </div>
                                {latestReport.reconciliationResult?.details?.length > 0 && (
                                    <div className="mt-md">
                                        <div className="text-xs font-bold mb-sm" style={{ color: 'var(--state-error)' }}>Mismatch Details</div>
                                        {latestReport.reconciliationResult.details.map((d, i) => (
                                            <div key={i} className="notification-banner error" style={{ fontSize: 12, padding: '8px 12px', marginBottom: 6 }}>
                                                <strong>{d.field}</strong>: {d.message}
                                                {d.difference && <span> (difference: {fmtUSD(d.difference)})</span>}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Exceptions */}
                        {exceptions?.length > 0 && (
                            <>
                                <div className="section-header">
                                    <h2>Exceptions</h2>
                                    <span className="text-xs text-muted">{exceptions.filter(e => e.status === 'OPEN').length} open</span>
                                </div>
                                {exceptions.map(exc => (
                                    <div className="card mb-sm" key={exc.id} style={{ borderLeft: `3px solid ${exc.status === 'OPEN' ? 'var(--state-error)' : 'var(--border-secondary)'}` }}>
                                        <div className="flex justify-between items-center mb-sm">
                                            <div className="flex gap-sm items-center">
                                                <span className="font-mono text-xs">{exc.id}</span>
                                                <StateBadge state={exc.type?.includes('MISMATCH') ? 'MISMATCH' : exc.type?.includes('CONFLICT') ? 'CONFLICT' : 'REVIEW_REQUIRED'} />
                                            </div>
                                            <StateBadge state={exc.status} />
                                        </div>
                                        <div className="text-sm text-muted">
                                            <strong>{exc.type}</strong> — {exc.detail}
                                        </div>
                                    </div>
                                ))}
                            </>
                        )}
                    </div>
                )}

                {/* ═══ TAB 4: AUDIT TRAIL ═══ */}
                {activeTab === 4 && (
                    <div className="animate-fade-in">
                        {/* Version History */}
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

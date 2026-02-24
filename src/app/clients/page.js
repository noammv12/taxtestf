'use client';

import { useState, useEffect } from 'react';
import AppShell from '@/components/AppShell';
import StateBadge from '@/components/StateBadge';
import Link from 'next/link';

export default function ClientListPage() {
    const [clients, setClients] = useState([]);
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');

    useEffect(() => {
        Promise.all([
            fetch('/api/clients').then(r => r.json()),
            fetch('/api/reports').then(r => r.json()),
        ]).then(([clientsData, reportsData]) => {
            setClients(clientsData.clients || []);
            setReports(reportsData.reports || []);
            setLoading(false);
        }).catch(() => setLoading(false));
    }, []);

    // Enrich clients with tax data
    const enrichedClients = clients.map(c => {
        const clientReports = reports.filter(r => r.account_id === c.account_id);
        const totalPnl = clientReports.reduce((sum, r) => sum + (r.tax_data?.annual_summary?.net_taxable_pnl || 0), 0);
        const totalTax = clientReports.reduce((sum, r) => sum + (r.tax_data?.annual_summary?.computed_tax_liability || 0), 0);
        const latestStatus = clientReports[clientReports.length - 1]?.status || null;
        return { ...c, totalPnl, totalTax, taxStatus: latestStatus, taxReportCount: clientReports.length };
    });

    const filtered = enrichedClients.filter(c => {
        if (statusFilter !== 'ALL' && c.status !== statusFilter) return false;
        if (!search) return true;
        const term = search.toLowerCase();
        return c.account_id?.toLowerCase().includes(term) ||
            c.client_display_name?.toLowerCase().includes(term) ||
            c.username?.toLowerCase().includes(term);
    });

    const fmt = (val) => {
        if (val === null || val === undefined || val === 0) return '—';
        const sign = val < 0 ? '-' : '';
        return `${sign}$${Math.abs(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    const activeCount = clients.filter(c => c.status === 'ACTIVE').length;
    const totalReportsOnFile = clients.reduce((sum, c) => sum + (c.report_count || 0), 0);
    const uniqueYears = [...new Set(clients.flatMap(c => c.years_on_file || []))].sort();

    return (
        <AppShell>
            <div className="page-container">
                <div className="page-header">
                    <div>
                        <h1>Clients</h1>
                        <p>Registered client accounts and their tax positions</p>
                    </div>
                    <Link href="/upload" className="btn btn-primary">Upload Reports</Link>
                </div>

                {loading ? (
                    <div className="loading-spinner"><div className="spinner"></div> Loading clients...</div>
                ) : clients.length === 0 ? (
                    <div className="batch-hero">
                        <h2>No Clients Yet</h2>
                        <p>Upload client P&L reports to populate this view</p>
                        <Link href="/upload" className="btn btn-primary">Go to Upload</Link>
                    </div>
                ) : (
                    <>
                        {/* Metrics Row */}
                        <div className="metrics-grid animate-fade-in">
                            <div className="metric-card">
                                <div className="metric-label">Total Clients</div>
                                <div className="metric-value">{clients.length}</div>
                                <div className="metric-sub">{activeCount} active</div>
                            </div>
                            <div className="metric-card">
                                <div className="metric-label">Reports on File</div>
                                <div className="metric-value">{totalReportsOnFile}</div>
                                <div className="metric-sub">ingested reports</div>
                            </div>
                            <div className="metric-card">
                                <div className="metric-label">Tax Reports</div>
                                <div className="metric-value">{reports.length}</div>
                                <div className="metric-sub">generated</div>
                            </div>
                            <div className="metric-card">
                                <div className="metric-label">Tax Years</div>
                                <div className="metric-value">{uniqueYears.length > 0 ? uniqueYears.join(', ') : '—'}</div>
                                <div className="metric-sub">on file</div>
                            </div>
                        </div>

                        {/* Filters */}
                        <div className="flex justify-between items-center mb-md" style={{ flexWrap: 'wrap', gap: 12 }}>
                            <div className="filter-bar" style={{ marginBottom: 0 }}>
                                {['ALL', 'ACTIVE', 'REVIEW_REQUIRED'].map(s => (
                                    <button key={s} className={`filter-chip ${statusFilter === s ? 'active' : ''}`} onClick={() => setStatusFilter(s)}>
                                        {s === 'ALL' ? 'All' : s === 'REVIEW_REQUIRED' ? 'Needs Review' : s.charAt(0) + s.slice(1).toLowerCase()}
                                    </button>
                                ))}
                            </div>
                            <div className="flex gap-md items-center">
                                <div className="search-input" style={{ maxWidth: 280 }}>
                                    <input
                                        type="search"
                                        placeholder="Search by name, account, username..."
                                        value={search}
                                        onChange={e => setSearch(e.target.value)}
                                    />
                                </div>
                                <span className="text-sm text-muted">{filtered.length} of {clients.length}</span>
                            </div>
                        </div>

                        {/* Table */}
                        <div className="table-container animate-fade-in">
                            <div className="table-scroll">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Account</th>
                                            <th>Client Name</th>
                                            <th>Username</th>
                                            <th>Status</th>
                                            <th>Reports</th>
                                            <th>Years</th>
                                            <th className="number">Net P&L</th>
                                            <th className="number">Tax Liability</th>
                                            <th>Tax Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filtered.map(c => (
                                            <tr key={c.account_id} className="clickable" onClick={() => window.location.href = `/clients/${c.account_id}`}>
                                                <td style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--accent)' }}>{c.account_id}</td>
                                                <td className="font-bold">{c.client_display_name}</td>
                                                <td className="font-mono text-xs">{c.username}</td>
                                                <td><StateBadge state={c.status} /></td>
                                                <td className="font-mono">{c.report_count}</td>
                                                <td>
                                                    {c.years_on_file?.map(y => (
                                                        <span key={y} className="badge badge-new" style={{ marginRight: 4, fontSize: 10 }}>{y}</span>
                                                    ))}
                                                </td>
                                                <td className="number font-mono font-bold" style={{ color: c.totalPnl < 0 ? 'var(--negative)' : c.totalPnl > 0 ? 'var(--positive)' : undefined }}>
                                                    {fmt(c.totalPnl)}
                                                </td>
                                                <td className="number font-mono font-bold" style={{ color: c.totalTax > 0 ? 'var(--accent)' : undefined }}>
                                                    {fmt(c.totalTax)}
                                                </td>
                                                <td>{c.taxStatus ? <StateBadge state={c.taxStatus} /> : <span className="text-muted text-xs">—</span>}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </AppShell>
    );
}

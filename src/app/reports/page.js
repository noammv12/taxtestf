'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/AppShell';
import StateBadge from '@/components/StateBadge';
import Link from 'next/link';

export default function TaxReportsPage() {
    const [reports, setReports] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('ALL');
    const [searchTerm, setSearchTerm] = useState('');
    const router = useRouter();

    const fetchReports = async () => {
        try {
            const params = new URLSearchParams();
            if (filter !== 'ALL') params.set('status', filter);
            const res = await fetch(`/api/reports?${params}`);
            const data = await res.json();
            setReports(data.reports || []);
            setStats(data.stats || null);
        } catch (err) {
            console.error('Failed to fetch reports:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchReports(); }, [filter]);

    const handleApprove = async (id) => {
        await fetch(`/api/reports/${id}/approve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'approve', notes: 'Approved from dashboard' }),
        });
        fetchReports();
    };

    const filteredReports = reports.filter(r => {
        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();
        return r.account_id?.toLowerCase().includes(term) || r.client_name?.toLowerCase().includes(term);
    });

    const fmt = (val) => {
        if (val === null || val === undefined) return '—';
        const sign = val < 0 ? '-' : '';
        return `${sign}$${Math.abs(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    if (loading) {
        return <AppShell><div className="page-container"><div className="loading-spinner"><div className="spinner"></div> Loading reports...</div></div></AppShell>;
    }

    return (
        <AppShell>
            <div className="page-container">
                <div className="page-header">
                    <div>
                        <h1>Tax Reports</h1>
                        <p>Israeli tax-cleaned reports for Colmex Pro clients</p>
                    </div>
                    <Link href="/upload" className="btn btn-primary">Upload Reports</Link>
                </div>

                {/* Stats */}
                {stats && (
                    <div className="metrics-grid">
                        <div className="metric-card">
                            <div className="metric-label">Total Reports</div>
                            <div className="metric-value">{stats.total}</div>
                            <div className="metric-sub">{stats.total_clients} clients</div>
                        </div>
                        <div className="metric-card success">
                            <div className="metric-label">Approved</div>
                            <div className="metric-value">{stats.approved}</div>
                            <div className="metric-sub">ready for filing</div>
                        </div>
                        <div className="metric-card warning">
                            <div className="metric-label">Pending Review</div>
                            <div className="metric-value">{stats.draft + stats.needs_review}</div>
                            <div className="metric-sub">{stats.draft} draft, {stats.needs_review} flagged</div>
                        </div>
                        <div className="metric-card info">
                            <div className="metric-label">Total Tax Liability</div>
                            <div className="metric-value" style={{ fontSize: 24 }}>{fmt(stats.total_tax_liability)}</div>
                            <div className="metric-sub">across all clients</div>
                        </div>
                    </div>
                )}

                {/* Filters */}
                <div className="flex justify-between items-center mb-md" style={{ flexWrap: 'wrap', gap: 12 }}>
                    <div className="filter-bar" style={{ marginBottom: 0 }}>
                        {['ALL', 'DRAFT', 'APPROVED', 'REJECTED', 'NEEDS_REVIEW'].map(s => (
                            <button key={s} className={`filter-chip ${filter === s ? 'active' : ''}`} onClick={() => setFilter(s)}>
                                {s === 'ALL' ? 'All' : s === 'NEEDS_REVIEW' ? 'Needs Review' : s.charAt(0) + s.slice(1).toLowerCase()}
                            </button>
                        ))}
                    </div>
                    <div className="search-input" style={{ maxWidth: 240 }}>
                        <input
                            type="search"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search by name, account..."
                        />
                    </div>
                </div>

                {filteredReports.length === 0 ? (
                    <div className="batch-hero">
                        <h2>No Tax Reports Generated Yet</h2>
                        <p>Upload client P&L JSON files to generate tax-cleaned reports</p>
                        <Link href="/upload" className="btn btn-primary">Go to Upload</Link>
                    </div>
                ) : (
                    <div className="table-container animate-fade-in">
                        <div className="table-scroll">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Report ID</th>
                                        <th>Account</th>
                                        <th>Client Name</th>
                                        <th>Year</th>
                                        <th className="number">Net P&L</th>
                                        <th className="number">Fees</th>
                                        <th className="number">Tax Liability</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredReports.map(r => {
                                        const td = r.tax_data?.annual_summary;
                                        const pnl = td?.net_taxable_pnl;
                                        const fees = td?.total_deductible_fees;
                                        const tax = td?.computed_tax_liability;

                                        return (
                                            <tr key={r.id} className="clickable" onClick={() => router.push(`/reports/${r.id}`)}>
                                                <td className="font-mono text-xs" style={{ color: 'var(--accent)' }}>{r.id}</td>
                                                <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{r.account_id}</td>
                                                <td className="font-bold">{r.client_name}</td>
                                                <td>{r.year}</td>
                                                <td className={`number font-mono font-bold ${pnl > 0 ? 'positive' : ''}`} style={{ color: pnl < 0 ? 'var(--negative)' : undefined }}>
                                                    {fmt(pnl)}
                                                </td>
                                                <td className="number font-mono text-muted">{fmt(fees)}</td>
                                                <td className="number font-mono font-bold" style={{ color: tax > 0 ? 'var(--accent)' : undefined }}>
                                                    {fmt(tax)}
                                                </td>
                                                <td><StateBadge state={r.status} /></td>
                                                <td onClick={(e) => e.stopPropagation()}>
                                                    {r.status === 'DRAFT' && (
                                                        <button className="btn btn-primary" style={{ fontSize: 12, padding: '4px 14px' }} onClick={() => handleApprove(r.id)}>
                                                            Approve
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </AppShell>
    );
}

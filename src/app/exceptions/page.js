'use client';

import { useState, useEffect } from 'react';
import AppShell from '@/components/AppShell';
import StateBadge from '@/components/StateBadge';
import Link from 'next/link';

export default function ExceptionsPage() {
    const [exceptions, setExceptions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('ALL');
    const [resolving, setResolving] = useState(null);
    const [resolutionNotes, setResolutionNotes] = useState('');

    const loadExceptions = () => {
        setLoading(true);
        const params = filter !== 'ALL' ? `?status=${filter}` : '';
        fetch(`/api/exceptions${params}`)
            .then(r => r.json())
            .then(data => { setExceptions(data.exceptions || []); setLoading(false); })
            .catch(() => setLoading(false));
    };

    useEffect(() => { loadExceptions(); }, [filter]);

    const handleResolve = async (excId, resolution) => {
        await fetch('/api/exceptions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ exception_id: excId, resolution, notes: resolutionNotes }),
        });
        setResolving(null);
        setResolutionNotes('');
        loadExceptions();
    };

    const openCount = exceptions.filter(e => e.status === 'OPEN').length;
    const resolvedCount = exceptions.filter(e => e.status === 'RESOLVED').length;

    const severityIcon = (sev) => {
        if (sev === 'HIGH') return <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', backgroundColor: 'var(--state-error)', marginRight: 6 }}></span>;
        if (sev === 'MEDIUM') return <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', backgroundColor: 'var(--state-revision)', marginRight: 6 }}></span>;
        return <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', backgroundColor: 'var(--state-success)', marginRight: 6 }}></span>;
    };

    return (
        <AppShell exceptionCount={openCount}>
            <div className="page-container">
                <div className="page-header">
                    <h1>Exceptions Queue</h1>
                    <p>Review and resolve ingestion exceptions, identity conflicts, and reconciliation mismatches</p>
                </div>

                {loading ? (
                    <div className="loading-spinner"><div className="spinner"></div> Loading exceptions...</div>
                ) : exceptions.length === 0 && filter === 'ALL' ? (
                    <div className="batch-hero">
                        <h2>No Exceptions</h2>
                        <p>Upload and process reports to see exceptions here</p>
                        <Link href="/upload" className="btn btn-primary">Go to Upload</Link>
                    </div>
                ) : (
                    <>
                        {/* Summary */}
                        <div className="metrics-grid mb-lg" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                            <div className="metric-card danger">
                                <div className="metric-label">Open</div>
                                <div className="metric-value">{openCount}</div>
                            </div>
                            <div className="metric-card success">
                                <div className="metric-label">Resolved</div>
                                <div className="metric-value">{resolvedCount}</div>
                            </div>
                            <div className="metric-card accent">
                                <div className="metric-label">Total</div>
                                <div className="metric-value">{exceptions.length}</div>
                            </div>
                            <div className="metric-card warning">
                                <div className="metric-label">High Severity</div>
                                <div className="metric-value">{exceptions.filter(e => e.severity === 'HIGH' && e.status === 'OPEN').length}</div>
                            </div>
                        </div>

                        {/* Filters */}
                        <div className="filter-bar">
                            {['ALL', 'OPEN', 'RESOLVED'].map(f => (
                                <button key={f} className={`filter-chip ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
                                    {f} {f === 'OPEN' && openCount > 0 && `(${openCount})`}
                                    {f === 'RESOLVED' && resolvedCount > 0 && `(${resolvedCount})`}
                                </button>
                            ))}
                        </div>

                        {/* Exception list */}
                        {exceptions.map(exc => (
                            <div key={exc.id} className="exception-card animate-fade-in">
                                <div className="exception-card-header">
                                    <div className="flex gap-sm items-center">
                                        {severityIcon(exc.severity)}
                                        <span className="exception-card-id">{exc.id}</span>
                                        <StateBadge state={exc.type?.includes('MISMATCH') ? 'MISMATCH' : exc.type?.includes('CONFLICT') ? 'CONFLICT' : exc.type?.includes('PARSE') ? 'FAILED' : exc.type?.includes('PERIOD') ? 'REVIEW_REQUIRED' : exc.type?.includes('MISSING') ? 'FAILED' : 'REVIEW_REQUIRED'} />
                                        <span className="text-xs font-mono" style={{ color: 'var(--accent)' }}>{exc.account_id}</span>
                                    </div>
                                    <div className="flex gap-sm items-center">
                                        <StateBadge state={exc.status} />
                                        <span className="text-xs text-muted">{new Date(exc.created_at).toLocaleString()}</span>
                                    </div>
                                </div>
                                <div className="exception-card-detail">
                                    <strong>{exc.type?.replace(/_/g, ' ')}</strong>
                                    <div style={{ marginTop: 4 }}>{exc.detail}</div>
                                </div>

                                {exc.status === 'OPEN' && (
                                    <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
                                        {resolving === exc.id ? (
                                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 1 }}>
                                                <input
                                                    type="text"
                                                    placeholder="Resolution notes (optional)..."
                                                    value={resolutionNotes}
                                                    onChange={e => setResolutionNotes(e.target.value)}
                                                    style={{ flex: 1 }}
                                                />
                                                <button className="btn btn-success btn-sm" onClick={() => handleResolve(exc.id, 'ACCEPTED')}>✓ Accept</button>
                                                <button className="btn btn-danger btn-sm" onClick={() => handleResolve(exc.id, 'REJECTED')}>✕ Reject</button>
                                                <button className="btn btn-secondary btn-sm" onClick={() => { setResolving(null); setResolutionNotes(''); }}>Cancel</button>
                                            </div>
                                        ) : (
                                            <button className="btn btn-secondary btn-sm" onClick={() => setResolving(exc.id)}>Review & Resolve</button>
                                        )}
                                        <Link href={`/clients/${exc.account_id}`} className="btn btn-secondary btn-sm">View Client →</Link>
                                    </div>
                                )}

                                {exc.status === 'RESOLVED' && (
                                    <div className="text-xs text-muted mt-sm">
                                        Resolved: <strong>{exc.resolution}</strong> {exc.resolution_notes && `— ${exc.resolution_notes}`} • {new Date(exc.resolved_at).toLocaleString()}
                                    </div>
                                )}
                            </div>
                        ))}
                    </>
                )}
            </div>
        </AppShell>
    );
}

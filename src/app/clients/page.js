'use client';

import { useState, useEffect } from 'react';
import AppShell from '@/components/AppShell';
import StateBadge from '@/components/StateBadge';
import Link from 'next/link';

export default function ClientListPage() {
    const [clients, setClients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    useEffect(() => {
        fetch('/api/clients')
            .then(r => r.json())
            .then(data => { setClients(data.clients || []); setLoading(false); })
            .catch(() => setLoading(false));
    }, []);

    const filtered = clients.filter(c =>
        !search ||
        c.account_id?.toLowerCase().includes(search.toLowerCase()) ||
        c.client_display_name?.toLowerCase().includes(search.toLowerCase()) ||
        c.username?.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <AppShell>
            <div className="page-container">
                <div className="page-header">
                    <h1>Clients</h1>
                    <p>All registered client accounts from ingested reports</p>
                </div>

                {loading ? (
                    <div className="loading-spinner"><div className="spinner"></div> Loading clients...</div>
                ) : clients.length === 0 ? (
                    <div className="batch-hero">
                        <h2>No Clients Yet</h2>
                        <p>Run the batch demo from the Dashboard to populate client data</p>
                        <Link href="/" className="btn btn-primary">Go to Dashboard</Link>
                    </div>
                ) : (
                    <>
                        <div className="flex justify-between items-center mb-md">
                            <div className="search-input" style={{ maxWidth: 360 }}>
                                <span className="search-icon">🔍</span>
                                <input
                                    type="search"
                                    placeholder="Search by name, account ID, or username..."
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                />
                            </div>
                            <span className="text-sm text-muted">{filtered.length} clients</span>
                        </div>

                        <div className="table-container animate-fade-in">
                            <div className="table-scroll">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Account ID</th>
                                            <th>Client Name</th>
                                            <th>Username</th>
                                            <th>Status</th>
                                            <th>Reports</th>
                                            <th>Years on File</th>
                                            <th>Created</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filtered.map(c => (
                                            <tr key={c.account_id} className="clickable" onClick={() => window.location.href = `/clients/${c.account_id}`}>
                                                <td style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--accent)' }}>{c.account_id}</td>
                                                <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{c.client_display_name}</td>
                                                <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{c.username}</td>
                                                <td><StateBadge state={c.status} /></td>
                                                <td className="font-mono">{c.report_count}</td>
                                                <td>
                                                    {c.years_on_file?.map(y => (
                                                        <span key={y} className="badge badge-new" style={{ marginRight: 4, fontSize: 10 }}>{y}</span>
                                                    ))}
                                                </td>
                                                <td className="text-xs text-muted">{c.created_at ? new Date(c.created_at).toLocaleDateString() : '—'}</td>
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

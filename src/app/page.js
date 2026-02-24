'use client';

import { useState, useEffect } from 'react';
import AppShell from '@/components/AppShell';
import StateBadge from '@/components/StateBadge';
import Link from 'next/link';

export default function OverviewDashboard() {
  const [reports, setReports] = useState([]);
  const [stats, setStats] = useState(null);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchResults, setBatchResults] = useState(null);

  const fetchData = async () => {
    try {
      const [reportsRes, clientsRes] = await Promise.all([
        fetch('/api/reports'),
        fetch('/api/clients'),
      ]);
      const reportsData = await reportsRes.json();
      const clientsData = await clientsRes.json();
      setReports(reportsData.reports || []);
      setStats(reportsData.stats || null);
      setClients(clientsData.clients || []);
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const runBatch = async () => {
    setBatchRunning(true);
    try {
      const res = await fetch('/api/batch', { method: 'POST' });
      if (!res.ok) throw new Error('Batch failed');
      const data = await res.json();
      setBatchResults(data);
      await fetchData();
    } catch (err) {
      console.error(err);
    }
    setBatchRunning(false);
  };

  const resetSystem = async () => {
    await fetch('/api/reset', { method: 'POST' });
    setBatchResults(null);
    setReports([]);
    setStats(null);
    setClients([]);
  };

  const fmt = (val) => {
    if (val === null || val === undefined) return '$0.00';
    const sign = val < 0 ? '-' : '';
    return `${sign}$${Math.abs(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const hasData = reports.length > 0 || clients.length > 0;
  const recentReports = reports.slice(0, 10);

  if (loading) {
    return <AppShell><div className="page-container"><div className="loading-spinner"><div className="spinner"></div> Loading...</div></div></AppShell>;
  }

  return (
    <AppShell>
      <div className="page-container">
        <div className="page-header">
          <div>
            <h1>Overview</h1>
            <p>Tax operations dashboard</p>
          </div>
          {hasData && (
            <div className="flex gap-sm">
              <button className="btn btn-secondary" onClick={resetSystem}>Reset All Data</button>
              <button className="btn btn-primary" onClick={runBatch} disabled={batchRunning}>
                {batchRunning ? 'Processing...' : 'Run Demo Batch'}
              </button>
            </div>
          )}
        </div>

        {/* ═══ EMPTY STATE ═══ */}
        {!hasData && !batchResults && (
          <div className="animate-fade-in">
            <div className="batch-hero" style={{ marginBottom: 24 }}>
              <h2>Welcome to Clearly</h2>
              <p>Get started by uploading client P&L reports or running the demo batch</p>
            </div>

            <div className="grid-2">
              <div className="card" style={{ padding: 32, textAlign: 'center' }}>
                <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.6 }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                </div>
                <h3 style={{ marginBottom: 8, fontSize: 16 }}>Upload Client Reports</h3>
                <p className="text-sm text-muted" style={{ marginBottom: 16 }}>
                  Process P&L JSON files and generate Israeli tax-cleaned reports
                </p>
                <Link href="/upload" className="btn btn-primary">Go to Upload</Link>
              </div>

              <div className="card" style={{ padding: 32, textAlign: 'center' }}>
                <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.6 }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                </div>
                <h3 style={{ marginBottom: 8, fontSize: 16 }}>Run 50-Client Demo</h3>
                <p className="text-sm text-muted" style={{ marginBottom: 16 }}>
                  Process the full demo pack through the complete pipeline
                </p>
                <button className="btn btn-primary" onClick={runBatch} disabled={batchRunning}>
                  {batchRunning ? <><div className="spinner" style={{ width: 14, height: 14 }}></div> Processing...</> : 'Run Demo'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ═══ DASHBOARD — DATA EXISTS ═══ */}
        {hasData && (
          <>
            {/* Summary Metrics */}
            <div className="metrics-grid animate-fade-in">
              <div className="metric-card">
                <div className="metric-label">Total Clients</div>
                <div className="metric-value">{clients.length}</div>
                <div className="metric-sub">registered accounts</div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Tax Reports</div>
                <div className="metric-value">{stats?.total || 0}</div>
                <div className="metric-sub">{stats?.approved || 0} approved</div>
              </div>
              <div className="metric-card warning">
                <div className="metric-label">Pending Review</div>
                <div className="metric-value">{(stats?.draft || 0) + (stats?.needs_review || 0)}</div>
                <div className="metric-sub">{stats?.draft || 0} draft, {stats?.needs_review || 0} flagged</div>
              </div>
              <div className="metric-card" style={{ background: 'var(--accent-soft)' }}>
                <div className="metric-label" style={{ color: 'var(--accent)', fontWeight: 600 }}>Total Tax Liability</div>
                <div className="metric-value" style={{ color: 'var(--accent)', fontSize: 22 }}>{fmt(stats?.total_tax_liability)}</div>
                <div className="metric-sub">across all clients</div>
              </div>
            </div>

            {/* Batch Results - if just ran */}
            {batchResults && (
              <div className="card mb-md animate-fade-in">
                <div className="flex justify-between items-center">
                  <div>
                    <span className="font-bold">Batch Complete</span>
                    <span className="text-sm text-muted" style={{ marginLeft: 12 }}>
                      {batchResults.processed} processed in {batchResults.runtime_ms}ms
                    </span>
                  </div>
                  <div className="flex gap-sm">
                    <StateBadge state="SUCCESS" />
                    <span className="text-sm font-bold">{batchResults.counts?.NEW || 0} new</span>
                    {batchResults.counts?.DUPLICATE > 0 && <span className="text-sm text-muted">{batchResults.counts.DUPLICATE} duplicates</span>}
                  </div>
                </div>
              </div>
            )}

            {/* Recent Reports */}
            {recentReports.length > 0 && (
              <div className="table-container animate-fade-in">
                <div className="table-header">
                  <h3>Recent Tax Reports</h3>
                  <Link href="/reports" className="btn btn-secondary" style={{ fontSize: 13, padding: '4px 14px' }}>View All Reports</Link>
                </div>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Report</th>
                        <th>Account</th>
                        <th>Client</th>
                        <th>Year</th>
                        <th className="number">Net P&L</th>
                        <th className="number">Tax Liability</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentReports.map(r => {
                        const pnl = r.tax_data?.annual_summary?.net_taxable_pnl;
                        const tax = r.tax_data?.annual_summary?.computed_tax_liability;
                        return (
                          <tr key={r.id} className="clickable" onClick={() => window.location.href = `/reports/${r.id}`}>
                            <td className="font-mono text-xs" style={{ color: 'var(--accent)' }}>{r.id}</td>
                            <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{r.account_id}</td>
                            <td className="font-bold">{r.client_name}</td>
                            <td>{r.year}</td>
                            <td className="number font-mono font-bold" style={{ color: pnl < 0 ? 'var(--negative)' : 'var(--positive)' }}>
                              {fmt(pnl)}
                            </td>
                            <td className="number font-mono font-bold" style={{ color: tax > 0 ? 'var(--accent)' : undefined }}>
                              {fmt(tax)}
                            </td>
                            <td><StateBadge state={r.status} /></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}

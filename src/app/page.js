'use client';

import { useState } from 'react';
import AppShell from '@/components/AppShell';
import StateBadge from '@/components/StateBadge';
import Link from 'next/link';

export default function BatchDashboard() {
  const [batchResults, setBatchResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const runBatch = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/batch', { method: 'POST' });
      if (!res.ok) throw new Error('Batch run failed');
      const data = await res.json();
      setBatchResults(data);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const resetSystem = async () => {
    await fetch('/api/reset', { method: 'POST' });
    setBatchResults(null);
    setError(null);
  };

  const excCount = batchResults?.scenario_results?.filter(
    s => ['CONFLICT', 'VALIDATION_FAILED', 'RECONCILIATION_MISMATCH', 'REVIEW_REQUIRED'].includes(s.overall_status)
  ).length || 0;

  return (
    <AppShell exceptionCount={excCount}>
      <div className="page-container">
        <div className="page-header">
          <h1>Batch Operations Dashboard</h1>
          <p>Ingest, validate, and reconcile the 50-scenario Colmex P&L demo pack</p>
        </div>

        {!batchResults && !loading && (
          <div className="batch-hero animate-fade-in">
            <h2>🚀 Run the 50-Scenario Demo Pack</h2>
            <p>Process all scenarios through the complete pipeline: ingestion → client upsert → classification → validation → reconciliation → tax-cleaned generation</p>
            <button className="btn btn-primary btn-lg" onClick={runBatch}>
              ⚡ Run Batch Processing
            </button>
          </div>
        )}

        {loading && (
          <div className="batch-hero animate-fade-in">
            <div className="loading-spinner" style={{ justifyContent: 'center', fontSize: 16 }}>
              <div className="spinner" style={{ width: 28, height: 28 }}></div>
              Processing 50 scenarios...
            </div>
          </div>
        )}

        {error && (
          <div className="notification-banner error animate-slide-in">
            ✕ {error}
          </div>
        )}

        {batchResults && (
          <>
            {/* Summary Metrics */}
            <div className="section-header">
              <h2>Processing Summary</h2>
              <div className="flex gap-sm">
                <button className="btn btn-secondary btn-sm" onClick={resetSystem}>↻ Reset & Clear</button>
                <button className="btn btn-primary btn-sm" onClick={runBatch} disabled={loading}>⚡ Re-run Batch</button>
              </div>
            </div>

            <div className="metrics-grid animate-fade-in">
              <div className="metric-card accent stagger-1 animate-fade-in-up">
                <div className="metric-label">Total Processed</div>
                <div className="metric-value">{batchResults.processed}</div>
                <div className="metric-sub">of {batchResults.total} scenarios</div>
                <div className="metric-icon">📦</div>
              </div>
              <div className="metric-card info stagger-2 animate-fade-in-up">
                <div className="metric-label">New Reports</div>
                <div className="metric-value">{batchResults.counts.NEW}</div>
                <div className="metric-sub">first-time ingestions</div>
                <div className="metric-icon">🆕</div>
              </div>
              <div className="metric-card stagger-3 animate-fade-in-up" style={{ '--accent': 'var(--duplicate)' }}>
                <div className="metric-label">Duplicates</div>
                <div className="metric-value" style={{ color: 'var(--duplicate)' }}>{batchResults.counts.DUPLICATE}</div>
                <div className="metric-sub">skipped (idempotent)</div>
                <div className="metric-icon">📋</div>
              </div>
              <div className="metric-card warning stagger-4 animate-fade-in-up">
                <div className="metric-label">Revisions</div>
                <div className="metric-value">{batchResults.counts.REVISION}</div>
                <div className="metric-sub">version updates</div>
                <div className="metric-icon">📝</div>
              </div>
              <div className="metric-card danger stagger-5 animate-fade-in-up">
                <div className="metric-label">Conflicts</div>
                <div className="metric-value">{batchResults.counts.CONFLICT}</div>
                <div className="metric-sub">require review</div>
                <div className="metric-icon">⚠️</div>
              </div>
              <div className="metric-card purple stagger-6 animate-fade-in-up">
                <div className="metric-label">Tax-Cleaned</div>
                <div className="metric-value">{batchResults.tax_cleaned.GENERATED}</div>
                <div className="metric-sub">reports generated</div>
                <div className="metric-icon">✦</div>
              </div>
            </div>

            {/* Pass Rate Bars */}
            <div className="grid-3 mb-lg animate-fade-in">
              <div className="card">
                <div className="flex justify-between items-center mb-sm">
                  <span className="text-sm font-bold">Validation Pass Rate</span>
                  <span className="text-sm" style={{ color: 'var(--success)' }}>
                    {batchResults.processed > 0 ? Math.round((batchResults.validation.VALIDATED / (batchResults.processed - batchResults.validation.SKIPPED)) * 100) || 0 : 0}%
                  </span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill success" style={{ width: `${batchResults.processed > 0 ? ((batchResults.validation.VALIDATED / (batchResults.processed - batchResults.validation.SKIPPED)) * 100) || 0 : 0}%` }}></div>
                </div>
                <div className="text-xs text-muted mt-sm">
                  {batchResults.validation.VALIDATED} validated • {batchResults.validation.FAILED} failed • {batchResults.validation.REVIEW_REQUIRED} review
                </div>
              </div>

              <div className="card">
                <div className="flex justify-between items-center mb-sm">
                  <span className="text-sm font-bold">Reconciliation Pass Rate</span>
                  <span className="text-sm" style={{ color: 'var(--success)' }}>
                    {batchResults.processed > 0 ? Math.round((batchResults.reconciliation.RECONCILED / (batchResults.processed - batchResults.reconciliation.SKIPPED)) * 100) || 0 : 0}%
                  </span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill success" style={{ width: `${batchResults.processed > 0 ? ((batchResults.reconciliation.RECONCILED / (batchResults.processed - batchResults.reconciliation.SKIPPED)) * 100) || 0 : 0}%` }}></div>
                </div>
                <div className="text-xs text-muted mt-sm">
                  {batchResults.reconciliation.RECONCILED} reconciled • {batchResults.reconciliation.MISMATCH} mismatch • {batchResults.reconciliation.PARTIAL} partial
                </div>
              </div>

              <div className="card">
                <div className="flex justify-between items-center mb-sm">
                  <span className="text-sm font-bold">Runtime</span>
                  <span className="text-sm font-mono" style={{ color: 'var(--accent)' }}>{batchResults.runtime_ms}ms</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill success" style={{ width: '100%' }}></div>
                </div>
                <div className="text-xs text-muted mt-sm">
                  Avg {Math.round(batchResults.runtime_ms / batchResults.processed)}ms per scenario
                </div>
              </div>
            </div>

            {/* Group Breakdown */}
            <div className="section-header">
              <h2>Scenario Group Breakdown</h2>
            </div>
            <div className="grid-5 mb-lg animate-fade-in" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
              {Object.entries(batchResults.groups).map(([group, data]) => (
                <div className="card" key={group} style={{ padding: 16 }}>
                  <div className="text-xs text-muted mb-sm" style={{ fontWeight: 600 }}>{group.replace(/_/g, ' ').toUpperCase()}</div>
                  <div className="flex justify-between items-center">
                    <span className="font-bold" style={{ fontSize: 20 }}>{data.total}</span>
                    <div className="flex gap-sm">
                      <span className="text-xs" style={{ color: 'var(--success)' }}>✓{data.success}</span>
                      {data.failed > 0 && <span className="text-xs" style={{ color: 'var(--error)' }}>✕{data.failed}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Per-Scenario Drill-Down Table */}
            <div className="section-header">
              <h2>Per-Scenario Results</h2>
              <span className="text-xs text-muted">{batchResults.scenario_results.length} scenarios</span>
            </div>
            <div className="table-container animate-fade-in">
              <div className="table-scroll" style={{ maxHeight: 600 }}>
                <table>
                  <thead>
                    <tr>
                      <th>Scenario</th>
                      <th>Title</th>
                      <th>Group</th>
                      <th>Account</th>
                      <th>Client Action</th>
                      <th>Report State</th>
                      <th>Validation</th>
                      <th>Reconciliation</th>
                      <th>Tax-Cleaned</th>
                      <th>Overall</th>
                      <th className="number">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batchResults.scenario_results.map(s => (
                      <tr key={s.id} className={s.account_id ? 'clickable' : ''} onClick={() => s.account_id && window.open(`/clients/${s.account_id}`, '_self')}>
                        <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{s.id}</td>
                        <td style={{ maxWidth: 260 }} className="truncate">{s.title}</td>
                        <td><span className="text-xs text-muted">{s.group?.split('_').slice(1).join(' ')}</span></td>
                        <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{s.account_id}</td>
                        <td><StateBadge state={s.client_action} /></td>
                        <td><StateBadge state={s.report_state} /></td>
                        <td><StateBadge state={s.validation_status} /></td>
                        <td><StateBadge state={s.reconciliation_status} /></td>
                        <td><StateBadge state={s.tax_cleaned_status} /></td>
                        <td><StateBadge state={s.overall_status} /></td>
                        <td className="number font-mono text-xs">{s.processing_time_ms}ms</td>
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

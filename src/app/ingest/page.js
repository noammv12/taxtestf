'use client';

import { useState } from 'react';
import AppShell from '@/components/AppShell';
import StateBadge from '@/components/StateBadge';
import Link from 'next/link';

const SAMPLE_PAYLOAD = `{
  "source_report_type": "colmex_pnl_report",
  "template_version": "colmex_pnl_report_v1",
  "ingestion_mode": "mock_pdf_structured",
  "pdf_layout_reference": {
    "title": "ColmexPro - Profit & Loss Report"
  },
  "report_header": {
    "account_id": "COLH99999",
    "year": 2025,
    "client_display_name": "Demo User",
    "username": "DEMO_USER",
    "report_period_start": "01.01.2025",
    "report_period_end": "31.12.2025",
    "source_file_name": "manual_input.pdf"
  },
  "summary_totals": {
    "opening_balance": 10000.00,
    "total_deposit_withdrawal": 5000.00,
    "total_credit_debit": -200.00,
    "profit_loss": 3500.00,
    "closing_balance_equity": 18300.00
  },
  "monthly_rows": [
    {
      "month": 1,
      "trade_date": "2025-January",
      "total_comm": 120.50,
      "sec_fee": 0.00,
      "nasd_fee": 0.00,
      "ecn_take": 0.00,
      "ecn_add": 0.00,
      "routing_fee": 0.00,
      "nscc_fee": 0.00,
      "net_pnl": 2000.00,
      "net_cash": 1500.00
    },
    {
      "month": 6,
      "trade_date": "2025-June",
      "total_comm": 95.30,
      "sec_fee": 2.50,
      "nasd_fee": 0.00,
      "ecn_take": 0.00,
      "ecn_add": 1.20,
      "routing_fee": 0.00,
      "nscc_fee": 0.00,
      "net_pnl": 1500.00,
      "net_cash": 1200.00
    }
  ],
  "grand_totals_row": {
    "total_comm": 215.80,
    "sec_fee": 2.50,
    "nasd_fee": 0.00,
    "ecn_take": 0.00,
    "ecn_add": 1.20,
    "routing_fee": 0.00,
    "nscc_fee": 0.00,
    "net_pnl": 3500.00,
    "net_cash": 2700.00,
    "label": "Grand totals"
  },
  "footnotes": [],
  "disclaimer_present": true,
  "metadata": {
    "currency": "USD",
    "generated_for_demo": true,
    "notes": []
  }
}`;

export default function IngestPage() {
    const [jsonInput, setJsonInput] = useState(SAMPLE_PAYLOAD);
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleIngest = async () => {
        setLoading(true);
        setError(null);
        setResult(null);
        try {
            const payload = JSON.parse(jsonInput);
            const res = await fetch('/api/ingest', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (!res.ok) throw new Error('Ingestion failed');
            const data = await res.json();
            setResult(data);
        } catch (err) {
            setError(err.message);
        }
        setLoading(false);
    };

    return (
        <AppShell>
            <div className="page-container">
                <div className="page-header">
                    <h1>Ingest Report</h1>
                    <p>Submit a single P&L report payload for processing</p>
                </div>

                <div className="grid-2" style={{ gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                    {/* Input Panel */}
                    <div>
                        <div className="section-header">
                            <h3 style={{ fontSize: 14 }}>Report Payload (JSON)</h3>
                            <button className="btn btn-secondary btn-sm" onClick={() => setJsonInput(SAMPLE_PAYLOAD)}>
                                Load Sample
                            </button>
                        </div>
                        <textarea
                            value={jsonInput}
                            onChange={e => setJsonInput(e.target.value)}
                            rows={28}
                            spellCheck={false}
                            style={{ width: '100%' }}
                        />
                        <div style={{ marginTop: 12 }}>
                            <button className="btn btn-primary" onClick={handleIngest} disabled={loading}>
                                {loading ? <><div className="spinner" style={{ width: 14, height: 14 }}></div> Processing...</> : 'Ingest Report'}
                            </button>
                        </div>
                    </div>

                    {/* Result Panel */}
                    <div>
                        <div className="section-header">
                            <h3 style={{ fontSize: 14 }}>Processing Result</h3>
                        </div>

                        {error && (
                            <div className="notification-banner error">{error}</div>
                        )}

                        {!result && !error && (
                            <div className="card" style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
                                <div style={{ marginBottom: 16 }}>
                                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                                </div>
                                <div>Paste a Colmex P&L report payload and click Ingest</div>
                            </div>
                        )}

                        {result && (
                            <div className="animate-fade-in">
                                {/* Overall Status */}
                                <div className="card mb-md" style={{ padding: 16 }}>
                                    <div className="flex justify-between items-center">
                                        <span className="font-bold">Overall Status</span>
                                        <StateBadge state={result.overall_status} />
                                    </div>
                                    <div className="text-xs text-muted mt-sm">
                                        {result.account_id} • Year {result.year} • {result.processing_time_ms}ms
                                    </div>
                                </div>

                                {/* Pipeline Steps */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {/* Client Resolution */}
                                    <div className="card" style={{ padding: 14, marginBottom: 0 }}>
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm font-bold">Client Resolution</span>
                                            <StateBadge state={result.steps?.client_resolution?.action} />
                                        </div>
                                    </div>

                                    {/* Report Classification */}
                                    <div className="card" style={{ padding: 14, marginBottom: 0 }}>
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm font-bold">Report Classification</span>
                                            <StateBadge state={result.steps?.report_classification?.state} />
                                        </div>
                                        <div className="text-xs text-muted mt-sm font-mono">Hash: {result.steps?.report_classification?.payloadHash?.substring(0, 12)}...</div>
                                    </div>

                                    {/* Validation */}
                                    <div className="card" style={{ padding: 14, marginBottom: 0 }}>
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm font-bold">Validation</span>
                                            <StateBadge state={result.steps?.validation?.status} />
                                        </div>
                                        {result.steps?.validation?.exceptions?.length > 0 && (
                                            <div className="text-xs mt-sm" style={{ color: 'var(--state-error)' }}>
                                                {result.steps.validation.exceptions.length} exception(s)
                                            </div>
                                        )}
                                    </div>

                                    {/* Reconciliation */}
                                    <div className="card" style={{ padding: 14, marginBottom: 0 }}>
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm font-bold">Reconciliation</span>
                                            <StateBadge state={result.steps?.reconciliation?.status} />
                                        </div>
                                    </div>

                                    {/* Tax-Cleaned */}
                                    <div className="card" style={{ padding: 14, marginBottom: 0 }}>
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm font-bold">Tax-Cleaned</span>
                                            <StateBadge state={result.steps?.tax_cleaned?.status} />
                                        </div>
                                    </div>

                                    {/* Storage */}
                                    <div className="card" style={{ padding: 14, marginBottom: 0 }}>
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm font-bold">Stored</span>
                                            <span className="text-sm font-bold" style={{ color: result.steps?.storage?.stored ? 'var(--state-success)' : 'var(--state-duplicate)' }}>
                                                {result.steps?.storage?.stored ? 'Yes' : 'No'}
                                            </span>
                                        </div>
                                        {result.steps?.storage?.reportId && (
                                            <div className="text-xs text-muted mt-sm font-mono">{result.steps.storage.reportId} (v{result.steps.storage.version})</div>
                                        )}
                                    </div>
                                </div>

                                {/* Link to Client 360 */}
                                {result.account_id && (
                                    <div style={{ marginTop: 16 }}>
                                        <Link href={`/clients/${result.account_id}`} className="btn btn-primary" style={{ width: '100%' }}>
                                            View Client 360 →
                                        </Link>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </AppShell>
    );
}

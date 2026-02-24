'use client';
import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/AppShell';
import StateBadge from '@/components/StateBadge';

export default function UploadPage() {
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState(null);
    const [error, setError] = useState(null);
    const [directoryPath, setDirectoryPath] = useState('/Users/ilaynsany/Documents/colmex_pnl_json_clients_50');
    const [uploadMode, setUploadMode] = useState('directory');
    const fileInputRef = useRef(null);
    const router = useRouter();

    const handleFileSelect = (e) => {
        const selected = Array.from(e.target.files).filter(f => f.name.endsWith('.json'));
        setFiles(selected);
        setError(null);
        setResults(null);
    };

    const handleProcess = async () => {
        setLoading(true);
        setError(null);
        setResults(null);

        try {
            let body;
            if (uploadMode === 'directory') {
                if (!directoryPath.trim()) { setError('Please enter a directory path'); setLoading(false); return; }
                body = { directory_path: directoryPath.trim() };
            } else {
                if (files.length === 0) { setError('Please select JSON files to upload'); setLoading(false); return; }
                const payloads = [];
                for (const file of files) {
                    const text = await file.text();
                    try {
                        const payload = JSON.parse(text);
                        payloads.push({ fileName: file.name, payload });
                    } catch { payloads.push({ fileName: file.name, payload: null, error: 'Invalid JSON' }); }
                }
                body = { payloads };
            }

            const res = await fetch('/api/upload', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Upload failed');
            setResults(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const successCount = results?.file_results?.filter(r => r.overall_status === 'SUCCESS' || r.overall_status === 'DUPLICATE_SKIPPED').length || 0;

    return (
        <AppShell>
            <div className="page-container">
                <div className="page-header">
                    <div>
                        <h1>Upload Client Reports</h1>
                        <p>Process Colmex Pro P&L JSON reports and generate Israeli tax-cleaned outputs</p>
                    </div>
                </div>

                {/* Upload Mode */}
                <div className="card">
                    <div className="filter-bar">
                        <button className={`filter-chip ${uploadMode === 'directory' ? 'active' : ''}`} onClick={() => setUploadMode('directory')}>
                            Server Directory
                        </button>
                        <button className={`filter-chip ${uploadMode === 'files' ? 'active' : ''}`} onClick={() => setUploadMode('files')}>
                            Upload Files
                        </button>
                    </div>

                    {uploadMode === 'directory' ? (
                        <div>
                            <label className="text-sm text-muted" style={{ display: 'block', marginBottom: 8 }}>
                                Directory path containing client JSON files
                            </label>
                            <div className="flex gap-md items-center">
                                <input
                                    type="text"
                                    value={directoryPath}
                                    onChange={(e) => setDirectoryPath(e.target.value)}
                                    placeholder="/path/to/json/files"
                                    style={{ flex: 1, fontFamily: 'monospace' }}
                                />
                                <button className="btn btn-primary" onClick={handleProcess} disabled={loading}>
                                    {loading ? <><div className="spinner" style={{ width: 14, height: 14 }}></div> Processing...</> : 'Process All Files'}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div>
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className="batch-hero"
                                style={{ cursor: 'pointer', padding: '32px 24px', marginBottom: 0 }}
                            >
                                <p style={{ marginBottom: 0 }}>
                                    {files.length > 0
                                        ? `${files.length} JSON file${files.length > 1 ? 's' : ''} selected`
                                        : 'Click to select JSON files or drag and drop'}
                                </p>
                            </div>
                            <input ref={fileInputRef} type="file" multiple accept=".json" onChange={handleFileSelect} style={{ display: 'none' }} />
                            {files.length > 0 && (
                                <div className="flex justify-between items-center mt-md">
                                    <span className="text-sm text-muted">{files.length} file{files.length > 1 ? 's' : ''} ready</span>
                                    <button className="btn btn-primary" onClick={handleProcess} disabled={loading}>
                                        {loading ? <><div className="spinner" style={{ width: 14, height: 14 }}></div> Processing...</> : `Process ${files.length} Files`}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Error */}
                {error && (
                    <div className="notification-banner error">{error}</div>
                )}

                {/* Results */}
                {results && (
                    <>
                        <div className="metrics-grid">
                            <div className="metric-card">
                                <div className="metric-label">Files Processed</div>
                                <div className="metric-value">{results.processed}</div>
                                <div className="metric-sub">of {results.total_files} files</div>
                            </div>
                            <div className="metric-card">
                                <div className="metric-label">Clients Found</div>
                                <div className="metric-value">{results.clients_found}</div>
                                <div className="metric-sub">unique accounts</div>
                            </div>
                            <div className="metric-card">
                                <div className="metric-label">Tax Reports</div>
                                <div className="metric-value">{results.reports_generated}</div>
                                <div className="metric-sub">generated</div>
                            </div>
                            <div className="metric-card">
                                <div className="metric-label">Runtime</div>
                                <div className="metric-value">{results.runtime_ms}<span style={{ fontSize: 14, fontWeight: 400 }}>ms</span></div>
                                <div className="metric-sub">processing time</div>
                            </div>
                        </div>

                        <div className="card mb-md">
                            <div className="flex justify-between items-center">
                                <span>
                                    <StateBadge state="SUCCESS" /> <span className="font-bold">{successCount} successful</span>
                                    {results.failed > 0 && <> · <StateBadge state="ERROR" /> <span className="font-bold">{results.failed} failed</span></>}
                                </span>
                                <button className="btn btn-primary" onClick={() => router.push('/reports')}>View Tax Reports →</button>
                            </div>
                        </div>

                        <div className="table-container animate-fade-in">
                            <div className="table-header">
                                <h3>Processing Results</h3>
                            </div>
                            <div className="table-scroll">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>File</th>
                                            <th>Account</th>
                                            <th>Client</th>
                                            <th>Year</th>
                                            <th>Status</th>
                                            <th>Tax Report</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {results.file_results.map((r, i) => (
                                            <tr key={i}>
                                                <td className="font-mono text-xs">{r.file_name}</td>
                                                <td style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--accent)' }}>{r.account_id || '—'}</td>
                                                <td className="font-bold">{r.client_name || '—'}</td>
                                                <td>{r.year || '—'}</td>
                                                <td><StateBadge state={r.overall_status} /></td>
                                                <td>
                                                    {r.tax_report_id ? (
                                                        <a href={`/reports/${r.tax_report_id}`} className="font-mono text-xs" style={{ color: 'var(--accent)' }}>
                                                            {r.tax_report_id}
                                                        </a>
                                                    ) : '—'}
                                                </td>
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

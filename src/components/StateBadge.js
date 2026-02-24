'use client';

export default function StateBadge({ state, size = 'normal' }) {
    const stateMap = {
        'NEW': { className: 'badge-new', label: 'NEW', icon: '●' },
        'DUPLICATE': { className: 'badge-duplicate', label: 'DUPLICATE', icon: '●' },
        'REVISION': { className: 'badge-revision', label: 'REVISION', icon: '●' },
        'CONFLICT': { className: 'badge-conflict', label: 'CONFLICT', icon: '●' },
        'VALIDATED': { className: 'badge-validated', label: 'VALIDATED', icon: '✓' },
        'RECONCILED': { className: 'badge-reconciled', label: 'RECONCILED', icon: '✓' },
        'FAILED': { className: 'badge-failed', label: 'FAILED', icon: '✕' },
        'REVIEW_REQUIRED': { className: 'badge-review', label: 'REVIEW', icon: '!' },
        'MISMATCH': { className: 'badge-mismatch', label: 'MISMATCH', icon: '≠' },
        'PARTIAL': { className: 'badge-partial', label: 'PARTIAL', icon: '~' },
        'BLOCKED': { className: 'badge-blocked', label: 'BLOCKED', icon: '⊘' },
        'GENERATED': { className: 'badge-generated', label: 'GENERATED', icon: '✦' },
        'TAX-CLEANED': { className: 'badge-tax-cleaned', label: 'TAX-CLEANED', icon: '✦' },
        'NON-OFFICIAL': { className: 'badge-non-official', label: 'NON-OFFICIAL', icon: '!' },
        'COLMEX_PNL_SOURCE': { className: 'badge-new', label: 'COLMEX P&L', icon: '◆' },
        'SUCCESS': { className: 'badge-success', label: 'SUCCESS', icon: '✓' },
        'ERROR': { className: 'badge-error', label: 'ERROR', icon: '✕' },
        'SKIPPED': { className: 'badge-skipped', label: 'SKIPPED', icon: '–' },
        'DUPLICATE_SKIPPED': { className: 'badge-duplicate', label: 'DUP SKIP', icon: '–' },
        'VALIDATION_FAILED': { className: 'badge-failed', label: 'VAL FAIL', icon: '✕' },
        'RECONCILIATION_MISMATCH': { className: 'badge-mismatch', label: 'RECON FAIL', icon: '≠' },
        'CREATE_CLIENT': { className: 'badge-new', label: 'CREATE', icon: '+' },
        'UPDATE_CLIENT': { className: 'badge-validated', label: 'UPDATE', icon: '↻' },
        'MANUAL_REVIEW_REQUIRED': { className: 'badge-review', label: 'REVIEW', icon: '!' },
        'NOOP_RETAIN_EXISTING': { className: 'badge-duplicate', label: 'NO CHANGE', icon: '–' },
        'OPEN': { className: 'badge-conflict', label: 'OPEN', icon: '●' },
        'RESOLVED': { className: 'badge-validated', label: 'RESOLVED', icon: '✓' },
        'ACTIVE': { className: 'badge-success', label: 'ACTIVE', icon: '●' },
        'RECONCILIATION_WARNING': { className: 'badge-mismatch', label: 'RECON WARN', icon: '!' },
    };

    const config = stateMap[state] || { className: 'badge-duplicate', label: state || '—', icon: '?' };

    return (
        <span className={`badge ${config.className}`} title={state}>
            <span className="badge-dot" aria-hidden></span>
            {config.label}
        </span>
    );
}

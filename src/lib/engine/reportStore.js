// Report Store with natural key deduplication and versioning
// In-memory store — persists during server runtime

import crypto from 'crypto';

const reports = new Map(); // naturalKeyHash -> array of versions
const reportIndex = []; // flat list of all report records for listing

function computeNaturalKey(header) {
    return [
        header.account_id,
        header.year,
        header.report_period_start,
        header.report_period_end,
        'colmex_pnl_report',
    ].join('|');
}

function computePayloadHash(payload) {
    // Deterministic hash of the payload content (excluding metadata that changes)
    const hashInput = JSON.stringify({
        report_header: payload.report_header,
        summary_totals: payload.summary_totals,
        monthly_rows: payload.monthly_rows,
        grand_totals_row: payload.grand_totals_row,
    });
    return crypto.createHash('sha256').update(hashInput).digest('hex').substring(0, 16);
}

export function classifyReport(payload) {
    const header = payload.report_header;
    const naturalKey = computeNaturalKey(header);
    const payloadHash = computePayloadHash(payload);
    const existing = reports.get(naturalKey);

    const naturalKeyObj = {
        account_id: header.account_id,
        year: header.year,
        report_period_start: header.report_period_start,
        report_period_end: header.report_period_end,
        source_report_type: 'colmex_pnl_report',
    };

    if (!existing || existing.length === 0) {
        return {
            state: 'NEW',
            naturalKey: naturalKeyObj,
            naturalKeyHash: naturalKey,
            payloadHash,
            priorVersions: [],
        };
    }

    const activeVersion = existing.find(v => v.is_active);

    // Same payload hash = DUPLICATE
    if (activeVersion && activeVersion.payloadHash === payloadHash) {
        return {
            state: 'DUPLICATE',
            naturalKey: naturalKeyObj,
            naturalKeyHash: naturalKey,
            payloadHash,
            priorVersions: existing.map(v => v.id),
            duplicateOfVersion: activeVersion.id,
        };
    }

    // Different payload hash = REVISION (if header is consistent)
    // Check for header consistency conflicts
    if (activeVersion) {
        const headerConflict = checkHeaderConflict(activeVersion.header, header);
        if (headerConflict) {
            return {
                state: 'CONFLICT',
                naturalKey: naturalKeyObj,
                naturalKeyHash: naturalKey,
                payloadHash,
                priorVersions: existing.map(v => v.id),
                conflictReason: headerConflict,
            };
        }
    }

    return {
        state: 'REVISION',
        naturalKey: naturalKeyObj,
        naturalKeyHash: naturalKey,
        payloadHash,
        priorVersions: existing.map(v => v.id),
        activeVersionId: activeVersion?.id,
    };
}

function checkHeaderConflict(existingHeader, incomingHeader) {
    // Check for period/year inconsistencies that indicate a conflict
    if (existingHeader.year !== incomingHeader.year) {
        return 'YEAR_MISMATCH';
    }
    return null;
}

export function storeReport(payload, classification, validationResult, reconciliationResult, taxCleanedResult, scenarioId) {
    const header = payload.report_header;
    const naturalKey = classification.naturalKeyHash;

    if (classification.state === 'DUPLICATE') {
        // Don't store duplicates — just log
        return { stored: false, reason: 'duplicate' };
    }

    const versionId = `RPT-${header.account_id}-${header.year}-v${(reports.get(naturalKey)?.length || 0) + 1}`;

    const record = {
        id: versionId,
        scenarioId: scenarioId || null,
        naturalKey: classification.naturalKey,
        naturalKeyHash: naturalKey,
        payloadHash: classification.payloadHash,
        state: classification.state,
        is_active: true,
        version: (reports.get(naturalKey)?.length || 0) + 1,
        header: { ...header },
        summaryTotals: { ...payload.summary_totals },
        monthlyRows: [...(payload.monthly_rows || [])],
        grandTotals: payload.grand_totals_row ? { ...payload.grand_totals_row } : null,
        rawPayload: payload,
        validationResult,
        reconciliationResult,
        taxCleanedResult,
        stored_at: new Date().toISOString(),
    };

    // If REVISION — archive prior active version
    if (classification.state === 'REVISION') {
        const existing = reports.get(naturalKey) || [];
        existing.forEach(v => {
            v.is_active = false;
            v.archived_at = new Date().toISOString();
            v.archived_reason = `Superseded by ${versionId}`;
        });
    }

    if (!reports.has(naturalKey)) {
        reports.set(naturalKey, []);
    }
    reports.get(naturalKey).push(record);
    reportIndex.push(record);

    return { stored: true, record };
}

export function getReportsForClient(accountId) {
    return reportIndex.filter(r => r.header.account_id === accountId);
}

export function getAllReports() {
    return [...reportIndex];
}

export function getReportById(reportId) {
    return reportIndex.find(r => r.id === reportId) || null;
}

export function getActiveReportsForClient(accountId) {
    return reportIndex.filter(r => r.header.account_id === accountId && r.is_active);
}

export function resetReports() {
    reports.clear();
    reportIndex.length = 0;
}

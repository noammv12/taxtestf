// Tax Report Store — in-memory persistence for generated tax reports
// Supports DRAFT → APPROVED / REJECTED workflow

const taxReports = new Map();
let reportIdCounter = 1;

export function storeTaxReport({ account_id, year, client_name, tax_data, source_files }) {
    const key = `${account_id}_${year}`;
    const existing = taxReports.get(key);

    const report = {
        id: existing ? existing.id : `TR-${String(reportIdCounter++).padStart(4, '0')}`,
        account_id,
        year,
        client_name,
        status: 'DRAFT',
        tax_data,
        source_files: source_files || [],
        generated_at: new Date().toISOString(),
        approved_by: null,
        approved_at: null,
        rejected_by: null,
        rejected_at: null,
        review_notes: null,
        version: existing ? existing.version + 1 : 1,
    };

    taxReports.set(key, report);
    return report;
}

export function getTaxReport(id) {
    for (const report of taxReports.values()) {
        if (report.id === id) return report;
    }
    return null;
}

export function getTaxReportByKey(account_id, year) {
    return taxReports.get(`${account_id}_${year}`) || null;
}

export function getAllTaxReports(filters = {}) {
    let reports = Array.from(taxReports.values());

    if (filters.status) {
        reports = reports.filter(r => r.status === filters.status);
    }
    if (filters.year) {
        reports = reports.filter(r => r.year === Number(filters.year));
    }

    // Sort by account_id then year
    reports.sort((a, b) => {
        if (a.account_id !== b.account_id) return a.account_id.localeCompare(b.account_id);
        return a.year - b.year;
    });

    return reports;
}

export function approveTaxReport(id, { approved_by, notes }) {
    const report = getTaxReport(id);
    if (!report) return { success: false, error: 'Report not found' };

    report.status = 'APPROVED';
    report.approved_by = approved_by || 'ops_user';
    report.approved_at = new Date().toISOString();
    report.review_notes = notes || null;
    report.rejected_by = null;
    report.rejected_at = null;

    return { success: true, report };
}

export function rejectTaxReport(id, { rejected_by, notes }) {
    const report = getTaxReport(id);
    if (!report) return { success: false, error: 'Report not found' };

    report.status = 'REJECTED';
    report.rejected_by = rejected_by || 'ops_user';
    report.rejected_at = new Date().toISOString();
    report.review_notes = notes || null;
    report.approved_by = null;
    report.approved_at = null;

    return { success: true, report };
}

export function flagTaxReport(id, { notes }) {
    const report = getTaxReport(id);
    if (!report) return { success: false, error: 'Report not found' };

    report.status = 'NEEDS_REVIEW';
    report.review_notes = notes || 'Flagged for review';

    return { success: true, report };
}

export function getTaxReportSummaryStats() {
    const reports = Array.from(taxReports.values());
    return {
        total: reports.length,
        draft: reports.filter(r => r.status === 'DRAFT').length,
        approved: reports.filter(r => r.status === 'APPROVED').length,
        rejected: reports.filter(r => r.status === 'REJECTED').length,
        needs_review: reports.filter(r => r.status === 'NEEDS_REVIEW').length,
        total_tax_liability: reports.reduce((sum, r) => sum + (r.tax_data?.annual_summary?.computed_tax_liability || 0), 0),
        total_clients: new Set(reports.map(r => r.account_id)).size,
    };
}

export function resetTaxReports() {
    taxReports.clear();
    reportIdCounter = 1;
}

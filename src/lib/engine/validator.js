// Structural + numeric validation engine for Colmex P&L reports

const REQUIRED_HEADER_FIELDS = [
    'account_id', 'year', 'client_display_name', 'username',
    'report_period_start', 'report_period_end',
];

const REQUIRED_SUMMARY_FIELDS = [
    'opening_balance', 'total_deposit_withdrawal', 'total_credit_debit',
    'profit_loss', 'closing_balance_equity',
];

const MONTHLY_NUMERIC_FIELDS = [
    'total_comm', 'sec_fee', 'nasd_fee', 'ecn_take', 'ecn_add',
    'routing_fee', 'nscc_fee', 'net_pnl', 'net_cash',
];

const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];

export function validateReport(payload) {
    const checks = {
        required_fields_present: true,
        numeric_parse: true,
        header_period_present: true,
        table_headers_match_template: true,
    };
    const warnings = [];
    const exceptions = [];
    let status = 'VALIDATED';

    // 1. Required header fields
    const header = payload.report_header;
    if (!header) {
        checks.required_fields_present = false;
        exceptions.push({ type: 'MISSING_REPORT_HEADER', detail: 'report_header is missing' });
    } else {
        for (const field of REQUIRED_HEADER_FIELDS) {
            if (header[field] === undefined || header[field] === null || header[field] === '') {
                checks.required_fields_present = false;
                exceptions.push({ type: 'MISSING_HEADER_FIELD', detail: `Missing required header field: ${field}` });
            }
        }
    }

    // 2. Summary totals fields
    const summary = payload.summary_totals;
    if (!summary) {
        checks.required_fields_present = false;
        exceptions.push({ type: 'MISSING_SUMMARY_TOTALS', detail: 'summary_totals is missing' });
    } else {
        for (const field of REQUIRED_SUMMARY_FIELDS) {
            if (summary[field] === undefined || summary[field] === null) {
                checks.required_fields_present = false;
                exceptions.push({ type: 'MISSING_SUMMARY_FIELD', detail: `Missing required summary field: ${field}` });
            }
            if (typeof summary[field] !== 'number') {
                checks.numeric_parse = false;
                exceptions.push({ type: 'NUMERIC_PARSE_ERROR_SUMMARY', detail: `Non-numeric summary field: ${field} = ${summary[field]}` });
            }
        }
    }

    // 3. Monthly rows existence
    const rows = payload.monthly_rows;
    if (!rows || !Array.isArray(rows)) {
        checks.table_headers_match_template = false;
        exceptions.push({ type: 'MISSING_MONTHLY_ROWS', detail: 'monthly_rows is missing or not an array' });
    } else {
        // Validate each monthly row
        for (const row of rows) {
            for (const field of MONTHLY_NUMERIC_FIELDS) {
                const val = row[field];
                if (val !== undefined && val !== null && typeof val !== 'number') {
                    checks.numeric_parse = false;
                    const fieldUpper = field.toUpperCase();
                    exceptions.push({
                        type: `NUMERIC_PARSE_ERROR_${fieldUpper}`,
                        detail: `Non-numeric value in monthly row ${row.month}: ${field} = "${val}"`,
                        month: row.month,
                        field,
                        value: val,
                    });
                }
            }

            // Validate trade_date consistency with header year
            if (header && row.trade_date) {
                const yearStr = String(header.year);
                if (!row.trade_date.startsWith(yearStr)) {
                    checks.header_period_present = false;
                    warnings.push(`Monthly trade_date "${row.trade_date}" year does not match header year ${header.year}`);
                    exceptions.push({
                        type: 'HEADER_YEAR_MONTH_MISMATCH',
                        detail: `trade_date "${row.trade_date}" inconsistent with header year ${header.year}`,
                        month: row.month,
                    });
                }
            }
        }
    }

    // 4. Grand totals row existence
    const grandTotals = payload.grand_totals_row;
    if (!grandTotals) {
        checks.table_headers_match_template = false;
        exceptions.push({ type: 'MISSING_GRAND_TOTALS', detail: 'grand_totals_row is missing' });
    } else {
        // Validate grand totals numeric fields
        for (const field of MONTHLY_NUMERIC_FIELDS) {
            const val = grandTotals[field];
            if (val !== undefined && val !== null && typeof val !== 'number') {
                checks.numeric_parse = false;
                exceptions.push({
                    type: `NUMERIC_PARSE_ERROR_GRAND_${field.toUpperCase()}`,
                    detail: `Non-numeric grand total field: ${field} = "${val}"`,
                });
            }
        }
    }

    // 5. Period/year consistency
    if (header) {
        const periodStart = header.report_period_start;
        const periodEnd = header.report_period_end;
        if (periodStart && periodEnd) {
            const startYear = periodStart.split('.')[2];
            const endYear = periodEnd.split('.')[2];
            if (startYear && String(header.year) !== startYear) {
                warnings.push(`Period start year ${startYear} does not match header year ${header.year}`);
                exceptions.push({
                    type: 'PERIOD_YEAR_MISMATCH',
                    detail: `report_period_start year ${startYear} != header year ${header.year}`,
                });
            }
        }
    }

    // 6. Low confidence flag check
    if (payload.metadata?.confidence === 'low' || payload.metadata?.low_confidence === true) {
        warnings.push('Low confidence structured payload — manual review recommended');
        exceptions.push({
            type: 'LOW_CONFIDENCE_PAYLOAD',
            detail: 'Payload flagged as low confidence',
        });
        status = 'REVIEW_REQUIRED';
    }

    // Determine overall status
    if (exceptions.some(e => e.type.includes('NUMERIC_PARSE_ERROR'))) {
        status = 'FAILED';
    } else if (exceptions.some(e => e.type === 'MISSING_GRAND_TOTALS' || e.type === 'MISSING_REPORT_HEADER')) {
        status = 'FAILED';
    } else if (exceptions.some(e => e.type.includes('MISMATCH') || e.type.includes('CONFLICT'))) {
        status = 'REVIEW_REQUIRED';
    } else if (warnings.length > 0) {
        status = status === 'VALIDATED' ? 'REVIEW_REQUIRED' : status;
    }

    return { status, checks, warnings, exceptions };
}

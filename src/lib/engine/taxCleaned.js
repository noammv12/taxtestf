// Tax-Cleaned derived output generator (summary-based MVP)
// Not full transaction-level tax withholding — cleaned/derived client reporting layer

const TAX_RESERVE_RATE = 0.25; // 25% estimated tax reserve on positive P&L

function safeNum(val) {
    return typeof val === 'number' ? val : 0;
}

export function generateTaxCleaned(payload, validationResult, reconciliationResult, reportState) {
    // Block tax-cleaned generation for certain conditions
    if (reportState === 'CONFLICT') {
        return {
            status: 'BLOCKED',
            reason: 'Report state is CONFLICT — cannot generate tax-cleaned outputs',
            derived_fields: null,
        };
    }

    if (validationResult.status === 'FAILED') {
        return {
            status: 'BLOCKED',
            reason: 'Validation failed — cannot generate tax-cleaned outputs',
            derived_fields: null,
        };
    }

    if (reportState === 'DUPLICATE') {
        return {
            status: 'SKIPPED',
            reason: 'Duplicate report — tax-cleaned already exists for this version',
            derived_fields: null,
        };
    }

    const header = payload.report_header;
    const grandTotals = payload.grand_totals_row;
    const monthlyRows = payload.monthly_rows || [];

    // Compute derived outputs
    const annualPnl = safeNum(grandTotals?.net_pnl);
    const annualNetCash = safeNum(grandTotals?.net_cash);

    // Total fee burden
    const feeTotal = [
        safeNum(grandTotals?.total_comm),
        safeNum(grandTotals?.sec_fee),
        safeNum(grandTotals?.nasd_fee),
        safeNum(grandTotals?.ecn_take),
        safeNum(grandTotals?.ecn_add),
        safeNum(grandTotals?.routing_fee),
        safeNum(grandTotals?.nscc_fee),
    ].reduce((sum, v) => sum + v, 0);

    // Estimated tax reserve: 25% on positive P&L, $0 if negative
    const estimatedTaxReserve = annualPnl > 0
        ? parseFloat((annualPnl * TAX_RESERVE_RATE).toFixed(2))
        : 0;

    // Monthly cleaned P&L view
    const monthlyCleanedPnl = monthlyRows.map(row => ({
        month: row.month,
        trade_date: row.trade_date,
        net_pnl: safeNum(row.net_pnl),
        net_cash: safeNum(row.net_cash),
        fees: safeNum(row.total_comm) + safeNum(row.sec_fee) + safeNum(row.nasd_fee) +
            safeNum(row.ecn_take) + safeNum(row.ecn_add) + safeNum(row.routing_fee) +
            safeNum(row.nscc_fee),
        gross_pnl: safeNum(row.net_pnl) + safeNum(row.total_comm) + safeNum(row.sec_fee) +
            safeNum(row.nasd_fee) + safeNum(row.ecn_take) - safeNum(row.ecn_add) +
            safeNum(row.routing_fee) + safeNum(row.nscc_fee),
    }));

    // YTD running totals
    let ytdPnl = 0;
    let ytdFees = 0;
    const monthlyWithYtd = monthlyCleanedPnl.map(m => {
        ytdPnl += m.net_pnl;
        ytdFees += m.fees;
        return {
            ...m,
            ytd_pnl: parseFloat(ytdPnl.toFixed(2)),
            ytd_fees: parseFloat(ytdFees.toFixed(2)),
        };
    });

    // Status badges
    const statusBadges = ['TAX-CLEANED', 'NON-OFFICIAL', 'COLMEX_PNL_SOURCE'];
    if (reconciliationResult.status === 'MISMATCH') {
        statusBadges.push('RECONCILIATION_WARNING');
    }

    const derivedFields = {
        ytd_reported_pnl: parseFloat(annualPnl.toFixed(2)),
        annual_net_cash: parseFloat(annualNetCash.toFixed(2)),
        fee_total: parseFloat(feeTotal.toFixed(2)),
        estimated_tax_reserve: estimatedTaxReserve,
        tax_reserve_rate: `${TAX_RESERVE_RATE * 100}%`,
        fee_to_pnl_ratio: annualPnl !== 0 ? parseFloat((feeTotal / Math.abs(annualPnl) * 100).toFixed(2)) : null,
        monthly_cleaned_pnl: monthlyWithYtd,
        client_report_status_badges: statusBadges,
        report_year: header.year,
        report_period: `${header.report_period_start} — ${header.report_period_end}`,
        source_report_type: 'colmex_pnl_report',
        generated_at: new Date().toISOString(),
    };

    return {
        status: 'GENERATED',
        derived_fields: derivedFields,
        summary_preview: {
            reported_annual_pnl: derivedFields.ytd_reported_pnl,
            annual_fee_total: derivedFields.fee_total,
            estimated_tax_reserve_25pct_on_positive_pnl: estimatedTaxReserve,
            tax_cleaned_status_badges: statusBadges,
        },
    };
}

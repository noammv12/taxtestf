// Reconciliation engine — monthly rows vs grand totals

const TOLERANCE = 0.02; // ±$0.02 tolerance for floating point

const FEE_FIELDS = ['total_comm', 'sec_fee', 'nasd_fee', 'ecn_take', 'ecn_add', 'routing_fee', 'nscc_fee'];
const RECONCILE_FIELDS = ['net_pnl', 'net_cash', ...FEE_FIELDS];

function safeNum(val) {
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
        const parsed = parseFloat(val);
        return isNaN(parsed) ? null : parsed;
    }
    return null;
}

export function reconcileReport(payload) {
    const monthlyRows = payload.monthly_rows;
    const grandTotals = payload.grand_totals_row;

    if (!monthlyRows || !Array.isArray(monthlyRows) || monthlyRows.length === 0) {
        return {
            status: 'PARTIAL',
            checks: {
                monthly_net_pnl_sum_matches_grand_total: false,
                monthly_net_cash_sum_matches_grand_total: false,
            },
            details: [{ field: 'monthly_rows', message: 'No monthly rows to reconcile' }],
        };
    }

    if (!grandTotals) {
        return {
            status: 'PARTIAL',
            checks: {
                monthly_net_pnl_sum_matches_grand_total: false,
                monthly_net_cash_sum_matches_grand_total: false,
            },
            details: [{ field: 'grand_totals_row', message: 'Grand totals row missing — cannot reconcile' }],
        };
    }

    const checks = {};
    const details = [];
    let hasAnyMismatch = false;
    let hasAnyNull = false;

    for (const field of ['net_pnl', 'net_cash']) {
        const monthlySum = monthlyRows.reduce((sum, row) => {
            const val = safeNum(row[field]);
            if (val === null) hasAnyNull = true;
            return sum + (val || 0);
        }, 0);

        const grandVal = safeNum(grandTotals[field]);
        if (grandVal === null) {
            hasAnyNull = true;
            checks[`monthly_${field}_sum_matches_grand_total`] = false;
            details.push({
                field,
                message: `Grand total ${field} is not a valid number`,
                monthly_sum: monthlySum,
                grand_total: grandTotals[field],
            });
            hasAnyMismatch = true;
            continue;
        }

        const diff = Math.abs(monthlySum - grandVal);
        const matches = diff <= TOLERANCE;

        checks[`monthly_${field}_sum_matches_grand_total`] = matches;

        if (!matches) {
            hasAnyMismatch = true;
            details.push({
                field,
                message: `Sum of monthly ${field} (${monthlySum.toFixed(2)}) does not match grand total (${grandVal.toFixed(2)}). Difference: ${diff.toFixed(2)}`,
                monthly_sum: parseFloat(monthlySum.toFixed(2)),
                grand_total: grandVal,
                difference: parseFloat(diff.toFixed(2)),
            });
        }
    }

    let status;
    if (hasAnyMismatch) {
        status = 'MISMATCH';
    } else if (hasAnyNull) {
        status = 'PARTIAL';
    } else {
        status = 'RECONCILED';
    }

    return { status, checks, details };
}

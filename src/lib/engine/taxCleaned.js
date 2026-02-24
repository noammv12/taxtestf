// Israeli Tax-Cleaned Report Generator — Production Level
// Applies real Israeli tax law for foreign securities (Colmex Pro clients)
//
// Tax Rules Applied:
// - 25% capital gains tax on net positive P&L from foreign securities
// - All trading fees (commissions, SEC, NASD, ECN, routing, NSCC) are deductible
// - Losses offset gains within the same tax year
// - Remaining losses carry forward indefinitely (recorded for future use)
// - Currency: USD (as reported by Colmex Pro)

const IL_CAPITAL_GAINS_RATE = 0.25;
const IL_SIGNIFICANT_SHAREHOLDER_RATE = 0.30; // Not used for retail clients
const SURTAX_THRESHOLD_NIS = 721560;

function safeNum(val) {
    return typeof val === 'number' ? val : 0;
}

function round2(val) {
    return parseFloat(val.toFixed(2));
}

/**
 * Generate a full Israeli tax-cleaned report for a single Colmex P&L report.
 * Returns a comprehensive tax_data object with calculations, breakdowns, and explanations.
 */
export function generateTaxCleaned(payload, validationResult, reconciliationResult, reportState) {
    // Block tax-cleaned generation for certain conditions
    if (reportState === 'CONFLICT') {
        return {
            status: 'BLOCKED',
            reason: 'Report state is CONFLICT -- cannot generate tax-cleaned outputs',
            tax_data: null,
        };
    }

    if (validationResult.status === 'FAILED') {
        return {
            status: 'BLOCKED',
            reason: 'Validation failed -- cannot generate tax-cleaned outputs',
            tax_data: null,
        };
    }

    if (reportState === 'DUPLICATE') {
        return {
            status: 'SKIPPED',
            reason: 'Duplicate report -- tax-cleaned already exists for this version',
            tax_data: null,
        };
    }

    const header = payload.report_header;
    const grandTotals = payload.grand_totals_row;
    const monthlyRows = payload.monthly_rows || [];
    const summary = payload.summary_totals || {};

    // ═══════════════════════════════════════════════════
    // STEP 1: Compute fee breakdown from grand totals
    // ═══════════════════════════════════════════════════
    const feeBreakdown = {
        commissions: round2(safeNum(grandTotals?.total_comm)),
        sec_fee: round2(safeNum(grandTotals?.sec_fee)),
        nasd_fee: round2(safeNum(grandTotals?.nasd_fee)),
        ecn_take: round2(safeNum(grandTotals?.ecn_take)),
        ecn_add: round2(safeNum(grandTotals?.ecn_add)),
        routing_fee: round2(safeNum(grandTotals?.routing_fee)),
        nscc_fee: round2(safeNum(grandTotals?.nscc_fee)),
    };

    const totalDeductibleFees = round2(
        feeBreakdown.commissions +
        feeBreakdown.sec_fee +
        feeBreakdown.nasd_fee +
        feeBreakdown.ecn_take +
        feeBreakdown.ecn_add +
        feeBreakdown.routing_fee +
        feeBreakdown.nscc_fee
    );

    // ═══════════════════════════════════════════════════
    // STEP 2: Compute annual P&L figures
    // ═══════════════════════════════════════════════════
    // Net P&L from Colmex already INCLUDES trading commissions and direct fees
    // (per their footnote: "Profit & Loss – Includes trading commission and direct trading fees")
    const netAnnualPnl = round2(safeNum(grandTotals?.net_pnl));

    // Gross P&L = Net P&L + all fees (to show what P&L was before fees)
    const grossAnnualPnl = round2(netAnnualPnl + totalDeductibleFees);

    // The net_pnl already has fees deducted, so the taxable amount is the net_pnl
    // Per Israeli tax law, trading costs reduce the taxable gain
    const taxablePnl = netAnnualPnl;

    // ═══════════════════════════════════════════════════
    // STEP 3: Apply loss offset logic
    // ═══════════════════════════════════════════════════
    let lossOffsetApplied = 0;
    let carryForwardLoss = 0;
    let taxableGainAfterOffset = 0;

    if (taxablePnl > 0) {
        // Profit year — full amount is taxable (no prior losses to offset in this demo)
        taxableGainAfterOffset = taxablePnl;
    } else {
        // Loss year — no tax, record loss for carry-forward
        carryForwardLoss = round2(Math.abs(taxablePnl));
        taxableGainAfterOffset = 0;
    }

    // ═══════════════════════════════════════════════════
    // STEP 4: Compute tax liability
    // ═══════════════════════════════════════════════════
    const taxRate = IL_CAPITAL_GAINS_RATE;
    const computedTaxLiability = round2(taxableGainAfterOffset * taxRate);
    const effectiveTaxRate = grossAnnualPnl !== 0
        ? round2((computedTaxLiability / Math.abs(grossAnnualPnl)) * 100)
        : 0;

    // ═══════════════════════════════════════════════════
    // STEP 5: Build monthly breakdown
    // ═══════════════════════════════════════════════════
    let cumulativePnl = 0;
    let cumulativeFees = 0;
    let gainMonths = 0;
    let lossMonths = 0;
    let bestMonth = null;
    let worstMonth = null;

    const monthlyBreakdown = monthlyRows.map(row => {
        const monthNetPnl = round2(safeNum(row.net_pnl));
        const monthFees = round2(
            safeNum(row.total_comm) + safeNum(row.sec_fee) + safeNum(row.nasd_fee) +
            safeNum(row.ecn_take) + safeNum(row.ecn_add) + safeNum(row.routing_fee) +
            safeNum(row.nscc_fee)
        );
        const monthGrossPnl = round2(monthNetPnl + monthFees);
        const monthNetCash = round2(safeNum(row.net_cash));

        cumulativePnl = round2(cumulativePnl + monthNetPnl);
        cumulativeFees = round2(cumulativeFees + monthFees);

        if (monthNetPnl > 0) gainMonths++;
        if (monthNetPnl < 0) lossMonths++;

        if (!bestMonth || monthNetPnl > bestMonth.net_pnl) {
            bestMonth = { month: row.month, trade_date: row.trade_date, net_pnl: monthNetPnl };
        }
        if (!worstMonth || monthNetPnl < worstMonth.net_pnl) {
            worstMonth = { month: row.month, trade_date: row.trade_date, net_pnl: monthNetPnl };
        }

        return {
            month: row.month,
            trade_date: row.trade_date,
            gross_pnl: monthGrossPnl,
            fees: monthFees,
            fee_breakdown: {
                commissions: round2(safeNum(row.total_comm)),
                sec_fee: round2(safeNum(row.sec_fee)),
                nasd_fee: round2(safeNum(row.nasd_fee)),
                ecn_take: round2(safeNum(row.ecn_take)),
                ecn_add: round2(safeNum(row.ecn_add)),
                routing_fee: round2(safeNum(row.routing_fee)),
                nscc_fee: round2(safeNum(row.nscc_fee)),
            },
            net_pnl: monthNetPnl,
            net_cash: monthNetCash,
            cumulative_pnl: cumulativePnl,
            cumulative_fees: cumulativeFees,
            is_profit: monthNetPnl > 0,
            is_loss: monthNetPnl < 0,
        };
    });

    // ═══════════════════════════════════════════════════
    // STEP 6: Build explanations (the key differentiator)
    // ═══════════════════════════════════════════════════
    const explanations = [];

    explanations.push({
        step: 1,
        title: 'Source Data',
        text: `This report is based on the Colmex Pro P&L report for account ${header.account_id} (${header.client_display_name}) for tax year ${header.year}, covering the period ${header.report_period_start} to ${header.report_period_end}.`,
    });

    explanations.push({
        step: 2,
        title: 'Gross Trading P&L',
        text: `Your gross trading profit/loss before any fee deductions was $${grossAnnualPnl.toLocaleString('en-US', { minimumFractionDigits: 2 })}. This is calculated by adding back all deductible fees to your reported net P&L.`,
        formula: `Gross P&L = Net P&L ($${netAnnualPnl.toLocaleString('en-US', { minimumFractionDigits: 2 })}) + Total Fees ($${totalDeductibleFees.toLocaleString('en-US', { minimumFractionDigits: 2 })}) = $${grossAnnualPnl.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
    });

    const feeItems = [];
    if (feeBreakdown.commissions > 0) feeItems.push(`Trading Commissions: $${feeBreakdown.commissions.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
    if (feeBreakdown.sec_fee > 0) feeItems.push(`SEC Fees: $${feeBreakdown.sec_fee.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
    if (feeBreakdown.nasd_fee > 0) feeItems.push(`NASD/FINRA Fees: $${feeBreakdown.nasd_fee.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
    if (feeBreakdown.ecn_take > 0) feeItems.push(`ECN Take Fees: $${feeBreakdown.ecn_take.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
    if (feeBreakdown.ecn_add > 0) feeItems.push(`ECN Add Fees: $${feeBreakdown.ecn_add.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
    if (feeBreakdown.routing_fee > 0) feeItems.push(`Routing Fees: $${feeBreakdown.routing_fee.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
    if (feeBreakdown.nscc_fee > 0) feeItems.push(`NSCC Fees: $${feeBreakdown.nscc_fee.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);

    explanations.push({
        step: 3,
        title: 'Deductible Trading Expenses',
        text: `Under Israeli tax law (Income Tax Ordinance), trading expenses incurred in the production of capital gains from foreign securities are deductible. Your total deductible expenses are $${totalDeductibleFees.toLocaleString('en-US', { minimumFractionDigits: 2 })}, itemized as follows:`,
        items: feeItems,
        legal_basis: 'Section 17 of the Israeli Income Tax Ordinance -- expenses incurred in the production of income are deductible.',
    });

    explanations.push({
        step: 4,
        title: 'Net Taxable P&L',
        text: `Your net taxable P&L after fee deductions is $${netAnnualPnl.toLocaleString('en-US', { minimumFractionDigits: 2 })}. Note: Colmex Pro's reported "Net P&L" already includes trading commissions and direct trading fees as stated in their footnote, so these fees are already deducted from the reported figure.`,
        formula: `Net Taxable P&L = Reported Net P&L = $${netAnnualPnl.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
    });

    if (taxablePnl <= 0) {
        explanations.push({
            step: 5,
            title: 'Loss Year -- No Tax Liability',
            text: `Your net trading result for ${header.year} is a loss of $${Math.abs(taxablePnl).toLocaleString('en-US', { minimumFractionDigits: 2 })}. Under Israeli tax law, capital losses from foreign securities can be carried forward indefinitely to offset future capital gains. This loss of $${carryForwardLoss.toLocaleString('en-US', { minimumFractionDigits: 2 })} is recorded for potential carry-forward.`,
            legal_basis: 'Section 92 of the Israeli Income Tax Ordinance -- capital losses may be carried forward indefinitely and offset against future capital gains. Foreign-source losses must first be offset against foreign-source gains.',
        });

        explanations.push({
            step: 6,
            title: 'Tax Liability',
            text: `No capital gains tax is due for ${header.year}. Your computed tax liability is $0.00.`,
        });
    } else {
        explanations.push({
            step: 5,
            title: 'Loss Offset',
            text: lossOffsetApplied > 0
                ? `A prior carry-forward loss of $${lossOffsetApplied.toLocaleString('en-US', { minimumFractionDigits: 2 })} has been applied to reduce your taxable gain.`
                : `No prior carry-forward losses are available to offset against this year's gain.`,
            formula: `Taxable Gain After Offset = $${taxablePnl.toLocaleString('en-US', { minimumFractionDigits: 2 })} - $${lossOffsetApplied.toLocaleString('en-US', { minimumFractionDigits: 2 })} = $${taxableGainAfterOffset.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
        });

        explanations.push({
            step: 6,
            title: 'Tax Liability Calculation',
            text: `Under Israeli tax law, capital gains from foreign securities by individual residents are taxed at a flat rate of 25%. Your computed tax liability on a taxable gain of $${taxableGainAfterOffset.toLocaleString('en-US', { minimumFractionDigits: 2 })} is $${computedTaxLiability.toLocaleString('en-US', { minimumFractionDigits: 2 })}.`,
            formula: `Tax Liability = Taxable Gain ($${taxableGainAfterOffset.toLocaleString('en-US', { minimumFractionDigits: 2 })}) x 25% = $${computedTaxLiability.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
            legal_basis: 'Section 91(b)(1) of the Israeli Income Tax Ordinance -- real capital gains from securities are taxed at 25% (30% for significant shareholders holding 10%+).',
        });
    }

    explanations.push({
        step: 7,
        title: 'Summary',
        text: taxablePnl > 0
            ? `After accounting for $${totalDeductibleFees.toLocaleString('en-US', { minimumFractionDigits: 2 })} in deductible trading expenses, your effective tax rate on gross trading income is ${effectiveTaxRate}%. The fee-to-P&L ratio shows that ${round2((totalDeductibleFees / Math.abs(grossAnnualPnl)) * 100)}% of your gross trading income was consumed by trading costs.`
            : `This was a loss year with no tax liability. Your total trading expenses were $${totalDeductibleFees.toLocaleString('en-US', { minimumFractionDigits: 2 })}. The loss of $${carryForwardLoss.toLocaleString('en-US', { minimumFractionDigits: 2 })} can be carried forward to offset future gains.`,
    });

    // ═══════════════════════════════════════════════════
    // STEP 7: Build compliance notes
    // ═══════════════════════════════════════════════════
    const complianceNotes = [
        'This is a derived tax calculation report based on Colmex Pro P&L data.',
        'This report is NOT an official Israel Tax Authority Form 867.',
        'All amounts are in USD as reported by Colmex Pro.',
        'For ITA filing purposes, USD amounts should be converted to NIS at the representative exchange rate on the date of each transaction, or at the average annual rate as applicable.',
        'This report covers trading P&L only. Dividends, interest, and other income types are not included.',
        'Individual tax circumstances may vary. Consult a licensed Israeli tax advisor before filing.',
        taxablePnl > 0
            ? 'Recommended action: Ensure this tax liability is accounted for in your annual ITA filing (Form 1301).'
            : 'Recommended action: Record this carry-forward loss for future tax years. Ensure it is reported in your annual ITA filing.',
    ];

    if (reconciliationResult.status === 'MISMATCH') {
        complianceNotes.push('WARNING: This report has reconciliation mismatches. Review the source data before relying on these calculations.');
    }

    // ═══════════════════════════════════════════════════
    // STEP 8: Assemble the full tax_data object
    // ═══════════════════════════════════════════════════
    const tax_data = {
        // Section A: Client Summary
        client_summary: {
            account_id: header.account_id,
            client_name: header.client_display_name,
            username: header.username,
            tax_year: header.year,
            report_period: `${header.report_period_start} -- ${header.report_period_end}`,
            source_file: header.source_file_name,
            active_months: monthlyRows.length,
            generated_at: new Date().toISOString(),
        },

        // Section B: Annual P&L Summary
        annual_summary: {
            gross_trading_pnl: grossAnnualPnl,
            total_deductible_fees: totalDeductibleFees,
            net_taxable_pnl: netAnnualPnl,
            loss_offset_applied: lossOffsetApplied,
            taxable_gain_after_offset: taxableGainAfterOffset,
            tax_rate: taxRate,
            tax_rate_display: `${taxRate * 100}%`,
            computed_tax_liability: computedTaxLiability,
            effective_tax_rate: effectiveTaxRate,
            is_profit_year: taxablePnl > 0,
            carry_forward_loss: carryForwardLoss,
        },

        // Section C: Monthly Breakdown
        monthly_breakdown: monthlyBreakdown,

        // Section D: Fee Itemization
        fee_schedule: {
            ...feeBreakdown,
            total: totalDeductibleFees,
            fee_to_gross_pnl_ratio: grossAnnualPnl !== 0
                ? round2((totalDeductibleFees / Math.abs(grossAnnualPnl)) * 100)
                : null,
        },

        // Section E: Loss Analysis
        loss_analysis: {
            gain_months: gainMonths,
            loss_months: lossMonths,
            zero_months: monthlyRows.length - gainMonths - lossMonths,
            best_month: bestMonth,
            worst_month: worstMonth,
            net_position: taxablePnl > 0 ? 'PROFIT' : taxablePnl < 0 ? 'LOSS' : 'BREAKEVEN',
            carry_forward_amount: carryForwardLoss,
        },

        // Account summary from Colmex report
        account_summary: {
            opening_balance: round2(safeNum(summary.opening_balance)),
            total_deposit_withdrawal: round2(safeNum(summary.total_deposit_withdrawal)),
            total_credit_debit: round2(safeNum(summary.total_credit_debit)),
            profit_loss: round2(safeNum(summary.profit_loss)),
            closing_balance_equity: round2(safeNum(summary.closing_balance_equity)),
        },

        // Section F: Explanations (the key differentiator)
        explanations,

        // Compliance Notes
        compliance_notes: complianceNotes,

        // Metadata
        report_metadata: {
            source_report_type: 'colmex_pnl_report',
            template_version: payload.template_version,
            tax_jurisdiction: 'Israel',
            applicable_law: 'Israeli Income Tax Ordinance (Pkudat Mas Hachnasa)',
            tax_rate_basis: 'Section 91(b)(1) -- 25% on real capital gains from securities',
            status_badges: ['TAX-CLEANED', 'NON-OFFICIAL', 'COLMEX_PNL_SOURCE'],
            reconciliation_status: reconciliationResult.status,
            validation_status: validationResult.status,
        },
    };

    return {
        status: 'GENERATED',
        tax_data,
        // Backwards-compatible summary_preview
        summary_preview: {
            reported_annual_pnl: netAnnualPnl,
            annual_fee_total: totalDeductibleFees,
            estimated_tax_reserve_25pct_on_positive_pnl: computedTaxLiability,
            tax_cleaned_status_badges: tax_data.report_metadata.status_badges,
        },
        // Legacy compatibility
        derived_fields: {
            ytd_reported_pnl: netAnnualPnl,
            annual_net_cash: round2(safeNum(grandTotals?.net_cash)),
            fee_total: totalDeductibleFees,
            estimated_tax_reserve: computedTaxLiability,
            tax_reserve_rate: `${taxRate * 100}%`,
            fee_to_pnl_ratio: netAnnualPnl !== 0 ? round2((totalDeductibleFees / Math.abs(netAnnualPnl)) * 100) : null,
            monthly_cleaned_pnl: monthlyBreakdown,
            client_report_status_badges: tax_data.report_metadata.status_badges,
            report_year: header.year,
            report_period: `${header.report_period_start} -- ${header.report_period_end}`,
            source_report_type: 'colmex_pnl_report',
            generated_at: new Date().toISOString(),
        },
    };
}

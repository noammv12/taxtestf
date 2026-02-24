// Batch Runner — loads and processes all 50 demo scenarios
import fs from 'fs';
import path from 'path';
import { processReport } from './ingestionEngine.js';
import { resetClients } from './clientStore.js';
import { resetReports } from './reportStore.js';
import { resetAuditLog } from './auditLog.js';

const DEMO_PACK_PATH = path.join(process.cwd(), '..', 'Downloads', 'colmex_pnl_demo_pack_v1');
// Also try relative to home directory
const DEMO_PACK_PATHS = [
    DEMO_PACK_PATH,
    path.join(process.env.HOME || '/Users/ilaynsany', 'Downloads', 'colmex_pnl_demo_pack_v1'),
];

function findDemoPackPath() {
    for (const p of DEMO_PACK_PATHS) {
        if (fs.existsSync(p)) return p;
    }
    throw new Error('Demo pack not found. Checked: ' + DEMO_PACK_PATHS.join(', '));
}

export function loadManifest() {
    const packPath = findDemoPackPath();
    const manifestPath = path.join(packPath, 'manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    return { manifest, packPath };
}

export function loadScenario(packPath, scenarioId) {
    const inputPath = path.join(packPath, 'scenarios', scenarioId, 'input', 'input_report.json');
    const expectedPath = path.join(packPath, 'scenarios', scenarioId, 'expected', 'expected_outcomes.json');

    const input = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));
    let expected = null;
    if (fs.existsSync(expectedPath)) {
        expected = JSON.parse(fs.readFileSync(expectedPath, 'utf-8'));
    }

    return { input, expected };
}

export function runBatch(resetFirst = true) {
    const batchStartTime = Date.now();

    if (resetFirst) {
        resetClients();
        resetReports();
        resetAuditLog();
    }

    const { manifest, packPath } = loadManifest();
    const scenarios = manifest.scenarios;

    const results = {
        total: scenarios.length,
        processed: 0,
        counts: {
            NEW: 0,
            DUPLICATE: 0,
            REVISION: 0,
            CONFLICT: 0,
        },
        validation: {
            VALIDATED: 0,
            FAILED: 0,
            REVIEW_REQUIRED: 0,
            SKIPPED: 0,
        },
        reconciliation: {
            RECONCILED: 0,
            MISMATCH: 0,
            PARTIAL: 0,
            SKIPPED: 0,
        },
        tax_cleaned: {
            GENERATED: 0,
            BLOCKED: 0,
            SKIPPED: 0,
        },
        exceptions_created: 0,
        overall_status: {
            SUCCESS: 0,
            CONFLICT: 0,
            VALIDATION_FAILED: 0,
            RECONCILIATION_MISMATCH: 0,
            REVIEW_REQUIRED: 0,
            DUPLICATE_SKIPPED: 0,
            ERROR: 0,
        },
        scenario_results: [],
        runtime_ms: 0,
        groups: {},
    };

    for (const scenario of scenarios) {
        try {
            const { input, expected } = loadScenario(packPath, scenario.id);
            const processingResult = processReport(input, scenario.id);

            // Tally report state
            const reportState = processingResult.steps.report_classification?.state;
            if (reportState && results.counts[reportState] !== undefined) {
                results.counts[reportState]++;
            }

            // Tally validation
            const valStatus = processingResult.steps.validation?.status;
            if (valStatus && results.validation[valStatus] !== undefined) {
                results.validation[valStatus]++;
            }

            // Tally reconciliation
            const reconStatus = processingResult.steps.reconciliation?.status;
            if (reconStatus && results.reconciliation[reconStatus] !== undefined) {
                results.reconciliation[reconStatus]++;
            }

            // Tally tax-cleaned
            const tcStatus = processingResult.steps.tax_cleaned?.status;
            if (tcStatus && results.tax_cleaned[tcStatus] !== undefined) {
                results.tax_cleaned[tcStatus]++;
            }

            // Tally overall status
            if (results.overall_status[processingResult.overall_status] !== undefined) {
                results.overall_status[processingResult.overall_status]++;
            }

            // Tally exceptions
            const exceptionCount = processingResult.steps.validation?.exceptions?.length || 0;
            results.exceptions_created += exceptionCount;

            // Group statistics
            const group = scenario.group;
            if (!results.groups[group]) {
                results.groups[group] = { total: 0, success: 0, failed: 0, scenarios: [] };
            }
            results.groups[group].total++;
            if (['SUCCESS', 'DUPLICATE_SKIPPED'].includes(processingResult.overall_status)) {
                results.groups[group].success++;
            } else {
                results.groups[group].failed++;
            }

            // Compare with expected (high-level)
            let matchesExpected = null;
            if (expected) {
                const exp = expected.expected_outcomes;
                matchesExpected = {
                    report_state_match: exp.report_resolution?.report_state === reportState,
                    validation_status_match: exp.validation?.status === valStatus,
                    reconciliation_status_match: exp.reconciliation?.status === reconStatus,
                    tax_cleaned_status_match: exp.tax_cleaned?.status === tcStatus,
                    client_action_match: exp.client_resolution?.client_action === processingResult.steps.client_resolution?.action,
                };
            }

            const scenarioResult = {
                id: scenario.id,
                title: scenario.title,
                group: scenario.group,
                report_state: reportState,
                overall_status: processingResult.overall_status,
                validation_status: valStatus,
                reconciliation_status: reconStatus,
                tax_cleaned_status: tcStatus,
                client_action: processingResult.steps.client_resolution?.action,
                processing_time_ms: processingResult.processing_time_ms,
                matches_expected: matchesExpected,
                account_id: processingResult.account_id,
            };

            results.scenario_results.push(scenarioResult);
            results.groups[group].scenarios.push(scenarioResult);
            results.processed++;

        } catch (error) {
            results.scenario_results.push({
                id: scenario.id,
                title: scenario.title,
                group: scenario.group,
                overall_status: 'ERROR',
                error: error.message,
            });
            results.overall_status.ERROR++;
            results.processed++;
        }
    }

    results.runtime_ms = Date.now() - batchStartTime;
    return results;
}

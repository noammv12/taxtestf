// Ingestion Engine — main orchestrator
// Processes a single report payload through the full pipeline

import { resolveClient, updateClientStats } from './clientStore.js';
import { classifyReport, storeReport } from './reportStore.js';
import { validateReport } from './validator.js';
import { reconcileReport } from './reconciler.js';
import { generateTaxCleaned } from './taxCleaned.js';
import { logAuditEvent, createException } from './auditLog.js';

export function processReport(payload, scenarioId = null) {
    const startTime = Date.now();
    const header = payload.report_header;
    const results = {
        scenarioId,
        account_id: header?.account_id,
        year: header?.year,
        steps: {},
        overall_status: 'SUCCESS',
        processing_time_ms: 0,
    };

    try {
        // Step 1: Client/Account Resolution
        const clientResult = resolveClient(header);
        results.steps.client_resolution = {
            action: clientResult.action,
            identity_resolution: clientResult.identity_resolution,
            overlap_prevented: clientResult.overlap_prevented,
            conflict: clientResult.conflict,
        };

        // If identity conflict, create exception
        if (clientResult.conflict) {
            createException({
                type: clientResult.conflict.type,
                severity: 'HIGH',
                account_id: header.account_id,
                detail: `Username conflict: existing="${clientResult.conflict.existing_username}" incoming="${clientResult.conflict.incoming_username}"`,
                payload_context: {
                    account_id: header.account_id,
                    existing_username: clientResult.conflict.existing_username,
                    incoming_username: clientResult.conflict.incoming_username,
                },
            });
        }

        // Step 2: Report Classification
        const classification = classifyReport(payload);
        results.steps.report_classification = {
            state: classification.state,
            naturalKey: classification.naturalKey,
            payloadHash: classification.payloadHash,
        };

        // Log the ingestion event
        logAuditEvent({
            event_type: 'REPORT_INGESTED',
            account_id: header.account_id,
            scenario_id: scenarioId,
            report_state: classification.state,
            payload_hash: classification.payloadHash,
            source_file: header.source_file_name,
        });

        // If duplicate, skip further processing
        if (classification.state === 'DUPLICATE') {
            logAuditEvent({
                event_type: 'DUPLICATE_SKIPPED',
                account_id: header.account_id,
                scenario_id: scenarioId,
                detail: `Duplicate of existing report — no reprocessing needed`,
            });

            results.steps.validation = { status: 'SKIPPED', checks: {}, warnings: [], exceptions: [] };
            results.steps.reconciliation = { status: 'SKIPPED', checks: {}, details: [] };
            results.steps.tax_cleaned = { status: 'SKIPPED', reason: 'Duplicate report' };
            results.steps.storage = { stored: false, reason: 'duplicate' };
            results.overall_status = 'DUPLICATE_SKIPPED';
            results.processing_time_ms = Date.now() - startTime;
            return results;
        }

        // Step 3: Validation
        const validationResult = validateReport(payload);
        results.steps.validation = validationResult;

        // Create exceptions for validation failures
        for (const exc of validationResult.exceptions) {
            createException({
                type: exc.type,
                severity: exc.type.includes('MISSING') ? 'HIGH' : 'MEDIUM',
                account_id: header.account_id,
                detail: exc.detail,
                payload_context: exc,
            });
        }

        logAuditEvent({
            event_type: 'VALIDATION_COMPLETED',
            account_id: header.account_id,
            scenario_id: scenarioId,
            validation_status: validationResult.status,
            checks: validationResult.checks,
        });

        // Step 4: Reconciliation
        const reconciliationResult = reconcileReport(payload);
        results.steps.reconciliation = reconciliationResult;

        // Create exceptions for reconciliation mismatches
        if (reconciliationResult.status === 'MISMATCH') {
            for (const detail of reconciliationResult.details) {
                createException({
                    type: `TOTALS_MISMATCH_${detail.field.toUpperCase()}`,
                    severity: 'HIGH',
                    account_id: header.account_id,
                    detail: detail.message,
                    payload_context: detail,
                });
            }
        }

        logAuditEvent({
            event_type: 'RECONCILIATION_COMPLETED',
            account_id: header.account_id,
            scenario_id: scenarioId,
            reconciliation_status: reconciliationResult.status,
            checks: reconciliationResult.checks,
        });

        // Step 5: Tax-Cleaned Generation
        const reportState = clientResult.conflict ? 'CONFLICT' : classification.state;
        const taxCleanedResult = generateTaxCleaned(payload, validationResult, reconciliationResult, reportState);
        results.steps.tax_cleaned = {
            status: taxCleanedResult.status,
            summary_preview: taxCleanedResult.summary_preview || null,
        };

        logAuditEvent({
            event_type: 'TAX_CLEANED_GENERATED',
            account_id: header.account_id,
            scenario_id: scenarioId,
            tax_cleaned_status: taxCleanedResult.status,
        });

        // Step 6: Store the report
        const storageResult = storeReport(
            payload, classification, validationResult,
            reconciliationResult, taxCleanedResult, scenarioId
        );
        results.steps.storage = {
            stored: storageResult.stored,
            reportId: storageResult.record?.id,
            version: storageResult.record?.version,
        };

        // If revision, log the archival of prior version
        if (classification.state === 'REVISION') {
            logAuditEvent({
                event_type: 'PRIOR_VERSION_ARCHIVED',
                account_id: header.account_id,
                scenario_id: scenarioId,
                new_version_id: storageResult.record?.id,
                prior_versions: classification.priorVersions,
            });
        }

        // Step 7: Update client stats
        if (storageResult.stored) {
            updateClientStats(header.account_id, header.year);
        }

        logAuditEvent({
            event_type: 'PROCESSING_COMPLETED',
            account_id: header.account_id,
            scenario_id: scenarioId,
            report_state: classification.state,
            validation_status: validationResult.status,
            reconciliation_status: reconciliationResult.status,
            tax_cleaned_status: taxCleanedResult.status,
            stored: storageResult.stored,
        });

        // Determine overall status
        if (clientResult.conflict) {
            results.overall_status = 'CONFLICT';
        } else if (validationResult.status === 'FAILED') {
            results.overall_status = 'VALIDATION_FAILED';
        } else if (reconciliationResult.status === 'MISMATCH') {
            results.overall_status = 'RECONCILIATION_MISMATCH';
        } else if (validationResult.status === 'REVIEW_REQUIRED') {
            results.overall_status = 'REVIEW_REQUIRED';
        } else {
            results.overall_status = 'SUCCESS';
        }

    } catch (error) {
        results.overall_status = 'ERROR';
        results.error = error.message;
        logAuditEvent({
            event_type: 'PROCESSING_ERROR',
            account_id: header?.account_id,
            scenario_id: scenarioId,
            error: error.message,
        });
    }

    results.processing_time_ms = Date.now() - startTime;
    return results;
}

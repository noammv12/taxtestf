// File Upload Batch Processor
// Processes a folder of client JSON files through the full pipeline
// and generates per-client tax reports

import fs from 'fs';
import path from 'path';
import { processReport } from './ingestionEngine.js';
import { generateTaxCleaned } from './taxCleaned.js';
import { validateReport } from './validator.js';
import { reconcileReport } from './reconciler.js';
import { storeTaxReport, resetTaxReports } from './taxReportStore.js';
import { resetClients } from './clientStore.js';
import { resetReports } from './reportStore.js';
import { resetAuditLog } from './auditLog.js';

/**
 * Process all JSON files from a given directory path.
 * Groups results by client and stores tax reports.
 */
export function processClientFolder(directoryPath, resetFirst = true) {
    const startTime = Date.now();

    if (resetFirst) {
        resetClients();
        resetReports();
        resetAuditLog();
        resetTaxReports();
    }

    // Read all JSON files from the directory
    if (!fs.existsSync(directoryPath)) {
        throw new Error(`Directory not found: ${directoryPath}`);
    }

    const files = fs.readdirSync(directoryPath)
        .filter(f => f.endsWith('.json'))
        .sort();

    if (files.length === 0) {
        throw new Error(`No JSON files found in: ${directoryPath}`);
    }

    // First pass: process all files through the engine
    const processingResults = [];
    for (const fileName of files) {
        const filePath = path.join(directoryPath, fileName);
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            const payload = JSON.parse(content);
            const processingResult = processReport(payload, fileName);
            processingResults.push({ fileName, payload, processingResult });
        } catch (err) {
            processingResults.push({ fileName, payload: null, processingResult: null, error: err.message });
        }
    }

    // Second pass: generate and store tax reports for each unique account+year
    const taxReportMap = new Map(); // key: account_year
    for (const { fileName, payload, processingResult, error } of processingResults) {
        if (error || !payload || !processingResult) continue;

        const accountId = payload.report_header?.account_id;
        const year = payload.report_header?.year;
        const clientName = payload.report_header?.client_display_name;
        const key = `${accountId}_${year}`;

        if (!accountId || !year) continue;
        if (taxReportMap.has(key)) continue; // Already generated for this account+year

        // Generate the full tax report
        const reportState = processingResult.steps?.report_classification?.state;
        if (reportState === 'DUPLICATE') continue;

        const validationResult = processingResult.steps?.validation || { status: 'VALIDATED', checks: {}, warnings: [], exceptions: [] };
        const reconciliationResult = processingResult.steps?.reconciliation || { status: 'RECONCILED', checks: {}, details: [] };

        const taxResult = generateTaxCleaned(payload, validationResult, reconciliationResult, reportState || 'NEW');

        if (taxResult.status === 'GENERATED' && taxResult.tax_data) {
            const stored = storeTaxReport({
                account_id: accountId,
                year,
                client_name: clientName,
                tax_data: taxResult.tax_data,
                source_files: [fileName],
            });
            taxReportMap.set(key, stored);
        }
    }

    // Build results
    const results = {
        total_files: files.length,
        processed: 0,
        failed: 0,
        clients_found: 0,
        reports_generated: taxReportMap.size,
        file_results: [],
        client_summary: {},
        runtime_ms: 0,
    };

    for (const { fileName, payload, processingResult, error } of processingResults) {
        if (error) {
            results.file_results.push({ file_name: fileName, overall_status: 'ERROR', error });
            results.failed++;
            results.processed++;
            continue;
        }

        const accountId = payload?.report_header?.account_id;
        const year = payload?.report_header?.year;
        const clientName = payload?.report_header?.client_display_name;
        const key = `${accountId}_${year}`;

        results.file_results.push({
            file_name: fileName,
            account_id: accountId,
            year,
            client_name: clientName,
            overall_status: processingResult.overall_status,
            report_state: processingResult.steps?.report_classification?.state,
            validation_status: processingResult.steps?.validation?.status,
            reconciliation_status: processingResult.steps?.reconciliation?.status,
            tax_cleaned_status: processingResult.steps?.tax_cleaned?.status,
            processing_time_ms: processingResult.processing_time_ms,
            tax_report_id: taxReportMap.get(key)?.id || null,
        });
        results.processed++;

        if (accountId) {
            if (!results.client_summary[accountId]) {
                results.client_summary[accountId] = {
                    account_id: accountId,
                    client_name: clientName,
                    years: [],
                    files: [],
                    statuses: [],
                };
            }
            if (!results.client_summary[accountId].years.includes(year)) {
                results.client_summary[accountId].years.push(year);
            }
            results.client_summary[accountId].files.push(fileName);
            results.client_summary[accountId].statuses.push(processingResult.overall_status);
        }
    }

    results.clients_found = Object.keys(results.client_summary).length;
    results.runtime_ms = Date.now() - startTime;

    return results;
}

/**
 * Process an array of JSON payloads (for browser-side uploads).
 * Each item should have { fileName, payload }.
 */
export function processPayloadBatch(payloads, resetFirst = true) {
    const startTime = Date.now();

    if (resetFirst) {
        resetClients();
        resetReports();
        resetAuditLog();
        resetTaxReports();
    }

    // First pass: process through engine
    const processingResults = [];
    for (const { fileName, payload } of payloads) {
        try {
            const processingResult = processReport(payload, fileName);
            processingResults.push({ fileName, payload, processingResult });
        } catch (err) {
            processingResults.push({ fileName, payload, processingResult: null, error: err.message });
        }
    }

    // Second pass: generate tax reports
    const taxReportMap = new Map();
    for (const { fileName, payload, processingResult, error } of processingResults) {
        if (error || !payload || !processingResult) continue;

        const accountId = payload.report_header?.account_id;
        const year = payload.report_header?.year;
        const clientName = payload.report_header?.client_display_name;
        const key = `${accountId}_${year}`;

        if (!accountId || !year) continue;
        if (taxReportMap.has(key)) continue;

        const reportState = processingResult.steps?.report_classification?.state;
        if (reportState === 'DUPLICATE') continue;

        const validationResult = processingResult.steps?.validation || { status: 'VALIDATED', checks: {}, warnings: [], exceptions: [] };
        const reconciliationResult = processingResult.steps?.reconciliation || { status: 'RECONCILED', checks: {}, details: [] };

        const taxResult = generateTaxCleaned(payload, validationResult, reconciliationResult, reportState || 'NEW');

        if (taxResult.status === 'GENERATED' && taxResult.tax_data) {
            const stored = storeTaxReport({
                account_id: accountId,
                year,
                client_name: clientName,
                tax_data: taxResult.tax_data,
                source_files: [fileName],
            });
            taxReportMap.set(key, stored);
        }
    }

    // Build results
    const results = {
        total_files: payloads.length,
        processed: 0,
        failed: 0,
        clients_found: 0,
        reports_generated: taxReportMap.size,
        file_results: [],
        client_summary: {},
        runtime_ms: 0,
    };

    for (const { fileName, payload, processingResult, error } of processingResults) {
        if (error) {
            results.file_results.push({ file_name: fileName, overall_status: 'ERROR', error });
            results.failed++;
            results.processed++;
            continue;
        }

        const accountId = payload?.report_header?.account_id;
        const year = payload?.report_header?.year;
        const clientName = payload?.report_header?.client_display_name;
        const key = `${accountId}_${year}`;

        results.file_results.push({
            file_name: fileName,
            account_id: accountId,
            year,
            client_name: clientName,
            overall_status: processingResult.overall_status,
            report_state: processingResult.steps?.report_classification?.state,
            validation_status: processingResult.steps?.validation?.status,
            reconciliation_status: processingResult.steps?.reconciliation?.status,
            tax_cleaned_status: processingResult.steps?.tax_cleaned?.status,
            processing_time_ms: processingResult.processing_time_ms,
            tax_report_id: taxReportMap.get(key)?.id || null,
        });
        results.processed++;

        if (accountId) {
            if (!results.client_summary[accountId]) {
                results.client_summary[accountId] = {
                    account_id: accountId,
                    client_name: clientName,
                    years: [],
                    files: [],
                    statuses: [],
                };
            }
            if (!results.client_summary[accountId].years.includes(year)) {
                results.client_summary[accountId].years.push(year);
            }
            results.client_summary[accountId].files.push(fileName);
            results.client_summary[accountId].statuses.push(processingResult.overall_status);
        }
    }

    results.clients_found = Object.keys(results.client_summary).length;
    results.runtime_ms = Date.now() - startTime;

    return results;
}

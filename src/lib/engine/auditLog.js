// Audit Log & Exceptions Queue
// In-memory — persists during server runtime

let auditEvents = [];
let exceptions = [];
let nextExceptionId = 1;

export function logAuditEvent(event) {
    const entry = {
        id: `AUD-${String(auditEvents.length + 1).padStart(5, '0')}`,
        timestamp: new Date().toISOString(),
        ...event,
    };
    auditEvents.push(entry);
    return entry;
}

export function createException(exception) {
    const entry = {
        id: `EXC-${String(nextExceptionId++).padStart(5, '0')}`,
        status: 'OPEN',
        created_at: new Date().toISOString(),
        resolved_at: null,
        resolution: null,
        resolution_notes: null,
        ...exception,
    };
    exceptions.push(entry);

    // Also log audit event for exception creation
    logAuditEvent({
        event_type: 'EXCEPTION_CREATED',
        account_id: exception.account_id,
        exception_id: entry.id,
        exception_type: exception.type,
        detail: exception.detail,
    });

    return entry;
}

export function resolveException(exceptionId, resolution, notes) {
    const exc = exceptions.find(e => e.id === exceptionId);
    if (!exc) return null;

    exc.status = 'RESOLVED';
    exc.resolved_at = new Date().toISOString();
    exc.resolution = resolution;
    exc.resolution_notes = notes || '';

    logAuditEvent({
        event_type: 'EXCEPTION_RESOLVED',
        account_id: exc.account_id,
        exception_id: exc.id,
        exception_type: exc.type,
        resolution,
        notes,
    });

    return exc;
}

export function getExceptions(filters = {}) {
    let result = [...exceptions];
    if (filters.status) result = result.filter(e => e.status === filters.status);
    if (filters.account_id) result = result.filter(e => e.account_id === filters.account_id);
    if (filters.type) result = result.filter(e => e.type === filters.type);
    if (filters.severity) result = result.filter(e => e.severity === filters.severity);
    return result;
}

export function getExceptionById(id) {
    return exceptions.find(e => e.id === id) || null;
}

export function getAuditEvents(filters = {}) {
    let result = [...auditEvents];
    if (filters.account_id) result = result.filter(e => e.account_id === filters.account_id);
    if (filters.event_type) result = result.filter(e => e.event_type === filters.event_type);
    return result;
}

export function getAuditEventsForClient(accountId) {
    return auditEvents.filter(e => e.account_id === accountId);
}

export function resetAuditLog() {
    auditEvents = [];
    exceptions = [];
    nextExceptionId = 1;
}

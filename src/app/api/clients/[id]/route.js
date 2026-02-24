import { NextResponse } from 'next/server';
import { getClient } from '@/lib/engine/clientStore';
import { getReportsForClient, getActiveReportsForClient } from '@/lib/engine/reportStore';
import { getAuditEventsForClient } from '@/lib/engine/auditLog';
import { getExceptions } from '@/lib/engine/auditLog';

export async function GET(request, { params }) {
    try {
        const { id } = await params;
        const client = getClient(id);
        if (!client) {
            return NextResponse.json({ error: 'Client not found' }, { status: 404 });
        }

        const allReports = getReportsForClient(id);
        const activeReports = getActiveReportsForClient(id);
        const auditEvents = getAuditEventsForClient(id);
        const exceptions = getExceptions({ account_id: id });

        return NextResponse.json({
            client,
            reports: allReports,
            active_reports: activeReports,
            audit_events: auditEvents,
            exceptions,
        });
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

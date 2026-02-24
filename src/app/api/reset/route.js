import { NextResponse } from 'next/server';
import { resetClients } from '@/lib/engine/clientStore';
import { resetReports } from '@/lib/engine/reportStore';
import { resetAuditLog } from '@/lib/engine/auditLog';

export async function POST() {
    try {
        resetClients();
        resetReports();
        resetAuditLog();
        return NextResponse.json({ status: 'reset', message: 'All state cleared successfully' });
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

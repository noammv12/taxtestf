import { NextResponse } from 'next/server';
import { processReport } from '@/lib/engine/ingestionEngine';

export async function POST(request) {
    try {
        const payload = await request.json();
        if (!payload || !payload.report_header) {
            return NextResponse.json({ error: 'Invalid payload — missing report_header' }, { status: 400 });
        }
        const result = processReport(payload);
        return NextResponse.json(result);
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

import { NextResponse } from 'next/server';
import { getTaxReport } from '@/lib/engine/taxReportStore';

export async function GET(request, { params }) {
    try {
        const { id } = await params;
        const report = getTaxReport(id);

        if (!report) {
            return NextResponse.json({ error: 'Report not found' }, { status: 404 });
        }

        return NextResponse.json(report);
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

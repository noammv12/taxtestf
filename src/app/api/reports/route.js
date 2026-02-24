import { NextResponse } from 'next/server';
import { getAllTaxReports, getTaxReportSummaryStats } from '@/lib/engine/taxReportStore';

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status');
        const year = searchParams.get('year');

        const reports = getAllTaxReports({ status, year });
        const stats = getTaxReportSummaryStats();

        return NextResponse.json({
            reports,
            stats,
            total: reports.length,
        });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

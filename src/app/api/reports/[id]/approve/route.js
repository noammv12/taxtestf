import { NextResponse } from 'next/server';
import { approveTaxReport, rejectTaxReport, flagTaxReport } from '@/lib/engine/taxReportStore';

export async function POST(request, { params }) {
    try {
        const { id } = await params;
        const body = await request.json();
        const action = body.action; // 'approve', 'reject', 'flag'

        let result;
        if (action === 'approve') {
            result = approveTaxReport(id, {
                approved_by: body.approved_by || 'ops_user',
                notes: body.notes,
            });
        } else if (action === 'reject') {
            result = rejectTaxReport(id, {
                rejected_by: body.rejected_by || 'ops_user',
                notes: body.notes,
            });
        } else if (action === 'flag') {
            result = flagTaxReport(id, { notes: body.notes });
        } else {
            return NextResponse.json(
                { error: 'Invalid action. Use "approve", "reject", or "flag".' },
                { status: 400 }
            );
        }

        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 404 });
        }

        return NextResponse.json(result);
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

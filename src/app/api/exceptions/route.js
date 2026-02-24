import { NextResponse } from 'next/server';
import { getExceptions, resolveException } from '@/lib/engine/auditLog';

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const filters = {};
        if (searchParams.get('status')) filters.status = searchParams.get('status');
        if (searchParams.get('account_id')) filters.account_id = searchParams.get('account_id');
        if (searchParams.get('type')) filters.type = searchParams.get('type');

        const exceptions = getExceptions(filters);
        return NextResponse.json({ exceptions });
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const body = await request.json();
        const { exception_id, resolution, notes } = body;

        if (!exception_id || !resolution) {
            return NextResponse.json({ error: 'exception_id and resolution are required' }, { status: 400 });
        }

        const result = resolveException(exception_id, resolution, notes);
        if (!result) {
            return NextResponse.json({ error: 'Exception not found' }, { status: 404 });
        }

        return NextResponse.json({ exception: result });
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

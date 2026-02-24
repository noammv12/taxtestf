import { NextResponse } from 'next/server';
import { getClients } from '@/lib/engine/clientStore';

export async function GET() {
    try {
        const clients = getClients();
        return NextResponse.json({ clients });
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

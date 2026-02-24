import { NextResponse } from 'next/server';
import { runBatch } from '@/lib/engine/batchRunner';

export async function POST() {
    try {
        const results = runBatch(true);
        return NextResponse.json(results);
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

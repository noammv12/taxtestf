import { NextResponse } from 'next/server';
import { processClientFolder, processPayloadBatch } from '@/lib/engine/fileUploadBatch';

export async function POST(request) {
    try {
        const body = await request.json();

        // Mode 1: Process from a directory path (server-side)
        if (body.directory_path) {
            const results = processClientFolder(body.directory_path, body.reset !== false);
            return NextResponse.json(results);
        }

        // Mode 2: Process uploaded payloads (browser-side)
        if (body.payloads && Array.isArray(body.payloads)) {
            const payloads = body.payloads.map(p => ({
                fileName: p.fileName || p.file_name || 'unknown.json',
                payload: p.payload || p.data || p,
            }));
            const results = processPayloadBatch(payloads, body.reset !== false);
            return NextResponse.json(results);
        }

        return NextResponse.json(
            { error: 'Invalid request. Provide either "directory_path" or "payloads" array.' },
            { status: 400 }
        );
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

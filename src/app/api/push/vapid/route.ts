import { NextResponse } from 'next/server';
import { pushService } from '@/lib/pushService';

export const dynamic = 'force-dynamic';

export async function GET() {
	return NextResponse.json({ publicKey: await pushService.publicKey() });
}

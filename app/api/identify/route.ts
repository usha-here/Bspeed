import { NextResponse } from 'next/server';
import { IdentityService } from './service';

export const dynamic = 'force-dynamic';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
    return NextResponse.json({}, { headers: corsHeaders });
}

// Instantiate the service once
const identityService = new IdentityService();

export async function POST(req: Request) {
    try {
        let body;
        try {
            body = await req.json();
        } catch {
            return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400, headers: corsHeaders });
        }

        const { email, phoneNumber } = body || {};

        if (!email && !phoneNumber) {
            return NextResponse.json({ error: 'Email or phone number is required' }, { status: 400, headers: corsHeaders });
        }

        const phoneStr = phoneNumber ? String(phoneNumber) : null;
        const emailStr = email ? String(email) : null;

        // Delegate entirety of the logic to our OOP service layer
        const responseData = await identityService.resolveIdentity(emailStr, phoneStr);

        return NextResponse.json(responseData, { headers: corsHeaders });

    } catch (error: unknown) {
        console.error('Identify API Error:', error);
        return NextResponse.json({
            error: 'Internal server error',
            details: error instanceof Error ? error.message : String(error)
        }, { status: 500, headers: corsHeaders });
    }
}

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getClientById, updateClient } from '@/lib/db/queries/clients';
import { checkPermission } from '@/lib/auth/checkPermissions';
import { logAudit } from '@/lib/audit/log';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ clientId: string }> }
) {
    try {
        const cookieStore = await cookies(); // 👈 أضف await
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    get(name: string) {
                        return cookieStore.get(name)?.value;
                    },
                },
            }
        );

        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const canRead = await checkPermission(user, 'clients', 'read');
        if (!canRead) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { clientId } = await params;
        const includeDeleted = request.nextUrl.searchParams.get('includeDeleted') === 'true';

        const client = await getClientById(clientId, includeDeleted);
        return NextResponse.json(client);
    } catch (error) {
        console.error('GET /api/clients/[clientId] error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ clientId: string }> }
) {
    try {
        const cookieStore = await cookies(); // 👈 أضف await
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    get(name: string) {
                        return cookieStore.get(name)?.value;
                    },
                },
            }
        );

        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const canUpdate = await checkPermission(user, 'clients', 'update');
        if (!canUpdate) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { clientId } = await params;
        const body = await request.json();

        const oldClient = await getClientById(clientId, true);
        const updated = await updateClient(clientId, body);

        await logAudit({
            tableName: 'clients',
            recordId: clientId,
            action: 'UPDATE',
            oldData: oldClient,
            newData: updated,
            userId: user.id,
        });

        return NextResponse.json(updated);
    } catch (error) {
        console.error('PATCH /api/clients/[clientId] error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
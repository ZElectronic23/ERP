import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import {
    createClient,
    getClients,
    getClientById,
    softDeleteClient,
    restoreClient,
    permanentDeleteClient
} from '@/lib/db/queries/clients';
import { checkPermission } from '@/lib/auth/checkPermissions';
import { logAudit } from '@/lib/audit/log';

export async function GET(request: NextRequest) {
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

        const searchParams = request.nextUrl.searchParams;
        const includeDeleted = searchParams.get('includeDeleted') === 'true';
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '50');
        const search = searchParams.get('search') || '';

        const { data, count } = await getClients({ includeDeleted, page, limit, search });

        return NextResponse.json({ data, count });
    } catch (error) {
        console.error('GET /api/clients error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
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

        const canCreate = await checkPermission(user, 'clients', 'create');
        if (!canCreate) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const body = await request.json();
        const newClient = await createClient(body, user.id);

        await logAudit({
            tableName: 'clients',
            recordId: newClient.ClientId,
            action: 'INSERT',
            newData: newClient,
            userId: user.id,
        });

        return NextResponse.json(newClient, { status: 201 });
    } catch (error) {
        console.error('POST /api/clients error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function PATCH(request: NextRequest) {
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

        const { searchParams } = new URL(request.url);
        const action = searchParams.get('action');
        const clientId = searchParams.get('clientId');

        if (!clientId) {
            return NextResponse.json({ error: 'Missing clientId' }, { status: 400 });
        }

        if (action === 'soft-delete') {
            const canDelete = await checkPermission(user, 'clients', 'delete');
            if (!canDelete) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }

            const deleted = await softDeleteClient(clientId);
            await logAudit({
                tableName: 'clients',
                recordId: clientId,
                action: 'SOFT_DELETE',
                oldData: deleted,
                userId: user.id,
            });
            return NextResponse.json(deleted);
        }

        if (action === 'restore') {
            const canUpdate = await checkPermission(user, 'clients', 'update');
            if (!canUpdate) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }

            const restored = await restoreClient(clientId);
            await logAudit({
                tableName: 'clients',
                recordId: clientId,
                action: 'RESTORE',
                newData: restored,
                userId: user.id,
            });
            return NextResponse.json(restored);
        }

        if (action === 'permanent-delete') {
            const canPermanentDelete = await checkPermission(user, 'clients', 'permanent_delete');
            if (!canPermanentDelete) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }

            const oldClient = await getClientById(clientId, true);
            await permanentDeleteClient(clientId);
            await logAudit({
                tableName: 'clients',
                recordId: clientId,
                action: 'PERMANENT_DELETE',
                oldData: oldClient,
                userId: user.id,
            });
            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    } catch (error) {
        console.error('PATCH /api/clients error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
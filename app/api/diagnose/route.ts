// AI fault assistant (knowledge-base-driven). Matches a technical problem description against the
// REAL knowledge base (kb_procedures / kb_software) and returns the most relevant verified guidance.
// It never invents steps, commands or thresholds — it only surfaces existing KB content (per the
// survey spec). Free-form LLM analysis would need an API key; until then this is deterministic match.
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireUser } from '@/lib/auth/requireAuth';

// Arabic + latin tokenizer; drop very short tokens and a few stopwords.
const STOP = new Set(['the', 'and', 'في', 'من', 'على', 'الى', 'إلى', 'مع', 'عن', 'هو', 'هي', 'ما', 'لا', 'أو', 'او', 'the', 'is', 'a', 'to', 'of']);
function tokens(s: string): string[] {
    return (s || '').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(w => w.length >= 3 && !STOP.has(w));
}

export async function POST(request: Request) {
    const authed = await requireUser();
    if (!authed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const b = await request.json().catch(() => ({}));
    const problem = (b.problem || '').toString().trim();
    const extra = [b.item_name, b.model, b.os].filter(Boolean).join(' ');
    if (problem.length < 3) return NextResponse.json({ error: 'describe the problem', message: 'صف المشكلة بكلمات أكثر.' }, { status: 400 });

    const qTokens = Array.from(new Set(tokens(`${problem} ${extra}`)));
    if (qTokens.length === 0) return NextResponse.json({ matches: [], software: [], message: 'لم أفهم المشكلة — جرّب كلمات أوضح.' });

    const [{ data: procs }, { data: softs }] = await Promise.all([
        supabaseAdmin.from('kb_procedures').select('code,title_ar,title_en,purpose,categories,models,os_families,instructions,command,expected,interpretation,tier,privilege,est_minutes,data_loss_risk,review_status').is('deleted_at', null),
        supabaseAdmin.from('kb_software').select('name,publisher,purpose,official_source,install_instructions,supported_os,review_status').is('deleted_at', null),
    ]);

    const scoreText = (hay: string) => {
        const h = (hay || '').toLowerCase();
        let s = 0; for (const t of qTokens) if (h.includes(t)) s++;
        return s;
    };

    const scoredProcs = (procs || []).map((p: any) => {
        const hay = [p.title_ar, p.title_en, p.purpose, p.instructions, p.interpretation, (p.categories || []).join(' '), p.models, (p.os_families || []).join(' ')].join(' ');
        return { p, score: scoreText(hay) };
    }).filter(x => x.score > 0).sort((a, b) => b.score - a.score).slice(0, 5);

    const scoredSoft = (softs || []).map((s: any) => {
        const hay = [s.name, s.publisher, s.purpose, s.install_instructions].join(' ');
        return { s, score: scoreText(hay) };
    }).filter(x => x.score > 0).sort((a, b) => b.score - a.score).slice(0, 3);

    const matches = scoredProcs.map(({ p, score }) => ({
        code: p.code, title: p.title_ar || p.title_en, purpose: p.purpose,
        instructions: p.instructions, command: p.command, expected: p.expected,
        tier: p.tier, privilege: p.privilege, est_minutes: p.est_minutes,
        data_loss_risk: p.data_loss_risk, verified: p.review_status === 'verified' || p.review_status === 'approved', score,
    }));
    const software = scoredSoft.map(({ s }) => ({ name: s.name, publisher: s.publisher, purpose: s.purpose, source: s.official_source }));

    return NextResponse.json({
        matches, software,
        message: matches.length
            ? 'أقرب الإجراءات المعتمدة من قاعدة المعرفة لمشكلتك:'
            : 'لم أجد إجراءً مطابقاً في قاعدة المعرفة. افتح تذكرة دعم وأرفق صورة من الموقع، وسيتابعها الدعم الفني.',
    });
}

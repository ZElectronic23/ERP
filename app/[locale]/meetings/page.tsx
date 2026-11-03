'use client';

// Meetings — create, invite, schedule, respond, run (virtual room), and turn outcomes into
// ERP tasks. Virtual rooms default to Jitsi Meet (free/open-source, no credentials); an
// organizer may paste a Google Meet / Zoom / Teams link instead. Each employee sees only the
// meetings they organize or are invited to (plus org/department ones), matching the calendar.
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type Emp = { id: string; name: string };
const MODE: Record<string, { ar: string; en: string }> = { in_person: { ar: 'حضوري', en: 'In-person' }, virtual: { ar: 'افتراضي', en: 'Virtual' }, hybrid: { ar: 'مدمج', en: 'Hybrid' } };
const STATUS: Record<string, { ar: string; en: string; cls: string }> = {
    scheduled: { ar: 'مجدول', en: 'Scheduled', cls: 'bg-sky-500/20 text-sky-300' },
    in_progress: { ar: 'جارٍ الآن', en: 'In progress', cls: 'bg-green-500/20 text-green-300' },
    completed: { ar: 'منتهٍ', en: 'Completed', cls: 'bg-silver/20 text-silver' },
    cancelled: { ar: 'ملغى', en: 'Cancelled', cls: 'bg-red-500/20 text-red-300' },
};
const RESP: Record<string, { ar: string; en: string; cls: string }> = {
    pending: { ar: 'بانتظار الرد', en: 'Pending', cls: 'text-yellow-300' },
    accepted: { ar: 'موافق', en: 'Accepted', cls: 'text-green-300' },
    declined: { ar: 'معتذر', en: 'Declined', cls: 'text-red-300' },
    tentative: { ar: 'ربما', en: 'Tentative', cls: 'text-orange-300' },
};

export default function MeetingsPage() {
    const locale = useLocale(); const isAr = locale === 'ar'; const L = (a: string, e: string) => (isAr ? a : e);
    const router = useRouter();
    const [meetings, setMeetings] = useState<any[]>([]);
    const [me, setMe] = useState('');
    const [emps, setEmps] = useState<Emp[]>([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');
    const [filter, setFilter] = useState<'upcoming' | 'past' | 'all'>('upcoming');
    const [form, setForm] = useState<any | null>(null);   // create/edit form (null = closed)
    const [manage, setManage] = useState<any | null>(null); // manage modal (detail)

    const field = 'w-full bg-black/30 border border-[#DBA935]/20 rounded-lg px-3 py-2 text-sm text-white focus:border-[#DBA935]/60 outline-none';
    const lbl = 'block text-xs text-[#C0C0C0] mb-1';

    const load = useCallback(async () => {
        setLoading(true); setErr('');
        try {
            const res = await fetch('/api/meetings');
            const j = await res.json();
            if (!res.ok) throw new Error(j.message || j.error || 'Error');
            setMeetings(j.meetings || []); setMe(j.employee?.id || '');
        } catch (e: any) { setErr(e.message); }
        setLoading(false);
    }, []);
    useEffect(() => { load(); }, [load]);
    useEffect(() => { supabase.from('employees').select('id:EmployeeID, name:Name').is('deleted_at', null).order('Name').then(({ data }) => setEmps((data as any) || [])); }, []);

    const shown = useMemo(() => {
        const now = Date.now();
        let r = meetings;
        if (filter === 'upcoming') r = meetings.filter(m => !m.end_at ? new Date(m.start_at).getTime() >= now - 36e5 : new Date(m.end_at).getTime() >= now);
        else if (filter === 'past') r = meetings.filter(m => m.end_at ? new Date(m.end_at).getTime() < now : new Date(m.start_at).getTime() < now - 36e5);
        return [...r].sort((a, b) => filter === 'past' ? new Date(b.start_at).getTime() - new Date(a.start_at).getTime() : new Date(a.start_at).getTime() - new Date(b.start_at).getTime());
    }, [meetings, filter]);

    const fmt = (s: string) => s ? new Date(s).toLocaleString(isAr ? 'ar-EG' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '';
    const empName = (id: string) => emps.find(e => e.id === id)?.name || id;

    const newMeeting = () => setForm({ title: '', description: '', start_at: '', end_at: '', mode: 'virtual', provider: 'jitsi', meet_url: '', location: '', visibility: 'invitees', department: '', project_code: '', agenda: [], invitee_ids: [], optional_ids: [] });

    const saveForm = async () => {
        if (!form.title.trim() || !form.start_at) { setErr(L('العنوان ووقت البدء مطلوبان.', 'Title and start time are required.')); return; }
        try {
            const isNew = !form.id;
            const res = await fetch(isNew ? '/api/meetings' : `/api/meetings/${form.id}`, { method: isNew ? 'POST' : 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
            const j = await res.json(); if (!res.ok) throw new Error(j.message || j.error || 'Error');
            setForm(null); load();
        } catch (e: any) { setErr(e.message); }
    };

    const act = async (id: string, body: any) => {
        const res = await fetch(`/api/meetings/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const j = await res.json(); if (!res.ok) { setErr(j.message || j.error); return null; }
        return j;
    };
    const respond = async (id: string, response: string) => { await act(id, { action: 'respond', response }); load(); };
    const setStatus = async (id: string, status: string) => { await act(id, { action: 'status', status }); load(); if (manage?.id === id) openManage(id); };
    const delMeeting = async (id: string) => { if (!confirm(L('إلغاء هذا الاجتماع؟', 'Cancel this meeting?'))) return; await fetch(`/api/meetings/${id}`, { method: 'DELETE' }); setManage(null); load(); };

    const openManage = async (id: string) => {
        const res = await fetch(`/api/meetings/${id}`); const j = await res.json();
        if (!res.ok) { setErr(j.message || j.error); return; }
        setManage({ ...j.meeting, participants: j.participants, is_organizer: j.is_organizer });
    };

    // agenda editing in the create/edit form
    const setAgenda = (arr: any[]) => setForm((f: any) => ({ ...f, agenda: arr }));
    const toggleInvitee = (id: string) => setForm((f: any) => ({ ...f, invitee_ids: f.invitee_ids.includes(id) ? f.invitee_ids.filter((x: string) => x !== id) : [...f.invitee_ids, id] }));
    const toggleOptional = (id: string) => setForm((f: any) => ({ ...f, optional_ids: f.optional_ids.includes(id) ? f.optional_ids.filter((x: string) => x !== id) : [...f.optional_ids, id] }));

    return (
        <div className="min-h-screen p-4 md:p-6" dir={isAr ? 'rtl' : 'ltr'}>
            <div className="bg-black/40 backdrop-blur-sm p-4 md:p-6 rounded-3xl shadow-2xl border border-[#DBA935]/20 max-w-6xl mx-auto">
                <div className="flex flex-wrap justify-between items-center mb-4 gap-3">
                    <div>
                        <h1 className="text-2xl font-bold text-[#DBA935]">{L('الاجتماعات', 'Meetings')}</h1>
                        <p className="text-[#C0C0C0] text-sm mt-1">{L('أنشئ اجتماعاً، ادعُ الزملاء، اجتمع في غرفة افتراضية، وحوّل القرارات إلى مهام.', 'Create a meeting, invite colleagues, meet in a virtual room, and turn decisions into tasks.')}</p>
                    </div>
                    <button onClick={newMeeting} className="px-4 py-2 rounded-xl bg-[#DBA935] text-[#3E3B3F] font-bold hover:bg-[#DBA935]/90 transition text-sm">+ {L('اجتماع جديد', 'New meeting')}</button>
                </div>

                <div className="flex gap-2 mb-4">
                    {(['upcoming', 'past', 'all'] as const).map(k => (
                        <button key={k} onClick={() => setFilter(k)} className={`px-4 py-2 rounded-xl text-sm transition ${filter === k ? 'bg-[#DBA935] text-[#3E3B3F] font-bold' : 'bg-white/5 text-[#C0C0C0] hover:bg-white/10'}`}>
                            {k === 'upcoming' ? L('القادمة', 'Upcoming') : k === 'past' ? L('السابقة', 'Past') : L('الكل', 'All')}
                        </button>
                    ))}
                </div>

                {err && <div className="mb-3 text-red-400 text-sm">{err}</div>}

                {loading ? <div className="text-center py-16 text-[#C0C0C0]">{L('جارٍ التحميل...', 'Loading...')}</div>
                    : shown.length === 0 ? <div className="text-center py-16 text-[#C0C0C0] text-sm">{L('لا اجتماعات.', 'No meetings.')}</div>
                        : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {shown.map(m => {
                                    const mine = m.participants?.find((p: any) => p.employee_id === me);
                                    const accepted = (m.participants || []).filter((p: any) => p.response === 'accepted').length;
                                    return (
                                        <div key={m.id} className="bg-black/30 rounded-xl border border-white/10 p-3">
                                            <div className="flex justify-between items-start gap-2 mb-1">
                                                <span className="text-white font-bold text-sm">{m.title}</span>
                                                <span className={`px-2 py-0.5 rounded-full text-[11px] ${STATUS[m.status]?.cls}`}>{isAr ? STATUS[m.status]?.ar : STATUS[m.status]?.en}</span>
                                            </div>
                                            <div className="text-[#C0C0C0] text-xs space-y-0.5">
                                                <div>🗓 {fmt(m.start_at)}{m.end_at ? ` — ${new Date(m.end_at).toLocaleTimeString(isAr ? 'ar-EG' : 'en-GB', { hour: '2-digit', minute: '2-digit' })}` : ''}</div>
                                                <div>{m.mode === 'in_person' ? '📍' : '💻'} {isAr ? MODE[m.mode]?.ar : MODE[m.mode]?.en}{m.location ? ` · ${m.location}` : ''}</div>
                                                <div>👤 {empName(m.organizer_employee_id)} · 👥 {accepted}/{m.participants?.length || 0} {L('موافق', 'accepted')}</div>
                                            </div>
                                            <div className="flex flex-wrap gap-2 mt-3">
                                                {m.status !== 'cancelled' && (
                                                    <button onClick={() => router.push(`/${locale}/meetings/${m.id}/room`)} className="px-3 py-1.5 rounded-lg bg-green-600/80 text-white text-xs font-bold hover:bg-green-600">🎥 {L('دخول الغرفة', 'Join room')}</button>
                                                )}
                                                <button onClick={() => openManage(m.id)} className="px-3 py-1.5 rounded-lg bg-white/10 text-white text-xs hover:bg-white/20">{m.is_organizer ? L('إدارة', 'Manage') : L('تفاصيل', 'Details')}</button>
                                                {!m.is_organizer && mine && (
                                                    <span className="flex gap-1 items-center">
                                                        {(['accepted', 'tentative', 'declined'] as const).map(r => (
                                                            <button key={r} onClick={() => respond(m.id, r)} className={`px-2 py-1 rounded-lg text-[11px] border ${mine.response === r ? 'bg-[#DBA935]/20 border-[#DBA935]/50 text-white' : 'bg-white/5 border-white/10 text-[#C0C0C0]'}`}>{isAr ? RESP[r].ar : RESP[r].en}</button>
                                                        ))}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
            </div>

            {/* create / edit */}
            {form && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)' }} onClick={() => setForm(null)} dir={isAr ? 'rtl' : 'ltr'}>
                    <div className="bg-[#1a1a1e]/95 rounded-2xl shadow-2xl border border-[#DBA935]/30 w-full max-w-3xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center p-4 border-b border-silver/20 sticky top-0 bg-[#1a1a1e]">
                            <h2 className="text-lg text-[#DBA935]">{form.id ? L('تعديل الاجتماع', 'Edit meeting') : L('اجتماع جديد', 'New meeting')}</h2>
                            <button onClick={() => setForm(null)} className="text-silver p-1 hover:bg-silver/20 rounded">✕</button>
                        </div>
                        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="md:col-span-2"><label className={lbl}>{L('العنوان *', 'Title *')}</label><input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className={field} /></div>
                            <div className="md:col-span-2"><label className={lbl}>{L('الوصف / الهدف', 'Description / purpose')}</label><textarea rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className={field} /></div>
                            <div><label className={lbl}>{L('يبدأ *', 'Starts *')}</label><input type="datetime-local" value={form.start_at} onChange={e => setForm({ ...form, start_at: e.target.value })} className={field} /></div>
                            <div><label className={lbl}>{L('ينتهي', 'Ends')}</label><input type="datetime-local" value={form.end_at} onChange={e => setForm({ ...form, end_at: e.target.value })} className={field} /></div>
                            <div><label className={lbl}>{L('النوع', 'Mode')}</label><select value={form.mode} onChange={e => setForm({ ...form, mode: e.target.value })} className={field}>{Object.keys(MODE).map(k => <option key={k} value={k}>{isAr ? MODE[k].ar : MODE[k].en}</option>)}</select></div>
                            {form.mode !== 'in_person' ? (
                                <div><label className={lbl}>{L('مزوّد الغرفة', 'Room provider')}</label><select value={form.provider} onChange={e => setForm({ ...form, provider: e.target.value })} className={field}><option value="jitsi">{L('غرفة داخلية (Jitsi — مجاني)', 'Built-in room (Jitsi — free)')}</option><option value="google_meet">Google Meet</option><option value="zoom">Zoom</option><option value="teams">Microsoft Teams</option><option value="other">{L('أخرى', 'Other')}</option></select></div>
                            ) : (
                                <div><label className={lbl}>{L('المكان', 'Location')}</label><input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} className={field} /></div>
                            )}
                            {form.mode !== 'in_person' && form.provider !== 'jitsi' && (
                                <div className="md:col-span-2"><label className={lbl}>{L('رابط الاجتماع (الصقه من المزوّد)', 'Meeting link (paste from provider)')}</label><input dir="ltr" value={form.meet_url} onChange={e => setForm({ ...form, meet_url: e.target.value })} placeholder="https://..." className={field} /></div>
                            )}
                            <div><label className={lbl}>{L('من يراه', 'Visibility')}</label><select value={form.visibility} onChange={e => setForm({ ...form, visibility: e.target.value })} className={field}><option value="invitees">{L('المدعوون فقط', 'Invitees only')}</option><option value="department">{L('قسمي', 'My department')}</option><option value="all">{L('كل الموظفين', 'All staff')}</option></select></div>
                            <div><label className={lbl}>{L('كود المشروع (اختياري)', 'Project code (optional)')}</label><input value={form.project_code} onChange={e => setForm({ ...form, project_code: e.target.value })} className={field} /></div>

                            {/* agenda */}
                            <div className="md:col-span-2">
                                <label className={lbl}>{L('أجندة الاجتماع', 'Agenda')}</label>
                                {(form.agenda || []).map((a: any, i: number) => (
                                    <div key={i} className="flex gap-2 mb-1">
                                        <input value={a.text} onChange={e => setAgenda(form.agenda.map((x: any, j: number) => j === i ? { ...x, text: e.target.value } : x))} placeholder={L('بند', 'Item')} className={`${field} flex-1`} />
                                        <input type="number" value={a.minutes ?? ''} onChange={e => setAgenda(form.agenda.map((x: any, j: number) => j === i ? { ...x, minutes: e.target.value } : x))} placeholder={L('دقيقة', 'min')} className={`${field} w-20`} />
                                        <button onClick={() => setAgenda(form.agenda.filter((_: any, j: number) => j !== i))} className="px-2 rounded-lg bg-red-500/20 text-red-300">✕</button>
                                    </div>
                                ))}
                                <button onClick={() => setAgenda([...(form.agenda || []), { text: '', minutes: '' }])} className="text-[#DBA935] text-xs mt-1">+ {L('بند أجندة', 'Agenda item')}</button>
                            </div>

                            {/* invitees */}
                            <div className="md:col-span-2">
                                <label className={lbl}>{L('المدعوون (اضغط للاختيار؛ اضغط مطوّلاً نجمة = اختياري)', 'Invitees (click to select; ☆ = optional)')}</label>
                                <div className="flex flex-wrap gap-1 max-h-40 overflow-y-auto p-1 rounded-lg bg-black/20 border border-white/10">
                                    {emps.filter(e => e.id !== me).map(e => {
                                        const sel = form.invitee_ids.includes(e.id); const opt = form.optional_ids.includes(e.id);
                                        return (
                                            <span key={e.id} className={`text-[11px] px-2 py-1 rounded-full border flex items-center gap-1 ${sel ? 'bg-[#DBA935]/20 border-[#DBA935]/50 text-white' : 'bg-white/5 border-white/10 text-[#C0C0C0]'}`}>
                                                <button onClick={() => toggleInvitee(e.id)}>{e.name}</button>
                                                {sel && <button title={L('اختياري', 'Optional')} onClick={() => toggleOptional(e.id)} className={opt ? 'text-[#DBA935]' : 'text-silver/50'}>{opt ? '★' : '☆'}</button>}
                                            </span>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 p-4 border-t border-silver/20 sticky bottom-0 bg-[#1a1a1e]">
                            <button onClick={() => setForm(null)} className="px-4 py-2 rounded-lg bg-white/10 text-white text-sm hover:bg-white/20">{L('إلغاء', 'Cancel')}</button>
                            <button onClick={saveForm} className="px-4 py-2 rounded-lg bg-[#DBA935] text-[#3E3B3F] font-bold text-sm hover:bg-[#DBA935]/90">{L('حفظ', 'Save')}</button>
                        </div>
                    </div>
                </div>
            )}

            {manage && <ManageModal m={manage} me={me} isAr={isAr} L={L} emps={emps} field={field} lbl={lbl}
                onClose={() => setManage(null)} onReload={() => { load(); openManage(manage.id); }}
                onEdit={() => { setForm({ ...manage, start_at: toLocal(manage.start_at), end_at: toLocal(manage.end_at), invitee_ids: (manage.participants || []).filter((p: any) => p.role !== 'organizer').map((p: any) => p.employee_id), optional_ids: (manage.participants || []).filter((p: any) => p.role === 'optional').map((p: any) => p.employee_id), agenda: manage.agenda || [] }); setManage(null); }}
                onStatus={setStatus} onDelete={delMeeting} onRoom={() => router.push(`/${locale}/meetings/${manage.id}/room`)} />}
        </div>
    );
}

function toLocal(iso: string | null) { if (!iso) return ''; const d = new Date(iso); const p = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; }

// ── Manage / detail modal: participants + admit, minutes/summary, decisions, action items → tasks ──
function ManageModal({ m, me, isAr, L, emps, field, lbl, onClose, onReload, onEdit, onStatus, onDelete, onRoom }: any) {
    const [minutes, setMinutes] = useState(m.minutes || '');
    const [summary, setSummary] = useState(m.summary || '');
    const [decisions, setDecisions] = useState<any[]>(m.decisions || []);
    const [items, setItems] = useState<any[]>(m.action_items || []);
    const [saving, setSaving] = useState(false);
    const empName = (id: string) => emps.find((e: any) => e.id === id)?.name || id;
    const org = m.is_organizer;

    const patch = async (body: any) => { const r = await fetch(`/api/meetings/${m.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); return r.ok ? r.json() : null; };
    const admit = async (eid: string, v: boolean) => { await patch({ action: 'admit', employee_id: eid, admitted: v }); onReload(); };
    const removeP = async (eid: string) => { await patch({ action: 'remove_participant', employee_id: eid }); onReload(); };
    const saveNotes = async () => { setSaving(true); await patch({ action: 'notes', minutes, summary, decisions, action_items: items }); setSaving(false); onReload(); };
    const toTask = async (i: number) => { const j = await patch({ action: 'action_to_task', index: i }); if (j?.task_id) { setItems(items.map((x, k) => k === i ? { ...x, task_id: j.task_id } : x)); } };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)' }} onClick={onClose} dir={isAr ? 'rtl' : 'ltr'}>
            <div className="bg-[#1a1a1e]/95 rounded-2xl shadow-2xl border border-[#DBA935]/30 w-full max-w-3xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center p-4 border-b border-silver/20 sticky top-0 bg-[#1a1a1e]">
                    <div><h2 className="text-lg text-[#DBA935]">{m.title}</h2><p className="text-silver/70 text-xs">{empName(m.organizer_employee_id)} · {new Date(m.start_at).toLocaleString(isAr ? 'ar-EG' : 'en-GB')}</p></div>
                    <button onClick={onClose} className="text-silver p-1 hover:bg-silver/20 rounded">✕</button>
                </div>
                <div className="p-4 space-y-4 text-sm text-[#C0C0C0]">
                    {m.description && <p>{m.description}</p>}
                    <div className="flex flex-wrap gap-2">
                        {m.status !== 'cancelled' && <button onClick={onRoom} className="px-3 py-1.5 rounded-lg bg-green-600/80 text-white text-xs font-bold hover:bg-green-600">🎥 {L('دخول الغرفة', 'Join room')}</button>}
                        {org && <>
                            <button onClick={onEdit} className="px-3 py-1.5 rounded-lg bg-white/10 text-white text-xs hover:bg-white/20">{L('تعديل', 'Edit')}</button>
                            <select value={m.status} onChange={e => onStatus(m.id, e.target.value)} className="bg-black/30 border border-white/10 rounded-lg px-2 py-1 text-xs text-white">
                                <option value="scheduled">{L('مجدول', 'Scheduled')}</option><option value="in_progress">{L('جارٍ الآن', 'In progress')}</option><option value="completed">{L('منتهٍ', 'Completed')}</option><option value="cancelled">{L('ملغى', 'Cancelled')}</option>
                            </select>
                            <button onClick={() => onDelete(m.id)} className="px-3 py-1.5 rounded-lg bg-red-500/20 text-red-300 text-xs hover:bg-red-500/30">{L('إلغاء الاجتماع', 'Cancel meeting')}</button>
                        </>}
                    </div>

                    {/* agenda */}
                    {(m.agenda || []).length > 0 && <div><div className="text-[#DBA935] mb-1">{L('الأجندة', 'Agenda')}</div><ol className="list-decimal ms-5 space-y-0.5">{m.agenda.map((a: any, i: number) => <li key={i}>{a.text}{a.minutes ? ` (${a.minutes} ${L('د', 'min')})` : ''}</li>)}</ol></div>}

                    {/* participants */}
                    <div>
                        <div className="text-[#DBA935] mb-1">{L('المشاركون', 'Participants')} ({m.participants?.length || 0})</div>
                        <div className="space-y-1">
                            {(m.participants || []).map((p: any) => (
                                <div key={p.employee_id} className="flex items-center justify-between gap-2 bg-black/20 rounded-lg px-2 py-1">
                                    <span className="text-white text-xs">{p.name} {p.role === 'organizer' ? '⭐' : p.role === 'optional' ? '☆' : ''}</span>
                                    <span className="flex items-center gap-2">
                                        <span className={`text-[11px] ${RESP[p.response]?.cls}`}>{isAr ? RESP[p.response]?.ar : RESP[p.response]?.en}</span>
                                        {org && p.role !== 'organizer' && <>
                                            <button onClick={() => admit(p.employee_id, !p.admitted)} className={`text-[10px] px-2 py-0.5 rounded-full border ${p.admitted ? 'bg-green-500/20 border-green-500/40 text-green-300' : 'bg-white/5 border-white/10 text-silver'}`}>{p.admitted ? L('مسموح', 'Admitted') : L('سماح بالدخول', 'Admit')}</button>
                                            <button onClick={() => removeP(p.employee_id)} className="text-red-300 text-[11px]">✕</button>
                                        </>}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* minutes + summary (organizer edits; everyone reads) */}
                    <div>
                        <div className="text-[#DBA935] mb-1">{L('محضر الاجتماع', 'Minutes')}</div>
                        {org ? <textarea rows={3} value={minutes} onChange={e => setMinutes(e.target.value)} className={field} placeholder={L('ما دار في الاجتماع...', 'What was discussed...')} />
                            : <p className="whitespace-pre-wrap text-white/80">{minutes || '—'}</p>}
                    </div>
                    <div>
                        <div className="text-[#DBA935] mb-1">{L('الملخص', 'Summary')}</div>
                        {org ? <textarea rows={2} value={summary} onChange={e => setSummary(e.target.value)} className={field} />
                            : <p className="whitespace-pre-wrap text-white/80">{summary || '—'}</p>}
                    </div>

                    {/* decisions */}
                    <div>
                        <div className="text-[#DBA935] mb-1">{L('القرارات', 'Decisions')}</div>
                        {(org ? decisions : (m.decisions || [])).map((d: any, i: number) => (
                            <div key={i} className="flex gap-2 mb-1 items-center">
                                {org ? <input value={d.text} onChange={e => setDecisions(decisions.map((x, j) => j === i ? { text: e.target.value } : x))} className={`${field} flex-1`} />
                                    : <span className="text-white/80">• {d.text}</span>}
                                {org && <button onClick={() => setDecisions(decisions.filter((_, j) => j !== i))} className="text-red-300">✕</button>}
                            </div>
                        ))}
                        {org && <button onClick={() => setDecisions([...decisions, { text: '' }])} className="text-[#DBA935] text-xs">+ {L('قرار', 'Decision')}</button>}
                    </div>

                    {/* action items → tasks */}
                    <div>
                        <div className="text-[#DBA935] mb-1">{L('بنود العمل (تتحوّل لمهام)', 'Action items (become tasks)')}</div>
                        {(org ? items : (m.action_items || [])).map((a: any, i: number) => (
                            <div key={i} className="bg-black/20 rounded-lg p-2 mb-2">
                                {org ? <>
                                    <input value={a.text} onChange={e => setItems(items.map((x, j) => j === i ? { ...x, text: e.target.value } : x))} placeholder={L('المطلوب عمله', 'What needs doing')} className={`${field} mb-1`} />
                                    <div className="flex flex-wrap gap-2">
                                        <select value={a.assignee_employee_id || ''} onChange={e => setItems(items.map((x, j) => j === i ? { ...x, assignee_employee_id: e.target.value } : x))} className="bg-black/30 border border-white/10 rounded-lg px-2 py-1 text-xs text-white">
                                            <option value="">{L('المسؤول', 'Assignee')}</option>{emps.map((e: any) => <option key={e.id} value={e.id}>{e.name}</option>)}
                                        </select>
                                        <input type="date" value={a.due || ''} onChange={e => setItems(items.map((x, j) => j === i ? { ...x, due: e.target.value } : x))} className="bg-black/30 border border-white/10 rounded-lg px-2 py-1 text-xs text-white" />
                                        <select value={a.priority || 'medium'} onChange={e => setItems(items.map((x, j) => j === i ? { ...x, priority: e.target.value } : x))} className="bg-black/30 border border-white/10 rounded-lg px-2 py-1 text-xs text-white">
                                            <option value="low">{L('منخفضة', 'Low')}</option><option value="medium">{L('متوسطة', 'Medium')}</option><option value="high">{L('عالية', 'High')}</option>
                                        </select>
                                        {a.task_id ? <span className="text-green-300 text-[11px] px-2 py-1">✓ {a.task_id}</span>
                                            : <button onClick={() => toTask(i)} className="text-[11px] px-2 py-1 rounded-lg bg-[#DBA935]/20 text-[#DBA935] border border-[#DBA935]/40">↪ {L('حوّل لمهمة', 'To task')}</button>}
                                        <button onClick={() => setItems(items.filter((_, j) => j !== i))} className="text-red-300 text-[11px]">✕</button>
                                    </div>
                                </> : <div className="flex justify-between"><span className="text-white/80">• {a.text}{a.assignee_employee_id ? ` — ${empName(a.assignee_employee_id)}` : ''}</span>{a.task_id && <span className="text-green-300 text-[11px]">✓ {a.task_id}</span>}</div>}
                            </div>
                        ))}
                        {org && <button onClick={() => setItems([...items, { text: '', priority: 'medium' }])} className="text-[#DBA935] text-xs">+ {L('بند عمل', 'Action item')}</button>}
                        <p className="text-silver/50 text-[11px] mt-1">{L('«حوّل لمهمة» ينشئ مهمة في نظام المهام باعتماد المنظّم (الحالة: بانتظار الاعتماد).', '“To task” creates a task in the task system on organizer approval (status: pending approval).')}</p>
                    </div>
                </div>
                {org && <div className="flex justify-end gap-2 p-4 border-t border-silver/20 sticky bottom-0 bg-[#1a1a1e]">
                    <button onClick={saveNotes} disabled={saving} className="px-4 py-2 rounded-lg bg-[#DBA935] text-[#3E3B3F] font-bold text-sm hover:bg-[#DBA935]/90 disabled:opacity-50">{saving ? L('جارٍ الحفظ...', 'Saving...') : L('حفظ المحضر والقرارات', 'Save minutes & decisions')}</button>
                </div>}
            </div>
        </div>
    );
}

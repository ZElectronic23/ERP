'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useLocale } from 'next-intl';
import { supabase } from '@/lib/supabaseClient';
import ApprovalPanel from '@/components/ApprovalPanel';
import GeofenceEditor from '@/components/attendance/GeofenceEditor';

const ATT_STATUS: Record<string, { ar: string; en: string; cls: string }> = {
    present: { ar: 'حاضر', en: 'Present', cls: 'text-green-400' },
    absent: { ar: 'غائب', en: 'Absent', cls: 'text-red-400' },
    leave: { ar: 'إجازة', en: 'Leave', cls: 'text-blue-400' },
    late: { ar: 'متأخر', en: 'Late', cls: 'text-yellow-400' },
    holiday: { ar: 'عطلة', en: 'Holiday', cls: 'text-silver' },
};
const LEAVE_TYPE: Record<string, { ar: string; en: string }> = {
    annual: { ar: 'سنوية', en: 'Annual' }, sick: { ar: 'مرضية', en: 'Sick' },
    unpaid: { ar: 'بدون راتب', en: 'Unpaid' }, emergency: { ar: 'طارئة', en: 'Emergency' },
};
const LEAVE_STATUS: Record<string, { ar: string; en: string; cls: string }> = {
    pending: { ar: 'معلّق', en: 'Pending', cls: 'bg-gray-500/20 text-gray-300' },
    approved: { ar: 'معتمد', en: 'Approved', cls: 'bg-green-500/20 text-green-400' },
    rejected: { ar: 'مرفوض', en: 'Rejected', cls: 'bg-red-500/20 text-red-400' },
};
const daysBetween = (a: string, b: string) => {
    if (!a || !b) return 0;
    const d = Math.floor((new Date(b).getTime() - new Date(a).getTime()) / 86400000) + 1;
    return d > 0 ? d : 0;
};

export default function HRPage() {
    const locale = useLocale();
    const isAr = locale === 'ar';
    const L = (ar: string, en: string) => (isAr ? ar : en);

    const [tab, setTab] = useState<'attendance' | 'leaves' | 'geofence'>('attendance');
    const [emps, setEmps] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCEO, setIsCEO] = useState(false);

    // attendance
    const [attDate, setAttDate] = useState(new Date().toISOString().slice(0, 10));
    const [att, setAtt] = useState<Record<string, { status: string; check_in: string; check_out: string }>>({});
    const [savingAtt, setSavingAtt] = useState(false);
    const [attMsg, setAttMsg] = useState('');

    // leaves
    const [leaves, setLeaves] = useState<any[]>([]);
    const [showDeleted, setShowDeleted] = useState(false);
    const [showLeave, setShowLeave] = useState(false);
    const [savingLeave, setSavingLeave] = useState(false);
    const emptyLeave = { employee_id: '', leave_type: 'annual', start_date: '', end_date: '', reason: '' };
    const [leaveForm, setLeaveForm] = useState<typeof emptyLeave>(emptyLeave);
    const [lvApproval, setLvApproval] = useState<any | null>(null);

    useEffect(() => {
        (async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const { data } = await supabase.from('users').select('role_key').eq('email', user.email).maybeSingle();
            setIsCEO((data?.role_key || '').toLowerCase() === 'ceo');
        })();
    }, []);

    const loadEmps = useCallback(async () => {
        const { data } = await supabase.from('employees').select('EmployeeID, Name, LeaveBalance').is('deleted_at', null).eq('IsActive', true).order('Name');
        setEmps(data || []);
    }, []);

    const loadAtt = useCallback(async () => {
        const { data } = await supabase.from('attendance').select('*').eq('work_date', attDate);
        const map: Record<string, any> = {};
        (data || []).forEach((r: any) => { map[r.employee_id] = { status: r.status || 'present', check_in: r.check_in || '', check_out: r.check_out || '' }; });
        setAtt(map);
    }, [attDate]);

    const loadLeaves = useCallback(async () => {
        let q = supabase.from('leave_requests').select('*').order('created_at', { ascending: false });
        q = showDeleted ? q.not('deleted_at', 'is', null) : q.is('deleted_at', null);
        const { data } = await q;
        setLeaves(data || []);
    }, [showDeleted]);

    useEffect(() => { (async () => { setLoading(true); await loadEmps(); await loadAtt(); await loadLeaves(); setLoading(false); })(); }, [loadEmps, loadAtt, loadLeaves]);

    const setAttFor = (id: string, patch: any) => setAtt(prev => {
        const cur = prev[id] || { status: 'present', check_in: '', check_out: '' };
        return { ...prev, [id]: { ...cur, ...patch } };
    });

    const saveAttendance = async () => {
        setSavingAtt(true); setAttMsg('');
        const rows = emps.map(e => ({
            employee_id: e.EmployeeID, employee_name: e.Name, work_date: attDate,
            status: att[e.EmployeeID]?.status || 'present',
            check_in: att[e.EmployeeID]?.check_in || null, check_out: att[e.EmployeeID]?.check_out || null,
            updated_at: new Date().toISOString(),
        }));
        const { error } = await supabase.from('attendance').upsert(rows, { onConflict: 'employee_id,work_date' });
        setSavingAtt(false);
        setAttMsg(error ? error.message : L('تم حفظ الحضور ✓', 'Attendance saved ✓'));
    };

    const leaveDays = useMemo(() => daysBetween(leaveForm.start_date, leaveForm.end_date), [leaveForm.start_date, leaveForm.end_date]);

    const saveLeave = async () => {
        if (!leaveForm.employee_id || leaveDays <= 0) return;
        setSavingLeave(true);
        const name = emps.find(e => e.EmployeeID === leaveForm.employee_id)?.Name || '';
        const { error } = await supabase.from('leave_requests').insert([{
            employee_id: leaveForm.employee_id, employee_name: name, leave_type: leaveForm.leave_type,
            start_date: leaveForm.start_date, end_date: leaveForm.end_date, days: leaveDays,
            reason: leaveForm.reason || null, status: 'pending', created_at: new Date().toISOString(),
        }]);
        setSavingLeave(false);
        if (error) { alert(error.message); return; }
        setShowLeave(false); setLeaveForm(emptyLeave); loadLeaves();
    };

    const softDelLeave = async (id: string) => {
        if (!confirm(L('نقل الطلب للمحذوفات؟', 'Move request to trash?'))) return;
        await supabase.from('leave_requests').update({ deleted_at: new Date().toISOString() }).eq('id', id); loadLeaves();
    };
    const restoreLeave = async (id: string) => { await supabase.from('leave_requests').update({ deleted_at: null }).eq('id', id); loadLeaves(); };
    const hardDelLeave = async (id: string) => {
        if (!confirm(L('حذف نهائي لا يمكن التراجع عنه. متأكد؟', 'Permanent delete? Sure?'))) return;
        const { error } = await supabase.from('leave_requests').delete().eq('id', id);
        if (!error) loadLeaves(); else alert(error.message);
    };

    const field = 'px-3 py-2 bg-[#0a0a0c] border border-silver/30 rounded-lg text-white text-sm focus:outline-none focus:border-gold';
    const fieldW = `w-full ${field}`;

    return (
        <div className="min-h-screen p-4 md:p-6" dir={isAr ? 'rtl' : 'ltr'}>
            <div className="bg-black/40 backdrop-blur-sm p-4 md:p-6 rounded-3xl shadow-2xl border border-[#DBA935]/20 max-w-6xl mx-auto">
                <div className="flex flex-wrap justify-between items-center mb-4 gap-3">
                    <h1 className="text-2xl font-bold text-[#DBA935]">{L('شؤون الموظفين (HR)', 'Human Resources')}</h1>
                    {tab === 'leaves' && (
                        <div className="flex gap-2">
                            <button onClick={() => setShowDeleted(v => !v)} className="px-4 py-2 rounded-xl bg-white/5 text-[#C0C0C0] border border-silver/20 hover:bg-white/10 transition text-sm">{showDeleted ? L('النشطة', 'Active') : L('المحذوفات', 'Trash')}</button>
                            {!showDeleted && <button onClick={() => { setLeaveForm(emptyLeave); setShowLeave(true); }} className="px-5 py-2 rounded-xl bg-[#DBA935] text-[#3E3B3F] font-bold hover:bg-[#DBA935]/90 transition text-sm">{L('+ طلب إجازة', '+ New Leave')}</button>}
                        </div>
                    )}
                    {tab === 'attendance' && (
                        <div className="flex items-center gap-2">
                            <input type="date" value={attDate} onChange={e => setAttDate(e.target.value)} className={field} />
                            <button onClick={saveAttendance} disabled={savingAtt} className="px-5 py-2 rounded-xl bg-[#DBA935] text-[#3E3B3F] font-bold hover:bg-[#DBA935]/90 transition text-sm disabled:opacity-50">{savingAtt ? L('جارٍ الحفظ...', 'Saving...') : L('حفظ الحضور', 'Save attendance')}</button>
                        </div>
                    )}
                </div>

                <div className="flex gap-2 mb-4">
                    {(['attendance', 'leaves', 'geofence'] as const).map(tt => (
                        <button key={tt} onClick={() => setTab(tt)} className={`px-4 py-2 rounded-xl text-sm font-medium transition ${tab === tt ? 'bg-[#DBA935] text-[#3E3B3F]' : 'bg-white/5 text-[#C0C0C0] hover:bg-white/10'}`}>
                            {tt === 'attendance' ? L('الحضور والانصراف', 'Attendance') : tt === 'leaves' ? L('الإجازات', 'Leaves') : L('محيط البصمة (خريطة)', 'Punch geofence (map)')}
                        </button>
                    ))}
                </div>

                {attMsg && tab === 'attendance' && <div className="mb-3 text-sm text-gold">{attMsg}</div>}

                {tab === 'geofence' ? <GeofenceEditor /> : loading ? <div className="text-center py-10 text-[#C0C0C0]">{L('جارٍ التحميل...', 'Loading...')}</div> : tab === 'attendance' ? (
                    <div className="overflow-x-auto rounded-xl border border-[#3E3B3F]">
                        <table className="w-full text-sm" style={{ minWidth: '680px' }}>
                            <thead><tr className="bg-[#242428] text-[#DBA935]/90">
                                {[L('الموظف', 'Employee'), L('الحالة', 'Status'), L('الحضور', 'Check-in'), L('الانصراف', 'Check-out')].map((h, i) => <th key={i} className="py-2.5 px-3 text-start font-semibold border-b border-[#DBA935]/20 whitespace-nowrap">{h}</th>)}
                            </tr></thead>
                            <tbody>
                                {emps.length === 0 ? <tr><td colSpan={4} className="text-center py-8 text-[#C0C0C0]">{L('لا يوجد موظفون نشطون', 'No active employees')}</td></tr>
                                    : emps.map(e => {
                                        const a = att[e.EmployeeID] || { status: 'present', check_in: '', check_out: '' };
                                        return (
                                            <tr key={e.EmployeeID} className="odd:bg-white/[0.02] border-b border-[#3E3B3F]/60 text-white">
                                                <td className="py-2 px-3 whitespace-nowrap">{e.Name}</td>
                                                <td className="py-2 px-3"><select value={a.status} onChange={ev => setAttFor(e.EmployeeID, { status: ev.target.value })} className={`${field} py-1 ${ATT_STATUS[a.status]?.cls || ''}`}>{Object.entries(ATT_STATUS).map(([k, v]) => <option key={k} value={k}>{isAr ? v.ar : v.en}</option>)}</select></td>
                                                <td className="py-2 px-3"><input type="time" value={a.check_in} onChange={ev => setAttFor(e.EmployeeID, { check_in: ev.target.value })} className={`${field} py-1`} /></td>
                                                <td className="py-2 px-3"><input type="time" value={a.check_out} onChange={ev => setAttFor(e.EmployeeID, { check_out: ev.target.value })} className={`${field} py-1`} /></td>
                                            </tr>
                                        );
                                    })}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="overflow-x-auto rounded-xl border border-[#3E3B3F]">
                        <table className="w-full text-sm" style={{ minWidth: '820px' }}>
                            <thead><tr className="bg-[#242428] text-[#DBA935]/90">
                                {[L('الموظف', 'Employee'), L('النوع', 'Type'), L('من', 'From'), L('إلى', 'To'), L('الأيام', 'Days'), L('الحالة', 'Status'), L('الإجراءات', 'Actions')].map((h, i) => <th key={i} className="py-2.5 px-3 text-start font-semibold border-b border-[#DBA935]/20 whitespace-nowrap">{h}</th>)}
                            </tr></thead>
                            <tbody>
                                {leaves.length === 0 ? <tr><td colSpan={7} className="text-center py-8 text-[#C0C0C0]">{L('لا توجد طلبات', 'No requests')}</td></tr>
                                    : leaves.map(lv => {
                                        const st = LEAVE_STATUS[lv.status] || LEAVE_STATUS.pending;
                                        return (
                                            <tr key={lv.id} className="odd:bg-white/[0.02] border-b border-[#3E3B3F]/60 text-white">
                                                <td className="py-2 px-3 whitespace-nowrap">{lv.employee_name}</td>
                                                <td className="py-2 px-3 whitespace-nowrap">{isAr ? LEAVE_TYPE[lv.leave_type]?.ar : LEAVE_TYPE[lv.leave_type]?.en}</td>
                                                <td className="py-2 px-3 whitespace-nowrap">{lv.start_date}</td>
                                                <td className="py-2 px-3 whitespace-nowrap">{lv.end_date}</td>
                                                <td className="py-2 px-3 whitespace-nowrap">{lv.days}</td>
                                                <td className="py-2 px-3 whitespace-nowrap"><span className={`px-2 py-0.5 rounded-full text-xs ${st.cls}`}>{isAr ? st.ar : st.en}</span></td>
                                                <td className="py-2 px-3 whitespace-nowrap">
                                                    <span className="inline-flex items-center gap-2">
                                                        {showDeleted ? (<>
                                                            <button onClick={() => restoreLeave(lv.id)} className="text-green-400 hover:underline">{L('استعادة', 'Restore')}</button>
                                                            {isCEO && <button onClick={() => hardDelLeave(lv.id)} className="text-red-700 hover:text-red-500 font-semibold">{L('حذف نهائي', 'Delete')}</button>}
                                                        </>) : (<>
                                                            <button onClick={() => setLvApproval(lv)} className="text-[#DBA935] hover:underline">{L('الاعتماد', 'Approvals')}</button>
                                                            <button onClick={() => softDelLeave(lv.id)} className="text-red-400 hover:underline">{L('حذف', 'Delete')}</button>
                                                        </>)}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {showLeave && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }} onClick={() => setShowLeave(false)} dir={isAr ? 'rtl' : 'ltr'}>
                    <div className="bg-[#1a1a1e]/95 backdrop-blur-md rounded-2xl shadow-2xl border border-gold/30 w-full max-w-lg" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center p-5 border-b border-silver/20">
                            <h2 className="text-lg font-alata text-gold">{L('طلب إجازة جديد', 'New Leave Request')}</h2>
                            <button onClick={() => setShowLeave(false)} className="text-silver p-1 hover:bg-silver/20 rounded">✕</button>
                        </div>
                        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="sm:col-span-2"><label className="block text-silver mb-1 text-xs">{L('الموظف', 'Employee')} *</label>
                                <select value={leaveForm.employee_id} onChange={e => setLeaveForm({ ...leaveForm, employee_id: e.target.value })} className={fieldW}><option value="">{L('— اختر —', '— select —')}</option>{emps.map(e => <option key={e.EmployeeID} value={e.EmployeeID}>{e.Name}{e.LeaveBalance != null ? ` (${L('الرصيد', 'balance')}: ${e.LeaveBalance})` : ''}</option>)}</select>
                            </div>
                            <div><label className="block text-silver mb-1 text-xs">{L('نوع الإجازة', 'Leave type')}</label>
                                <select value={leaveForm.leave_type} onChange={e => setLeaveForm({ ...leaveForm, leave_type: e.target.value })} className={fieldW}>{Object.entries(LEAVE_TYPE).map(([k, v]) => <option key={k} value={k}>{isAr ? v.ar : v.en}</option>)}</select>
                            </div>
                            <div><label className="block text-silver mb-1 text-xs">{L('عدد الأيام', 'Days')}</label><input value={leaveDays} readOnly className={`${fieldW} opacity-70`} /></div>
                            <div><label className="block text-silver mb-1 text-xs">{L('من', 'From')} *</label><input type="date" value={leaveForm.start_date} onChange={e => setLeaveForm({ ...leaveForm, start_date: e.target.value })} className={fieldW} /></div>
                            <div><label className="block text-silver mb-1 text-xs">{L('إلى', 'To')} *</label><input type="date" value={leaveForm.end_date} onChange={e => setLeaveForm({ ...leaveForm, end_date: e.target.value })} className={fieldW} /></div>
                            <div className="sm:col-span-2"><label className="block text-silver mb-1 text-xs">{L('السبب', 'Reason')}</label><textarea value={leaveForm.reason} onChange={e => setLeaveForm({ ...leaveForm, reason: e.target.value })} rows={2} className={fieldW} /></div>
                            <div className="sm:col-span-2 flex gap-3 pt-1">
                                <button onClick={saveLeave} disabled={savingLeave || !leaveForm.employee_id || leaveDays <= 0} className="flex-1 px-4 py-2 bg-gold text-darkwhite rounded-lg font-bold hover:bg-yellow-600 transition disabled:opacity-50">{savingLeave ? L('جارٍ الحفظ...', 'Saving...') : L('إرسال الطلب', 'Submit')}</button>
                                <button onClick={() => setShowLeave(false)} className="flex-1 px-4 py-2 bg-silver/10 rounded-lg text-silver hover:bg-silver/20 transition">{L('إلغاء', 'Cancel')}</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {lvApproval && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)' }} onClick={() => { setLvApproval(null); loadLeaves(); loadEmps(); }} dir={isAr ? 'rtl' : 'ltr'}>
                    <div className="bg-[#1a1a1e]/95 backdrop-blur-md rounded-2xl shadow-2xl border border-gold/30 w-full max-w-lg max-h-[88vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center p-5 border-b border-silver/20">
                            <div>
                                <h2 className="text-lg font-alata text-gold">{L('اعتماد طلب الإجازة', 'Leave approval')}</h2>
                                <p className="text-silver/70 text-xs mt-0.5">{lvApproval.employee_name} — {lvApproval.days} {L('يوم', 'days')} ({isAr ? LEAVE_TYPE[lvApproval.leave_type]?.ar : LEAVE_TYPE[lvApproval.leave_type]?.en})</p>
                            </div>
                            <button onClick={() => { setLvApproval(null); loadLeaves(); loadEmps(); }} className="text-silver p-1 hover:bg-silver/20 rounded">✕</button>
                        </div>
                        <div className="p-5">
                            <ApprovalPanel entityType="leave" entityId={lvApproval.id} locale={locale} onStatusChange={() => { loadLeaves(); loadEmps(); }} />
                            <p className="text-silver/50 text-[11px] mt-3">{L('عند اكتمال الاعتماد يُخصم الرصيد تلقائياً (للإجازة السنوية). الرفض يتطلب سبباً ويُسجَّل.', 'On full approval the balance is auto-deducted (annual). Rejection requires a reason and is logged.')}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

'use client';

import { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { supabase } from '@/lib/supabaseClient';
import ApprovalPanel from '@/components/ApprovalPanel';
import JourneyStrip from '@/components/JourneyStrip';
import { PROJECT_TYPES, suggestionsFor, qualityFor, METHODOLOGIES, methodologyPhases } from '@/lib/projects/templates';

const CATEGORIES = [
    { key: 'labor', ar: 'عمالة', en: 'Labor' },
    { key: 'engineer', ar: 'مهندسين', en: 'Engineers' },
    { key: 'material_essential', ar: 'خامات أساسية', en: 'Essential materials' },
    { key: 'material_complementary', ar: 'خامات مكملة', en: 'Complementary materials' },
    { key: 'equipment', ar: 'معدات', en: 'Equipment' },
    { key: 'subcontract', ar: 'مقاول باطن', en: 'Subcontract' },
    { key: 'time', ar: 'وقت/مدة', en: 'Time' },
    { key: 'other', ar: 'أخرى', en: 'Other' },
];

interface PlanItem {
    id: string; category: string; item_name: string; unit: string; quantity: number;
    unit_cost: number; risk_pct: number; is_essential: boolean; quality_criteria: string;
    duration_days: number | null; notes: string; sort_order: number;
    item_type?: string; item_ref?: string | null; sell_price?: number;
}
const lineCost = (it: PlanItem) => (Number(it.quantity) || 0) * (Number(it.unit_cost) || 0) * (1 + (Number(it.risk_pct) || 0) / 100);

type Tab = 'charter' | 'plan' | 'schedule' | 'risks' | 'stakeholders' | 'procurement' | 'exec' | 'closure';
const uid = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
const LVL = (v: string, ar: boolean) => ({ low: ar ? 'منخفض' : 'Low', medium: ar ? 'متوسط' : 'Medium', high: ar ? 'عالٍ' : 'High' }[v] || v);

export default function ProjectDetailPage({ params }: { params: Promise<{ code: string }> }) {
    const { code } = use(params);
    const router = useRouter();
    const locale = useLocale();
    const isAr = locale === 'ar';
    const L = (ar: string, en: string) => (isAr ? ar : en);

    const [tab, setTab] = useState<Tab>('charter');
    const [project, setProject] = useState<any>(null);
    const [clients, setClients] = useState<any[]>([]);
    const [employees, setEmployees] = useState<any[]>([]);
    const [items, setItems] = useState<PlanItem[]>([]);
    const [loadedIds, setLoadedIds] = useState<string[]>([]);
    const [profitMargin, setProfitMargin] = useState(20);
    const [taxRate, setTaxRate] = useState(14);
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState('');
    const [loading, setLoading] = useState(true);

    const [milestones, setMilestones] = useState<any[]>([]);
    const [risks, setRisks] = useState<any[]>([]);
    const [stakeholders, setStakeholders] = useState<any[]>([]);
    const [procurements, setProcurements] = useState<any[]>([]);
    const [tasks, setTasks] = useState<any[]>([]);
    const [newTask, setNewTask] = useState({ name: '', employeeId: '', external: '', priority: 'medium' });
    const [newProc, setNewProc] = useState({ kind: 'material', item: '', quantity: '1', estimated_cost: '', requested_by: '', needed_by: '' });
    const [allPartners, setAllPartners] = useState<any[]>([]);
    const [projPartners, setProjPartners] = useState<any[]>([]);
    const [newPP, setNewPP] = useState({ partner: '', role: '', share: '' });
    const [procApproval, setProcApproval] = useState<any | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        const [{ data: proj }, { data: cls }, { data: emps }, { data: pItems }, { data: tsk }, { data: ms }, { data: rk }, { data: sh }, { data: pc }, { data: aps }, { data: pps }] = await Promise.all([
            supabase.from('projects').select('*').eq('ProjectCode', code).maybeSingle(),
            supabase.from('clients').select('ClientId, ClientName').is('deleted_at', null),
            supabase.from('employees').select('id:EmployeeID, name:Name').is('deleted_at', null).order('Name'),
            supabase.from('project_plan_items').select('*').eq('project_code', code).is('deleted_at', null).order('sort_order'),
            supabase.from('tasks').select('*').eq('ProjectID', code).is('deleted_at', null).order('created_at', { ascending: false }),
            supabase.from('project_milestones').select('*').eq('project_code', code).order('sort_order'),
            supabase.from('project_risks').select('*').eq('project_code', code).order('sort_order'),
            supabase.from('project_stakeholders').select('*').eq('project_code', code).order('sort_order'),
            supabase.from('project_procurements').select('*').eq('project_code', code).is('deleted_at', null).order('created_at', { ascending: false }),
            supabase.from('partners').select('PartnerID, PartnerName, Role, SharePercentage, IsFinancialPartner, IsTechnicalPartner').is('deleted_at', null),
            supabase.from('project_partners').select('*').eq('project_code', code),
        ]);
        setProject(proj);
        setCustomType(!!proj?.ProjectType && !PROJECT_TYPES.some(t => t.ar === proj.ProjectType || t.en === proj.ProjectType));
        setClients(cls || []);
        setEmployees(emps || []);
        setAllPartners(aps || []);
        setProjPartners(pps || []);
        const its = (pItems || []).map((r: any) => ({ ...r, quantity: Number(r.quantity), unit_cost: Number(r.unit_cost), risk_pct: Number(r.risk_pct) })) as PlanItem[];
        setItems(its); setLoadedIds(its.map(i => i.id));
        setTasks(tsk || []); setMilestones(ms || []); setRisks(rk || []); setStakeholders(sh || []); setProcurements(pc || []);
        if (proj?.ProfitMargin != null) setProfitMargin(Number(proj.ProfitMargin) * (Number(proj.ProfitMargin) <= 1 ? 100 : 1));
        if (proj?.TaxRate != null) setTaxRate(Number(proj.TaxRate) * (Number(proj.TaxRate) <= 1 ? 100 : 1));
        setLoading(false);
    }, [code]);

    useEffect(() => { load(); }, [load]);

    const clientName = (id: string | null) => clients.find(c => c.ClientId === id)?.ClientName || '—';
    const empName = (id: string | null) => employees.find(e => e.id === id)?.name || '';

    const addItem = () => setItems(prev => [...prev, { id: uid(), category: 'material_essential', item_name: '', unit: '', quantity: 1, unit_cost: 0, risk_pct: 0, is_essential: true, quality_criteria: '', duration_days: null, notes: '', sort_order: prev.length, item_type: 'manual', item_ref: null, sell_price: 0 }]);

    // ── catalog picker: pull cost/price from products & services ──
    const [catSearch, setCatSearch] = useState('');
    const [catResults, setCatResults] = useState<any[]>([]);
    const [catOpen, setCatOpen] = useState(false);
    // Full catalog (names + cost/price) powering the per-row item <datalist> ("choose or type your own").
    const [catalogAll, setCatalogAll] = useState<any[]>([]);
    const [customType, setCustomType] = useState(false);
    const [calMonth, setCalMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
    useEffect(() => {
        (async () => {
            try {
                const res = await fetch('/api/documents/items?type=all&limit=1000');
                const data = await res.json();
                setCatalogAll(data.items || []);
            } catch { /* datalist stays empty; manual entry still works */ }
        })();
    }, []);
    const searchCatalog = async (q: string) => {
        setCatSearch(q);
        if (!q.trim()) { setCatResults([]); return; }
        try {
            const res = await fetch(`/api/documents/items?search=${encodeURIComponent(q)}&type=all&limit=20`);
            const data = await res.json();
            setCatResults(data.items || []); setCatOpen(true);
        } catch { setCatResults([]); }
    };
    const addFromCatalog = (c: any) => {
        const cost = Number(c.cost_price) || Number(c.direct_cost) || 0;
        const cat = c.item_type === 'service' ? 'subcontract' : 'material_essential';
        setItems(prev => [...prev, {
            id: uid(), category: cat, item_name: c.name, unit: c.unit || '', quantity: 1,
            unit_cost: cost, risk_pct: 0, is_essential: true, quality_criteria: '', duration_days: null,
            notes: '', sort_order: prev.length, item_type: c.item_type, item_ref: c.id, sell_price: Number(c.sell_price) || Number(c.target_price) || 0,
        }]);
        setCatSearch(''); setCatResults([]); setCatOpen(false);
    };
    const updItem = (id: string, patch: Partial<PlanItem>) => setItems(prev => prev.map(it => it.id === id ? { ...it, ...patch } : it));
    const delItem = (id: string) => setItems(prev => prev.filter(it => it.id !== id));

    // When the item name matches a catalog entry, pull its price/unit so "choose from list" also prices the row.
    // Also auto-fill a quality criterion from the row's category when it's still empty.
    const onItemNameChange = (id: string, name: string) => {
        const match = catalogAll.find((c: any) => (c.name || '').trim() === name.trim());
        setItems(prev => prev.map(it => {
            if (it.id !== id) return it;
            const quality = it.quality_criteria?.trim() ? it.quality_criteria : qualityFor(it.category, isAr);
            if (match) {
                const cost = Number(match.cost_price) || Number(match.direct_cost) || 0;
                return { ...it, item_name: name, unit: match.unit || it.unit, unit_cost: cost, item_type: match.item_type, item_ref: match.id, sell_price: Number(match.sell_price) || Number(match.target_price) || 0, quality_criteria: quality };
            }
            return { ...it, item_name: name, item_type: 'manual', item_ref: null, quality_criteria: quality };
        }));
    };
    // Changing the category refreshes the auto quality criterion if the user hasn't customized it.
    const onItemCategoryChange = (id: string, category: string) => {
        setItems(prev => prev.map(it => {
            if (it.id !== id) return it;
            const wasAuto = !it.quality_criteria?.trim() || it.quality_criteria === qualityFor(it.category, isAr);
            return { ...it, category, quality_criteria: wasAuto ? qualityFor(category, isAr) : it.quality_criteria };
        }));
    };

    // Append editable suggestions (plan items / milestones / risks) for the current project type.
    // Nothing is saved until the user presses the section's Save — they can edit/remove first.
    const suggestItems = () => {
        const pack = suggestionsFor(project?.ProjectType);
        setItems(prev => [...prev, ...pack.items.map((s, i) => ({
            id: uid(), category: s.category, item_name: isAr ? s.ar : s.en, unit: '', quantity: 1, unit_cost: 0,
            risk_pct: 0, is_essential: s.category !== 'material_complementary', quality_criteria: qualityFor(s.category, isAr), duration_days: null,
            notes: L('مقترح تلقائي — راجع السعر والكمية', 'Auto-suggested — review price & qty'), sort_order: prev.length + i,
            item_type: 'manual', item_ref: null, sell_price: 0,
        }))]);
        setMsg(L('أُضيفت بنود مقترحة — عدّلها ثم احفظ', 'Suggested items added — edit then save'));
    };
    const suggestMilestones = () => {
        // Prefer the chosen methodology's phases; otherwise fall back to the project-type milestones.
        const mphases = methodologyPhases(project?.methodology);
        const list = mphases || suggestionsFor(project?.ProjectType).milestones;
        setMilestones(prev => [...prev, ...list.map((s, i) => ({ id: uid(), name: isAr ? s.ar : s.en, phase: mphases ? (isAr ? 'مرحلة منهجية' : 'Methodology phase') : '', planned_start: '', planned_end: '', progress_pct: 0, status: 'planned', sort_order: prev.length + i }))]);
        setMsg(mphases ? L('أُضيفت مراحل حسب منهجية المشروع — عدّلها ثم احفظ', 'Added phases per methodology — edit then save') : L('أُضيفت مراحل مقترحة — عدّلها ثم احفظ', 'Suggested milestones added — edit then save'));
    };
    const suggestRisks = () => {
        const pack = suggestionsFor(project?.ProjectType);
        setRisks(prev => [...prev, ...pack.risks.map((s, i) => ({ id: uid(), title: isAr ? s.ar : s.en, category: '', probability: s.probability, impact: s.impact, response_strategy: 'mitigate', response_plan: '', owner: '', status: 'open', sort_order: prev.length + i }))]);
        setMsg(L('أُضيفت مخاطر مقترحة حسب نوع المشروع — عدّلها ثم احفظ', 'Suggested risks added by project type — edit then save'));
    };

    const totalCost = items.reduce((s, it) => s + lineCost(it), 0);
    const profitValue = totalCost * (profitMargin / 100);
    const budget = totalCost + profitValue;
    const taxValue = budget * (taxRate / 100);
    const grand = budget + taxValue;

    // Rule-based validation
    const warnings: string[] = [];
    items.forEach((it, i) => {
        const n = i + 1;
        if (!it.item_name.trim()) warnings.push(L(`البند ${n}: الاسم فارغ`, `Item ${n}: name empty`));
        if ((Number(it.quantity) || 0) <= 0) warnings.push(L(`البند ${n}: الكمية ≤ 0`, `Item ${n}: qty ≤ 0`));
        if ((Number(it.unit_cost) || 0) === 0) warnings.push(L(`البند ${n}: التكلفة صفر — تأكّد`, `Item ${n}: zero cost — verify`));
        if ((Number(it.risk_pct) || 0) < 0 || (Number(it.risk_pct) || 0) > 100) warnings.push(L(`البند ${n}: نسبة مخاطرة غير منطقية`, `Item ${n}: risk % out of range`));
        if (!it.quality_criteria.trim()) warnings.push(L(`البند ${n}: لا يوجد معيار جودة`, `Item ${n}: no quality criteria`));
    });
    if (items.length === 0) warnings.push(L('لا توجد بنود في الخطة', 'Plan has no items'));
    if (items.length > 0 && !items.some(it => it.category === 'labor' || it.category === 'engineer')) warnings.push(L('لا توجد عمالة/مهندسين', 'No labor/engineers'));
    if (items.length > 0 && !items.some(it => it.category === 'material_essential')) warnings.push(L('لا توجد خامات أساسية', 'No essential materials'));
    if (profitMargin < 5) warnings.push(L('هامش الربح منخفض جداً (<5%)', 'Profit margin < 5%'));
    const blocking = items.length === 0 || items.some(it => !it.item_name.trim() || (Number(it.quantity) || 0) <= 0);

    const save = async (): Promise<boolean> => {
        setSaving(true); setMsg('');
        const toDelete = loadedIds.filter(id => !items.find(it => it.id === id));
        if (toDelete.length) await supabase.from('project_plan_items').delete().in('id', toDelete);
        if (items.length) {
            const rows = items.map((it, idx) => ({
                id: it.id, project_code: code, category: it.category, item_name: it.item_name, unit: it.unit || null,
                quantity: Number(it.quantity) || 0, unit_cost: Number(it.unit_cost) || 0, risk_pct: Number(it.risk_pct) || 0,
                is_essential: it.category !== 'material_complementary', quality_criteria: it.quality_criteria || null,
                duration_days: it.duration_days, notes: it.notes || null, sort_order: idx,
                item_type: it.item_type || 'manual', item_ref: it.item_ref || null, sell_price: Number(it.sell_price) || 0,
                updated_at: new Date().toISOString(),
            }));
            const { error } = await supabase.from('project_plan_items').upsert(rows);
            if (error) { setMsg(error.message); setSaving(false); return false; }
        }
        const { error: pErr } = await supabase.from('projects').update({
            ClientNeed: project?.ClientNeed || null, QualityStandards: project?.QualityStandards || null,
            ClientID: project?.ClientID || null, ProjectName: project?.ProjectName, ProjectType: project?.ProjectType || null, methodology: project?.methodology || null,
            Objectives: project?.Objectives || null, ScopeIn: project?.ScopeIn || null, ScopeOut: project?.ScopeOut || null,
            Deliverables: project?.Deliverables || null, Constraints: project?.Constraints || null, Assumptions: project?.Assumptions || null,
            LessonsLearned: project?.LessonsLearned || null, SponsorName: project?.SponsorName || null, ManagerID: project?.ManagerID || null,
            PlannedStart: project?.PlannedStart || null, PlannedEnd: project?.PlannedEnd || null,
            ActualCost: totalCost, Budget: budget, ProfitMargin: profitMargin / 100, ProfitValue: profitValue, TaxRate: taxRate / 100,
            ProjectFolderLink: project?.ProjectFolderLink || null, updated_at: new Date().toISOString(),
        }).eq('ProjectCode', code);
        setSaving(false);
        if (pErr) { setMsg(pErr.message); return false; }
        setLoadedIds(items.map(i => i.id));
        setMsg(L('تم الحفظ ✓', 'Saved ✓'));
        return true;
    };

    const setPlanStatus = async (status: string) => {
        const ok = await save();
        if (!ok) return;
        await supabase.from('projects').update({ PlanStatus: status, Status: status === 'approved' ? 'in_progress' : 'planning' }).eq('ProjectCode', code);
        setProject((p: any) => ({ ...p, PlanStatus: status }));
        setMsg(status === 'approved' ? L('تم اعتماد الخطة ✓ (جاهزة للربط بفاتورة)', 'Plan approved ✓') : L('تم التحديث', 'Updated'));
    };

    // ── generic batch-save for milestones/risks/stakeholders ──
    const saveSet = async (table: string, rows: any[], map: (r: any, i: number) => any) => {
        setSaving(true); setMsg('');
        const { data: existing } = await supabase.from(table).select('id').eq('project_code', code);
        const delIds = (existing || []).map((r: any) => r.id).filter((id: string) => !rows.find(x => x.id === id));
        if (delIds.length) await supabase.from(table).delete().in('id', delIds);
        if (rows.length) {
            const { error } = await supabase.from(table).upsert(rows.map((r, i) => ({ ...map(r, i), id: r.id, project_code: code, updated_at: new Date().toISOString() })));
            if (error) { setMsg(error.message); setSaving(false); return; }
        }
        setSaving(false); setMsg(L('تم الحفظ ✓', 'Saved ✓')); load();
    };

    // ── tasks ──
    const addTask = async () => {
        if (!newTask.name.trim()) return;
        const { data } = await supabase.from('tasks').select('TaskID').ilike('TaskID', 'TSK-%').order('TaskID', { ascending: false }).limit(1);
        let n = 1; if (data && data.length) { const m = String(data[0].TaskID).match(/TSK-(\d+)/); if (m) n = parseInt(m[1]) + 1; }
        const assignee = newTask.employeeId ? empName(newTask.employeeId) : newTask.external;
        await supabase.from('tasks').insert([{
            TaskID: `TSK-${n.toString().padStart(4, '0')}`, ProjectID: code, EmployeeID: newTask.employeeId || null, TaskName: newTask.name.trim(),
            Status: 'todo', TaskPriority: newTask.priority, ApprovalStatus: 'pending',
            TaskNotes: newTask.employeeId ? null : (assignee ? `${L('خارجي', 'External')}: ${assignee}` : null),
            created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        }]);
        setNewTask({ name: '', employeeId: '', external: '', priority: 'medium' }); load();
    };
    const setTaskStatus = async (tid: string, status: string) => { await supabase.from('tasks').update({ Status: status, updated_at: new Date().toISOString() }).eq('TaskID', tid); load(); };
    const delTask = async (tid: string) => { await supabase.from('tasks').update({ deleted_at: new Date().toISOString() }).eq('TaskID', tid); load(); };

    // ── procurement (soft-delete) ──
    const addProc = async () => {
        if (!newProc.item.trim()) return;
        await supabase.from('project_procurements').insert([{
            project_code: code, kind: newProc.kind, item: newProc.item.trim(),
            quantity: parseFloat(newProc.quantity) || 1, estimated_cost: parseFloat(newProc.estimated_cost) || 0,
            requested_by: newProc.requested_by || null, needed_by: newProc.needed_by || null, status: 'requested',
            created_at: new Date().toISOString(),
        }]);
        setNewProc({ kind: 'material', item: '', quantity: '1', estimated_cost: '', requested_by: '', needed_by: '' }); load();
    };
    const setProcStatus = async (id: string, status: string) => { await supabase.from('project_procurements').update({ status, updated_at: new Date().toISOString() }).eq('id', id); load(); };
    const delProc = async (id: string) => { await supabase.from('project_procurements').update({ deleted_at: new Date().toISOString() }).eq('id', id); load(); };

    // ── project partners (link partner + share) ──
    const addProjPartner = async () => {
        if (!newPP.partner) return;
        const name = allPartners.find(p => p.PartnerID === newPP.partner)?.PartnerName || '';
        await supabase.from('project_partners').insert([{ project_code: code, partner_id: newPP.partner, partner_name: name, role: newPP.role || null, share_pct: parseFloat(newPP.share) || 0, created_at: new Date().toISOString() }]);
        setNewPP({ partner: '', role: '', share: '' }); load();
    };
    const delProjPartner = async (id: string) => { await supabase.from('project_partners').delete().eq('id', id); load(); };

    // Clean print/PDF: open a white A4 document with only the project content, then trigger the
    // browser's native print dialog (preview + printer + paper size + "Save as PDF").
    const printProject = () => {
        const esc = (s: any) => String(s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string));
        const row = (cells: string[]) => `<tr>${cells.map(c => `<td>${c}</td>`).join('')}</tr>`;
        const catLabel = (k: string) => { const c = CATEGORIES.find(x => x.key === k); return c ? (isAr ? c.ar : c.en) : k; };
        const itemsHtml = items.length ? `<table><thead><tr><th>${L('الصنف', 'Type')}</th><th>${L('البند', 'Item')}</th><th>${L('كمية', 'Qty')}</th><th>${L('تكلفة الوحدة', 'Unit cost')}</th><th>${L('التكلفة', 'Cost')}</th></tr></thead><tbody>${items.map(it => row([catLabel(it.category), esc(it.item_name), num(it.quantity), num(it.unit_cost), num(lineCost(it))])).join('')}</tbody></table>` : `<p class="muted">${L('لا توجد بنود', 'No items')}</p>`;
        const msHtml = milestones.length ? `<table><thead><tr><th>${L('المرحلة', 'Phase')}</th><th>${L('المعلم', 'Milestone')}</th><th>${L('بداية', 'Start')}</th><th>${L('نهاية', 'End')}</th><th>${L('التقدم %', 'Progress %')}</th></tr></thead><tbody>${milestones.map(m => row([esc(m.phase), esc(m.name), esc(m.planned_start), esc(m.planned_end), String(m.progress_pct || 0)])).join('')}</tbody></table>` : '';
        const rkHtml = risks.length ? `<table><thead><tr><th>${L('الخطر', 'Risk')}</th><th>${L('احتمالية', 'Prob.')}</th><th>${L('التأثير', 'Impact')}</th><th>${L('الخطة', 'Plan')}</th></tr></thead><tbody>${risks.map(r => row([esc(r.title), LVL(r.probability, isAr), LVL(r.impact, isAr), esc(r.response_plan)])).join('')}</tbody></table>` : '';
        const shHtml = stakeholders.length ? `<table><thead><tr><th>${L('الاسم', 'Name')}</th><th>${L('الدور', 'Role')}</th><th>${L('التواصل', 'Contact')}</th></tr></thead><tbody>${stakeholders.map(s => row([esc(s.name), esc(s.role), esc(s.contact)])).join('')}</tbody></table>` : '';
        const field2 = (lbl: string, val: any) => val ? `<div class="f"><span class="k">${lbl}:</span> ${esc(val)}</div>` : '';
        const w = window.open('', '_blank');
        if (!w) { setMsg(L('المتصفح منع النافذة المنبثقة — اسمح بها ثم أعد المحاولة.', 'Popup blocked — allow popups then retry.')); return; }
        w.document.write(`<!DOCTYPE html><html dir="${isAr ? 'rtl' : 'ltr'}" lang="${locale}"><head><meta charset="utf-8"><title>${esc(project.ProjectCode)} — ${esc(project.ProjectName)}</title>
<style>
@page { margin: 14mm; size: A4; }
* { box-sizing: border-box; }
body { font-family: 'Cairo','Segoe UI',sans-serif; color:#1a1a1a; background:#fff; margin:0; font-size:12px; }
h1 { color:#9a7a1e; font-size:20px; margin:0 0 2px; }
h2 { color:#9a7a1e; font-size:14px; margin:18px 0 6px; border-bottom:1px solid #DBA935; padding-bottom:3px; }
.sub { color:#666; font-size:12px; margin-bottom:10px; }
.f { margin:2px 0; } .k { color:#555; font-weight:bold; }
.grid { display:grid; grid-template-columns:1fr 1fr; gap:2px 24px; }
table { width:100%; border-collapse:collapse; margin-top:4px; }
th,td { border:1px solid #ccc; padding:5px 7px; text-align:${isAr ? 'right' : 'left'}; font-size:11px; }
th { background:#f3ead2; color:#5c4a12; }
.muted { color:#999; } .totals { margin-top:6px; font-size:13px; } .totals b { color:#9a7a1e; }
.para { white-space:pre-wrap; margin:3px 0 8px; }
@media print { body { -webkit-print-color-adjust:exact; print-color-adjust:exact; } }
</style></head><body>
<h1>${esc(project.ProjectCode)} — ${esc(project.ProjectName)}</h1>
<div class="sub">${esc(project.ProjectType || '')} · ${L('العميل', 'Client')}: ${esc(clientName(project.ClientID))} · ${new Date().toLocaleDateString()}</div>
<div class="grid">
${field2(L('مدير المشروع', 'Manager'), empName(project.ManagerID))}
${field2(L('الراعي/الممول', 'Sponsor'), project.SponsorName)}
${field2(L('بداية مخططة', 'Planned start'), project.PlannedStart)}
${field2(L('نهاية مخططة', 'Planned end'), project.PlannedEnd)}
</div>
${project.ClientNeed ? `<h2>${L('احتياج العميل', 'Client need')}</h2><div class="para">${esc(project.ClientNeed)}</div>` : ''}
${project.Objectives ? `<h2>${L('الأهداف', 'Objectives')}</h2><div class="para">${esc(project.Objectives)}</div>` : ''}
<h2>${L('متطلبات التنفيذ والتكلفة', 'Requirements & cost')}</h2>${itemsHtml}
<div class="totals">${L('إجمالي التكلفة', 'Total cost')}: ${num(totalCost)} · ${L('الربح', 'Profit')}: ${num(profitValue)} · ${L('الضريبة', 'Tax')}: ${num(taxValue)} · <b>${L('الإجمالي للعميل', 'Grand total')}: ${num(grand)} ${L('ج.م', 'EGP')}</b></div>
${msHtml ? `<h2>${L('الجدول الزمني', 'Schedule')}</h2>${msHtml}` : ''}
${rkHtml ? `<h2>${L('المخاطر', 'Risks')}</h2>${rkHtml}` : ''}
${shHtml ? `<h2>${L('أصحاب المصلحة', 'Stakeholders')}</h2>${shHtml}` : ''}
</body></html>`);
        w.document.close();
        setTimeout(() => { w.focus(); w.print(); }, 400);
    };

    const field = 'px-2 py-1 bg-[#0a0a0c] border border-silver/30 rounded text-white text-xs focus:outline-none focus:border-gold';
    const fieldW = `${field} w-full py-2`;
    const ta = 'w-full px-3 py-2 bg-[#0a0a0c] border border-silver/30 rounded-lg text-white text-sm focus:outline-none focus:border-gold print:bg-white print:text-black print:border-gray-300';
    const num = (n: any) => Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 });

    if (loading) return <div className="min-h-screen flex items-center justify-center text-gold" dir={isAr ? 'rtl' : 'ltr'}>{L('جارٍ التحميل...', 'Loading...')}</div>;
    if (!project) return <div className="min-h-screen flex items-center justify-center text-silver" dir={isAr ? 'rtl' : 'ltr'}>{L('المشروع غير موجود', 'Project not found')}</div>;

    const TABS: [Tab, string][] = [
        ['charter', L('الميثاق', 'Charter')], ['plan', L('التخطيط والتكلفة', 'Plan & Cost')],
        ['schedule', L('الجدول الزمني', 'Schedule')], ['risks', L('المخاطر', 'Risks')],
        ['stakeholders', L('أصحاب المصلحة', 'Stakeholders')], ['procurement', L('المشتريات والعُهد', 'Procurement')],
        ['exec', L('التنفيذ', 'Execution')], ['closure', L('الإغلاق', 'Closure')],
    ];

    const sectionHdr = (t: string, onAdd?: () => void) => (
        <div className="flex justify-between items-center mb-2">
            <h3 className="text-gold font-semibold">{t}</h3>
            {onAdd && <button onClick={onAdd} className="px-3 py-1 rounded-lg bg-gold/20 text-gold text-xs hover:bg-gold/30">+ {L('إضافة', 'Add')}</button>}
        </div>
    );

    return (
        <div className="min-h-screen p-4 md:p-6 print:p-0" dir={isAr ? 'rtl' : 'ltr'}>
            <div className="bg-black/40 backdrop-blur-sm p-4 md:p-6 rounded-3xl shadow-2xl border border-[#DBA935]/20 max-w-6xl mx-auto print:bg-white print:text-black print:shadow-none print:border-0">
                <div className="flex flex-wrap justify-between items-center mb-4 gap-3 print:hidden">
                    <div>
                        <button onClick={() => router.push(`/${locale}/projects`)} className="text-[#DBA935] text-xs hover:underline mb-1">← {L('المشاريع', 'Projects')}</button>
                        <h1 className="text-xl font-bold text-[#DBA935]">{project.ProjectCode} — {project.ProjectName}</h1>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={printProject} className="px-3 py-1.5 rounded-lg bg-black/30 border border-[#DBA935]/20 text-[#C0C0C0] text-sm hover:bg-[#DBA935]/10">🖨 {L('معاينة وطباعة / PDF', 'Preview & print / PDF')}</button>
                        <button onClick={save} disabled={saving} className="px-4 py-1.5 rounded-lg bg-[#DBA935] text-[#3E3B3F] font-bold text-sm hover:bg-[#DBA935]/90 disabled:opacity-50">{saving ? L('جارٍ الحفظ...', 'Saving...') : L('حفظ', 'Save')}</button>
                    </div>
                </div>
                {msg && <div className="mb-3 text-sm text-gold print:hidden">{msg}</div>}

                <JourneyStrip code={code} locale={locale} />

                <div className="flex gap-2 mb-5 print:hidden flex-wrap">
                    {TABS.map(([k, lbl]) => (
                        <button key={k} onClick={() => setTab(k)} className={`px-3 py-1.5 rounded-full text-sm transition ${tab === k ? 'bg-[#DBA935] text-[#3E3B3F] font-bold' : 'bg-white/5 text-silver border border-gold/20 hover:bg-gold/10'}`}>{lbl}</button>
                    ))}
                    <span className="ms-auto self-center text-xs px-2 py-0.5 rounded-full bg-gold/10 text-gold">{L('الخطة', 'Plan')}: {PLAN_STATUS_LABEL(project.PlanStatus, isAr)}</span>
                </div>

                {/* ===== CHARTER ===== */}
                {tab === 'charter' && (
                    <div className="space-y-4">
                        <div className="grid md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-silver text-sm mb-1">{L('العميل', 'Client')}</label>
                                <select value={project.ClientID || ''} onChange={e => setProject({ ...project, ClientID: e.target.value })} className={fieldW}>
                                    <option value="">{L('— بدون —', '— none —')}</option>
                                    {clients.map(c => <option key={c.ClientId} value={c.ClientId}>{c.ClientName}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-silver text-sm mb-1">{L('مدير المشروع', 'Project manager')}</label>
                                <select value={project.ManagerID || ''} onChange={e => setProject({ ...project, ManagerID: e.target.value })} className={fieldW}>
                                    <option value="">{L('— بدون —', '— none —')}</option>
                                    {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-silver text-sm mb-1">{L('نوع المشروع', 'Project type')}</label>
                                {!customType ? (
                                    <select value={project.ProjectType || ''} onChange={e => { if (e.target.value === '__other__') { setCustomType(true); setProject({ ...project, ProjectType: '' }); } else setProject({ ...project, ProjectType: e.target.value }); }} className={fieldW}>
                                        <option value="">{L('— اختر النوع —', '— select type —')}</option>
                                        {PROJECT_TYPES.filter(t => t.key !== 'other').map(t => <option key={t.key} value={isAr ? t.ar : t.en}>{isAr ? t.ar : t.en}</option>)}
                                        <option value="__other__">{L('أخرى (اكتب النوع)', 'Other (type it)')}</option>
                                    </select>
                                ) : (
                                    <div className="flex gap-2">
                                        <input value={project.ProjectType || ''} onChange={e => setProject({ ...project, ProjectType: e.target.value })} className={fieldW} placeholder={L('اكتب نوع المشروع', 'Type the project type')} autoFocus />
                                        <button type="button" onClick={() => { setCustomType(false); setProject({ ...project, ProjectType: '' }); }} className="px-2 rounded-lg bg-silver/10 text-silver text-xs hover:bg-silver/20" title={L('اختيار من القائمة', 'Pick from list')}>↩</button>
                                    </div>
                                )}
                                <p className="text-silver/50 text-[11px] mt-1">{L('يُستخدم لاقتراح البنود والمراحل والمخاطر تلقائياً.', 'Used to auto-suggest items, milestones and risks.')}</p>
                            </div>
                            <div>
                                <label className="block text-silver text-sm mb-1">{L('منهجية إدارة المشروع', 'Project methodology')}</label>
                                <select value={project.methodology || ''} onChange={e => setProject({ ...project, methodology: e.target.value || null })} className={fieldW}>
                                    <option value="">{L('— اختر المنهجية —', '— select methodology —')}</option>
                                    {METHODOLOGIES.map(m => <option key={m.key} value={m.key}>{isAr ? m.ar : m.en}</option>)}
                                </select>
                                <p className="text-silver/50 text-[11px] mt-1">{L('تحدّد أسلوب العمل ومراحل الجدول الزمني (زر «اقتراح مراحل» يتبع المنهجية).', 'Sets the way of working and the schedule phases (the "Suggest phases" button follows it).')}</p>
                            </div>
                            <div><label className="block text-silver text-sm mb-1">{L('الراعي / الجهة المموّلة', 'Sponsor')}</label><input value={project.SponsorName || ''} onChange={e => setProject({ ...project, SponsorName: e.target.value })} className={fieldW} placeholder={L('مثال: إدارة العميل أو الممول الداخلي', 'e.g. client management / internal funder')} /><p className="text-silver/50 text-[11px] mt-1">{L('الجهة التي تموّل/تعتمد المشروع — قد تكون العميل نفسه أو إدارة داخلية.', 'Who funds/authorizes the project — may be the client or an internal department.')}</p></div>
                            <div><label className="block text-silver text-sm mb-1">{L('رابط المتابعة (Trello/مجلد)', 'Tracking link')}</label><input value={project.ProjectFolderLink || ''} onChange={e => setProject({ ...project, ProjectFolderLink: e.target.value })} className={fieldW} placeholder="https://trello.com/..." /></div>
                            <div><label className="block text-silver text-sm mb-1">{L('بداية مخططة', 'Planned start')}</label><input type="date" value={project.PlannedStart || ''} onChange={e => setProject({ ...project, PlannedStart: e.target.value })} className={fieldW} /></div>
                            <div><label className="block text-silver text-sm mb-1">{L('نهاية مخططة', 'Planned end')}</label><input type="date" value={project.PlannedEnd || ''} onChange={e => setProject({ ...project, PlannedEnd: e.target.value })} className={fieldW} /></div>
                        </div>
                        <div><label className="block text-silver text-sm mb-0.5">{L('احتياج العميل', 'Client need')}</label><p className="text-silver/50 text-[11px] mb-1">{L('ما الذي يريده العميل بالضبط وما المشكلة التي يحلّها المشروع.', 'What the client wants and the problem the project solves.')}</p><textarea value={project.ClientNeed || ''} onChange={e => setProject({ ...project, ClientNeed: e.target.value })} rows={2} className={ta} /></div>
                        <div><label className="block text-silver text-sm mb-0.5">{L('أهداف المشروع', 'Objectives')}</label><p className="text-silver/50 text-[11px] mb-1">{L('النتائج المحددة والقابلة للقياس المطلوب تحقيقها.', 'Specific, measurable results to achieve.')}</p><textarea value={project.Objectives || ''} onChange={e => setProject({ ...project, Objectives: e.target.value })} rows={2} className={ta} /></div>
                        <div className="grid md:grid-cols-2 gap-4">
                            <div><label className="block text-silver text-sm mb-0.5">{L('داخل النطاق', 'In scope')}</label><p className="text-silver/50 text-[11px] mb-1">{L('الأعمال والمخرجات المشمولة بالمشروع.', 'Work and deliverables included.')}</p><textarea value={project.ScopeIn || ''} onChange={e => setProject({ ...project, ScopeIn: e.target.value })} rows={2} className={ta} /></div>
                            <div><label className="block text-silver text-sm mb-0.5">{L('خارج النطاق', 'Out of scope')}</label><p className="text-silver/50 text-[11px] mb-1">{L('ما هو مستثنى صراحةً من المشروع.', 'What is explicitly excluded.')}</p><textarea value={project.ScopeOut || ''} onChange={e => setProject({ ...project, ScopeOut: e.target.value })} rows={2} className={ta} /></div>
                            <div><label className="block text-silver text-sm mb-0.5">{L('المُسلّمات', 'Deliverables')}</label><p className="text-silver/50 text-[11px] mb-1">{L('المخرجات الملموسة التي ستُسلَّم للعميل.', 'Tangible outputs handed to the client.')}</p><textarea value={project.Deliverables || ''} onChange={e => setProject({ ...project, Deliverables: e.target.value })} rows={2} className={ta} /></div>
                            <div><label className="block text-silver text-sm mb-0.5">{L('القيود', 'Constraints')}</label><p className="text-silver/50 text-[11px] mb-1">{L('حدود مثل الميزانية أو الوقت أو الموارد.', 'Limits like budget, time, or resources.')}</p><textarea value={project.Constraints || ''} onChange={e => setProject({ ...project, Constraints: e.target.value })} rows={2} className={ta} /></div>
                            <div><label className="block text-silver text-sm mb-0.5">{L('الافتراضات', 'Assumptions')}</label><p className="text-silver/50 text-[11px] mb-1">{L('أمور نفترض صحتها عند التخطيط.', 'Things assumed true while planning.')}</p><textarea value={project.Assumptions || ''} onChange={e => setProject({ ...project, Assumptions: e.target.value })} rows={2} className={ta} /></div>
                        </div>

                        {/* Project partners & shares */}
                        <div className="bg-black/30 rounded-xl border border-gold/20 p-4">
                            <h3 className="text-gold font-semibold mb-3">{L('شركاء المشروع ونِسبهم', 'Project partners & shares')}</h3>
                            <div className="grid md:grid-cols-4 gap-2 mb-3">
                                <select value={newPP.partner} onChange={e => {
                                    const p = allPartners.find(x => x.PartnerID === e.target.value);
                                    const role = p ? ([p.IsFinancialPartner && L('مالي', 'Financial'), p.IsTechnicalPartner && L('فني', 'Technical')].filter(Boolean).join('/') || p.Role || '') : '';
                                    setNewPP({ partner: e.target.value, role, share: p?.SharePercentage ? String(p.SharePercentage) : '' });
                                }} className={fieldW}><option value="">{L('— اختر شريك —', '— partner —')}</option>{allPartners.map(p => <option key={p.PartnerID} value={p.PartnerID}>{p.PartnerName}</option>)}</select>
                                <input value={newPP.role} onChange={e => setNewPP({ ...newPP, role: e.target.value })} placeholder={L('الدور (يُملأ تلقائياً - قابل للتعديل)', 'Role (auto, editable)')} className={fieldW} />
                                <input type="number" value={newPP.share} onChange={e => setNewPP({ ...newPP, share: e.target.value })} placeholder={L('النسبة % (تلقائي - قابل للتعديل)', 'Share % (auto, editable)')} className={fieldW} dir="ltr" />
                                <button onClick={addProjPartner} className="px-4 py-2 rounded-lg bg-gold text-darkwhite font-bold text-sm hover:bg-yellow-600">+ {L('ربط', 'Link')}</button>
                            </div>
                            {projPartners.length > 0 && (
                                <div className="space-y-1">
                                    {projPartners.map(pp => (
                                        <div key={pp.id} className="flex justify-between items-center bg-black/20 rounded-lg px-3 py-2 text-sm">
                                            <span className="text-white">{pp.partner_name} {pp.role ? <span className="text-silver/60">— {pp.role}</span> : null}</span>
                                            <span className="flex items-center gap-3"><span className="text-gold">{pp.share_pct || 0}%</span><button onClick={() => delProjPartner(pp.id)} className="text-red-400 hover:text-red-300">✕</button></span>
                                        </div>
                                    ))}
                                    <p className="text-silver/50 text-xs mt-1">{L('إجمالي النسب', 'Total share')}: {projPartners.reduce((s, p) => s + (Number(p.share_pct) || 0), 0)}%</p>
                                </div>
                            )}
                        </div>

                        <ApprovalPanel entityType="project" entityId={code} locale={locale} />
                    </div>
                )}

                {/* ===== PLAN & COST ===== */}
                {tab === 'plan' && (
                    <div className="space-y-5">
                        <datalist id="catalog-items">
                            {catalogAll.map((c: any) => <option key={`${c.item_type}-${c.id}`} value={c.name} />)}
                        </datalist>
                        <div>
                            <div className="flex justify-between items-center mb-2 flex-wrap gap-2">
                                <h3 className="text-gold font-semibold">{L('متطلبات التنفيذ', 'Execution requirements')}</h3>
                                <div className="flex gap-2">
                                    <button onClick={suggestItems} className="px-3 py-1 rounded-lg bg-gold/10 text-gold text-xs hover:bg-gold/20 border border-gold/20">✨ {L('اقتراح بنود حسب النوع', 'Suggest items by type')}</button>
                                    <button onClick={addItem} className="px-3 py-1 rounded-lg bg-gold/20 text-gold text-xs hover:bg-gold/30">+ {L('إضافة', 'Add')}</button>
                                </div>
                            </div>
                            {/* Catalog picker: link requirement items to products/services for accurate pricing */}
                            <div className="relative mb-2">
                                <input value={catSearch} onChange={e => searchCatalog(e.target.value)} onFocus={() => catResults.length && setCatOpen(true)}
                                    placeholder={L('ابحث في المنتجات والخدمات لإضافة بند بسعره...', 'Search products/services to add a priced item...')}
                                    className="w-full px-3 py-2 bg-[#0a0a0c] border border-silver/30 rounded-lg text-white text-sm focus:outline-none focus:border-gold" />
                                {catOpen && catResults.length > 0 && (
                                    <div className="absolute z-50 w-full mt-1 max-h-60 overflow-y-auto bg-[#2a2829] border border-[#DBA935]/20 rounded-xl shadow-2xl">
                                        {catResults.map(c => (
                                            <button key={`${c.item_type}-${c.id}`} onClick={() => addFromCatalog(c)} className="w-full text-start px-3 py-2 hover:bg-[#DBA935]/10 border-b border-white/5 last:border-0">
                                                <span className={`text-[0.6rem] px-1.5 py-0.5 rounded me-2 ${c.item_type === 'product' ? 'bg-blue-500/20 text-blue-300' : 'bg-emerald-500/20 text-emerald-300'}`}>{c.item_type === 'product' ? L('منتج', 'Product') : L('خدمة', 'Service')}</span>
                                                <span className="text-white text-sm">{c.name}</span>
                                                <span className="text-silver/60 text-xs ms-2">{L('تكلفة', 'cost')}: {num(Number(c.cost_price) || Number(c.direct_cost) || 0)}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className="overflow-x-auto rounded-xl border border-[#3E3B3F]">
                                <table className="w-full text-xs" style={{ minWidth: '900px' }}>
                                    <thead><tr className="bg-[#242428] text-[#DBA935]/90">
                                        {[L('النوع', 'Type'), L('البند', 'Item'), L('الوحدة', 'Unit'), L('الكمية', 'Qty'), L('تكلفة الوحدة', 'Unit cost'), L('مخاطرة %', 'Risk %'), L('معيار الجودة', 'Quality'), L('التكلفة', 'Cost'), ''].map((h, i) => <th key={i} className="py-2 px-2 text-start whitespace-nowrap border-b border-[#DBA935]/20">{h}</th>)}
                                    </tr></thead>
                                    <tbody>
                                        {items.map(it => (
                                            <tr key={it.id} className="border-b border-[#3E3B3F]/60 text-white">
                                                <td className="p-1"><select value={it.category} onChange={e => onItemCategoryChange(it.id, e.target.value)} className={field}>{CATEGORIES.map(c => <option key={c.key} value={c.key}>{isAr ? c.ar : c.en}</option>)}</select></td>
                                                <td className="p-1"><input list="catalog-items" value={it.item_name} onChange={e => onItemNameChange(it.id, e.target.value)} className={`${field} w-44`} placeholder={L('اختر أو اكتب', 'pick or type')} /></td>
                                                <td className="p-1"><input value={it.unit} onChange={e => updItem(it.id, { unit: e.target.value })} className={`${field} w-16`} /></td>
                                                <td className="p-1"><input type="number" value={it.quantity} onChange={e => updItem(it.id, { quantity: parseFloat(e.target.value) || 0 })} className={`${field} w-16`} /></td>
                                                <td className="p-1"><input type="number" value={it.unit_cost} onChange={e => updItem(it.id, { unit_cost: parseFloat(e.target.value) || 0 })} className={`${field} w-20`} /></td>
                                                <td className="p-1"><input type="number" value={it.risk_pct} onChange={e => updItem(it.id, { risk_pct: parseFloat(e.target.value) || 0 })} className={`${field} w-14`} /></td>
                                                <td className="p-1"><input value={it.quality_criteria} onChange={e => updItem(it.id, { quality_criteria: e.target.value })} className={`${field} w-40`} placeholder={L('المعيار', 'criteria')} /></td>
                                                <td className="p-1 whitespace-nowrap text-gold">{num(lineCost(it))}</td>
                                                <td className="p-1"><button onClick={() => delItem(it.id)} className="text-red-400 hover:text-red-300">✕</button></td>
                                            </tr>
                                        ))}
                                        {items.length === 0 && <tr><td colSpan={9} className="text-center py-6 text-silver">{L('أضف بنود المتطلبات', 'Add requirement items')}</td></tr>}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <div className="grid md:grid-cols-2 gap-4">
                            <div><label className="block text-silver text-sm mb-1">{L('معايير الجودة العامة', 'Overall quality standards')}</label><textarea value={project.QualityStandards || ''} onChange={e => setProject({ ...project, QualityStandards: e.target.value })} rows={4} className={ta} /></div>
                            <div className="bg-black/30 rounded-xl border border-gold/20 p-4 space-y-2 text-sm">
                                <div className="flex justify-between"><span className="text-silver">{L('إجمالي التكلفة', 'Total cost')}</span><span className="text-white font-medium">{num(totalCost)} {L('ج.م', 'EGP')}</span></div>
                                <div className="flex justify-between items-center"><span className="text-silver">{L('هامش الربح %', 'Profit margin %')}</span><input type="number" value={profitMargin} onChange={e => setProfitMargin(parseFloat(e.target.value) || 0)} className={`${field} w-20`} /></div>
                                <div className="flex justify-between"><span className="text-silver">{L('قيمة الربح', 'Profit')}</span><span className="text-green-400">{num(profitValue)}</span></div>
                                <div className="flex justify-between"><span className="text-silver">{L('الميزانية (قبل الضريبة)', 'Budget (pre-tax)')}</span><span className="text-white font-medium">{num(budget)}</span></div>
                                <div className="flex justify-between items-center"><span className="text-silver">{L('الضريبة %', 'Tax %')}</span><input type="number" value={taxRate} onChange={e => setTaxRate(parseFloat(e.target.value) || 0)} className={`${field} w-20`} /></div>
                                <div className="flex justify-between border-t border-gold/20 pt-2 mt-1"><span className="text-gold font-bold">{L('الإجمالي للعميل', 'Grand total')}</span><span className="text-gold font-bold">{num(grand)} {L('ج.م', 'EGP')}</span></div>
                            </div>
                        </div>
                        {warnings.length > 0 && (
                            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3">
                                <p className="text-yellow-400 text-sm font-semibold mb-1">⚠ {L('فحص النظام قبل الاعتماد', 'System checks before approval')} ({warnings.length})</p>
                                <ul className="text-yellow-300/90 text-xs list-disc ps-5 space-y-0.5 max-h-32 overflow-y-auto">{warnings.slice(0, 20).map((w, i) => <li key={i}>{w}</li>)}</ul>
                            </div>
                        )}
                        <div className="flex flex-wrap gap-2">
                            <button onClick={() => setPlanStatus('approved')} disabled={blocking} className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-bold hover:bg-green-700 disabled:opacity-40">{L('اعتماد العميل', 'Client approve')}</button>
                            <button onClick={() => setPlanStatus('rejected')} className="px-4 py-2 rounded-lg bg-red-500/20 text-red-400 text-sm hover:bg-red-500/30">{L('رفض', 'Reject')}</button>
                            <button onClick={() => setPlanStatus('draft')} className="px-4 py-2 rounded-lg bg-silver/10 text-silver text-sm hover:bg-silver/20">{L('إرجاع لمسودة', 'Back to draft')}</button>
                        </div>
                    </div>
                )}

                {/* ===== SCHEDULE ===== */}
                {tab === 'schedule' && (
                    <div className="space-y-3">
                        {/* تقويم المشروع: يربط التاسكات والمعالم بالتواريخ */}
                        {(() => {
                            const y = calMonth.getFullYear(), mo = calMonth.getMonth();
                            const startDow = new Date(y, mo, 1).getDay();
                            const days = new Date(y, mo + 1, 0).getDate();
                            const byDay: Record<number, { t: string; kind: 'task' | 'ms' }[]> = {};
                            const add = (d: any, t: string, kind: 'task' | 'ms') => { if (!d) return; const dt = new Date(d); if (dt.getFullYear() === y && dt.getMonth() === mo) (byDay[dt.getDate()] ||= []).push({ t, kind }); };
                            milestones.forEach((m: any) => add(m.planned_start, m.name || L('معلم', 'Milestone'), 'ms'));
                            tasks.forEach((t: any) => add(t.StartDate, t.TaskName, 'task'));
                            const cells: ({ day: number; ev: any[] } | null)[] = [];
                            for (let i = 0; i < startDow; i++) cells.push(null);
                            for (let d = 1; d <= days; d++) cells.push({ day: d, ev: byDay[d] || [] });
                            const mName = calMonth.toLocaleDateString(isAr ? 'ar-EG' : 'en-US', { month: 'long', year: 'numeric' });
                            return (
                                <div className="bg-black/30 rounded-xl border border-gold/20 p-3">
                                    <div className="flex items-center justify-between mb-2">
                                        <button onClick={() => setCalMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))} className="px-2 py-1 rounded bg-white/5 text-silver text-sm hover:bg-white/10">‹</button>
                                        <span className="text-gold text-sm font-bold">📅 {L('تقويم المشروع', 'Project calendar')} — {mName}</span>
                                        <button onClick={() => setCalMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))} className="px-2 py-1 rounded bg-white/5 text-silver text-sm hover:bg-white/10">›</button>
                                    </div>
                                    <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-silver/50 mb-1">
                                        {(isAr ? ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'] : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']).map(d => <div key={d}>{d}</div>)}
                                    </div>
                                    <div className="grid grid-cols-7 gap-1">
                                        {cells.map((c, i) => (
                                            <div key={i} className={`min-h-[48px] rounded border p-1 text-start ${c ? 'border-[#3E3B3F] bg-[#0a0a0c]' : 'border-transparent'}`}>
                                                {c && <>
                                                    <div className="text-[10px] text-silver/50">{c.day}</div>
                                                    {c.ev.slice(0, 3).map((e, j) => <div key={j} title={e.t} className={`truncate text-[9px] px-1 py-0.5 mt-0.5 rounded ${e.kind === 'ms' ? 'bg-gold/25 text-gold' : 'bg-blue-500/20 text-blue-300'}`}>{e.t}</div>)}
                                                    {c.ev.length > 3 && <div className="text-[9px] text-silver/40">+{c.ev.length - 3}</div>}
                                                </>}
                                            </div>
                                        ))}
                                    </div>
                                    <div className="flex gap-3 mt-2 text-[10px] text-silver/50">
                                        <span className="inline-flex items-center gap-1"><i className="w-2.5 h-2.5 rounded bg-gold/25 inline-block" />{L('معالم', 'Milestones')}</span>
                                        <span className="inline-flex items-center gap-1"><i className="w-2.5 h-2.5 rounded bg-blue-500/20 inline-block" />{L('مهام', 'Tasks')}</span>
                                    </div>
                                </div>
                            );
                        })()}
                        <div className="flex justify-between items-center mb-2 flex-wrap gap-2">
                            <h3 className="text-gold font-semibold">{L('المراحل والمعالم', 'Phases & milestones')}</h3>
                            <div className="flex gap-2">
                                <button onClick={suggestMilestones} className="px-3 py-1 rounded-lg bg-gold/10 text-gold text-xs hover:bg-gold/20 border border-gold/20">✨ {L('اقتراح مراحل', 'Suggest phases')}</button>
                                <button onClick={() => setMilestones(p => [...p, { id: uid(), name: '', phase: '', planned_start: '', planned_end: '', progress_pct: 0, status: 'planned', sort_order: p.length }])} className="px-3 py-1 rounded-lg bg-gold/20 text-gold text-xs hover:bg-gold/30">+ {L('إضافة', 'Add')}</button>
                            </div>
                        </div>
                        <div className="overflow-x-auto rounded-xl border border-[#3E3B3F]">
                            <table className="w-full text-xs" style={{ minWidth: '820px' }}>
                                <thead><tr className="bg-[#242428] text-[#DBA935]/90">{[L('المرحلة', 'Phase'), L('المعلم', 'Milestone'), L('بداية', 'Start'), L('نهاية', 'End'), L('التقدم %', 'Progress %'), L('الحالة', 'Status'), ''].map((h, i) => <th key={i} className="py-2 px-2 text-start whitespace-nowrap border-b border-[#DBA935]/20">{h}</th>)}</tr></thead>
                                <tbody>
                                    {milestones.map((m, idx) => (
                                        <tr key={m.id} className="border-b border-[#3E3B3F]/60 text-white">
                                            <td className="p-1"><input value={m.phase || ''} onChange={e => setMilestones(p => p.map(x => x.id === m.id ? { ...x, phase: e.target.value } : x))} className={`${field} w-28`} /></td>
                                            <td className="p-1"><input value={m.name || ''} onChange={e => setMilestones(p => p.map(x => x.id === m.id ? { ...x, name: e.target.value } : x))} className={`${field} w-40`} /></td>
                                            <td className="p-1"><input type="date" value={m.planned_start || ''} onChange={e => setMilestones(p => p.map(x => x.id === m.id ? { ...x, planned_start: e.target.value } : x))} className={field} /></td>
                                            <td className="p-1"><input type="date" value={m.planned_end || ''} onChange={e => setMilestones(p => p.map(x => x.id === m.id ? { ...x, planned_end: e.target.value } : x))} className={field} /></td>
                                            <td className="p-1"><input type="number" min="0" max="100" value={m.progress_pct || 0} onChange={e => setMilestones(p => p.map(x => x.id === m.id ? { ...x, progress_pct: parseFloat(e.target.value) || 0 } : x))} className={`${field} w-16`} /></td>
                                            <td className="p-1"><select value={m.status || 'planned'} onChange={e => setMilestones(p => p.map(x => x.id === m.id ? { ...x, status: e.target.value } : x))} className={field}><option value="planned">{L('مخطط', 'Planned')}</option><option value="in_progress">{L('جارٍ', 'In progress')}</option><option value="done">{L('منجز', 'Done')}</option><option value="delayed">{L('متأخر', 'Delayed')}</option></select></td>
                                            <td className="p-1"><button onClick={() => setMilestones(p => p.filter(x => x.id !== m.id))} className="text-red-400">✕</button></td>
                                        </tr>
                                    ))}
                                    {milestones.length === 0 && <tr><td colSpan={7} className="text-center py-6 text-silver">{L('أضف مراحل المشروع', 'Add project phases')}</td></tr>}
                                </tbody>
                            </table>
                        </div>
                        <button onClick={() => saveSet('project_milestones', milestones, (r, i) => ({ name: r.name || null, phase: r.phase || null, planned_start: r.planned_start || null, planned_end: r.planned_end || null, progress_pct: Number(r.progress_pct) || 0, status: r.status || 'planned', sort_order: i }))} disabled={saving} className="px-4 py-2 rounded-lg bg-gold text-darkwhite font-bold text-sm hover:bg-yellow-600 disabled:opacity-50">{L('حفظ الجدول', 'Save schedule')}</button>
                    </div>
                )}

                {/* ===== RISKS ===== */}
                {tab === 'risks' && (
                    <div className="space-y-3">
                        <div className="flex justify-between items-center mb-2 flex-wrap gap-2">
                            <h3 className="text-gold font-semibold">{L('سجل المخاطر', 'Risk register')}</h3>
                            <div className="flex gap-2">
                                <button onClick={suggestRisks} className="px-3 py-1 rounded-lg bg-gold/10 text-gold text-xs hover:bg-gold/20 border border-gold/20">✨ {L('اقتراح مخاطر حسب النوع', 'Suggest risks by type')}</button>
                                <button onClick={() => setRisks(p => [...p, { id: uid(), title: '', category: '', probability: 'medium', impact: 'medium', response_strategy: 'mitigate', response_plan: '', owner: '', status: 'open', sort_order: p.length }])} className="px-3 py-1 rounded-lg bg-gold/20 text-gold text-xs hover:bg-gold/30">+ {L('إضافة', 'Add')}</button>
                            </div>
                        </div>
                        <div className="overflow-x-auto rounded-xl border border-[#3E3B3F]">
                            <table className="w-full text-xs" style={{ minWidth: '960px' }}>
                                <thead><tr className="bg-[#242428] text-[#DBA935]/90">{[L('الخطر', 'Risk'), L('احتمالية', 'Prob.'), L('التأثير', 'Impact'), L('الاستجابة', 'Strategy'), L('الخطة', 'Response plan'), L('المسؤول', 'Owner'), L('الحالة', 'Status'), ''].map((h, i) => <th key={i} className="py-2 px-2 text-start whitespace-nowrap border-b border-[#DBA935]/20">{h}</th>)}</tr></thead>
                                <tbody>
                                    {risks.map(r => (
                                        <tr key={r.id} className="border-b border-[#3E3B3F]/60 text-white">
                                            <td className="p-1"><input value={r.title || ''} onChange={e => setRisks(p => p.map(x => x.id === r.id ? { ...x, title: e.target.value } : x))} className={`${field} w-40`} /></td>
                                            <td className="p-1"><select value={r.probability} onChange={e => setRisks(p => p.map(x => x.id === r.id ? { ...x, probability: e.target.value } : x))} className={field}>{['low', 'medium', 'high'].map(v => <option key={v} value={v}>{LVL(v, isAr)}</option>)}</select></td>
                                            <td className="p-1"><select value={r.impact} onChange={e => setRisks(p => p.map(x => x.id === r.id ? { ...x, impact: e.target.value } : x))} className={field}>{['low', 'medium', 'high'].map(v => <option key={v} value={v}>{LVL(v, isAr)}</option>)}</select></td>
                                            <td className="p-1"><select value={r.response_strategy} onChange={e => setRisks(p => p.map(x => x.id === r.id ? { ...x, response_strategy: e.target.value } : x))} className={field}><option value="avoid">{L('تجنب', 'Avoid')}</option><option value="mitigate">{L('تخفيف', 'Mitigate')}</option><option value="transfer">{L('نقل', 'Transfer')}</option><option value="accept">{L('قبول', 'Accept')}</option></select></td>
                                            <td className="p-1"><input value={r.response_plan || ''} onChange={e => setRisks(p => p.map(x => x.id === r.id ? { ...x, response_plan: e.target.value } : x))} className={`${field} w-44`} /></td>
                                            <td className="p-1"><input value={r.owner || ''} onChange={e => setRisks(p => p.map(x => x.id === r.id ? { ...x, owner: e.target.value } : x))} className={`${field} w-24`} /></td>
                                            <td className="p-1"><select value={r.status} onChange={e => setRisks(p => p.map(x => x.id === r.id ? { ...x, status: e.target.value } : x))} className={field}><option value="open">{L('مفتوح', 'Open')}</option><option value="monitoring">{L('مراقبة', 'Monitoring')}</option><option value="closed">{L('مغلق', 'Closed')}</option></select></td>
                                            <td className="p-1"><button onClick={() => setRisks(p => p.filter(x => x.id !== r.id))} className="text-red-400">✕</button></td>
                                        </tr>
                                    ))}
                                    {risks.length === 0 && <tr><td colSpan={8} className="text-center py-6 text-silver">{L('سجّل المخاطر المحتملة', 'Log potential risks')}</td></tr>}
                                </tbody>
                            </table>
                        </div>
                        <button onClick={() => saveSet('project_risks', risks, (r, i) => ({ title: r.title || null, category: r.category || null, probability: r.probability, impact: r.impact, response_strategy: r.response_strategy, response_plan: r.response_plan || null, owner: r.owner || null, status: r.status, sort_order: i }))} disabled={saving} className="px-4 py-2 rounded-lg bg-gold text-darkwhite font-bold text-sm hover:bg-yellow-600 disabled:opacity-50">{L('حفظ المخاطر', 'Save risks')}</button>
                    </div>
                )}

                {/* ===== STAKEHOLDERS ===== */}
                {tab === 'stakeholders' && (
                    <div className="space-y-3">
                        {sectionHdr(L('أصحاب المصلحة والتواصل', 'Stakeholders & communication'), () => setStakeholders(p => [...p, { id: uid(), name: '', role: '', influence: 'medium', interest: 'medium', contact: '', communication: '', sort_order: p.length }]))}
                        <p className="text-silver/50 text-[11px] -mt-1 mb-1">{L('أصحاب المصلحة = كل طرف يتأثّر بالمشروع أو يؤثّر فيه: العميل، المستخدم النهائي، الراعي/الممول، الموردون، فريقك الفني. العميل أحدهم وليس الوحيد.', 'Stakeholders = anyone affected by or influencing the project: the client, end users, the sponsor/funder, suppliers, your team. The client is one of them, not the only one.')}</p>
                        <div className="overflow-x-auto rounded-xl border border-[#3E3B3F]">
                            <table className="w-full text-xs" style={{ minWidth: '880px' }}>
                                <thead><tr className="bg-[#242428] text-[#DBA935]/90">{[L('الاسم', 'Name'), L('الدور', 'Role'), L('التأثير', 'Influence'), L('الاهتمام', 'Interest'), L('التواصل', 'Contact'), L('خطة التواصل', 'Comm. plan'), ''].map((h, i) => <th key={i} className="py-2 px-2 text-start whitespace-nowrap border-b border-[#DBA935]/20">{h}</th>)}</tr></thead>
                                <tbody>
                                    {stakeholders.map(s => (
                                        <tr key={s.id} className="border-b border-[#3E3B3F]/60 text-white">
                                            <td className="p-1"><input value={s.name || ''} onChange={e => setStakeholders(p => p.map(x => x.id === s.id ? { ...x, name: e.target.value } : x))} className={`${field} w-32`} /></td>
                                            <td className="p-1"><input value={s.role || ''} onChange={e => setStakeholders(p => p.map(x => x.id === s.id ? { ...x, role: e.target.value } : x))} className={`${field} w-28`} /></td>
                                            <td className="p-1"><select value={s.influence} onChange={e => setStakeholders(p => p.map(x => x.id === s.id ? { ...x, influence: e.target.value } : x))} className={field}>{['low', 'medium', 'high'].map(v => <option key={v} value={v}>{LVL(v, isAr)}</option>)}</select></td>
                                            <td className="p-1"><select value={s.interest} onChange={e => setStakeholders(p => p.map(x => x.id === s.id ? { ...x, interest: e.target.value } : x))} className={field}>{['low', 'medium', 'high'].map(v => <option key={v} value={v}>{LVL(v, isAr)}</option>)}</select></td>
                                            <td className="p-1"><input value={s.contact || ''} onChange={e => setStakeholders(p => p.map(x => x.id === s.id ? { ...x, contact: e.target.value } : x))} className={`${field} w-28`} dir="ltr" /></td>
                                            <td className="p-1"><input value={s.communication || ''} onChange={e => setStakeholders(p => p.map(x => x.id === s.id ? { ...x, communication: e.target.value } : x))} className={`${field} w-40`} /></td>
                                            <td className="p-1"><button onClick={() => setStakeholders(p => p.filter(x => x.id !== s.id))} className="text-red-400">✕</button></td>
                                        </tr>
                                    ))}
                                    {stakeholders.length === 0 && <tr><td colSpan={7} className="text-center py-6 text-silver">{L('أضف أصحاب المصلحة', 'Add stakeholders')}</td></tr>}
                                </tbody>
                            </table>
                        </div>
                        <button onClick={() => saveSet('project_stakeholders', stakeholders, (r, i) => ({ name: r.name || null, role: r.role || null, influence: r.influence, interest: r.interest, contact: r.contact || null, communication: r.communication || null, sort_order: i }))} disabled={saving} className="px-4 py-2 rounded-lg bg-gold text-darkwhite font-bold text-sm hover:bg-yellow-600 disabled:opacity-50">{L('حفظ', 'Save')}</button>
                    </div>
                )}

                {/* ===== PROCUREMENT ===== */}
                {tab === 'procurement' && (
                    <div className="space-y-4">
                        <div className="bg-black/30 rounded-xl border border-gold/20 p-4">
                            <h3 className="text-gold font-semibold mb-3">{L('طلب خامات / عهدة / شراء', 'Material / custody / purchase request')}</h3>
                            <div className="grid md:grid-cols-6 gap-2">
                                <select value={newProc.kind} onChange={e => setNewProc({ ...newProc, kind: e.target.value })} className={`${field} py-2`}><option value="material">{L('خامات', 'Material')}</option><option value="custody">{L('عهدة', 'Custody')}</option><option value="purchase">{L('شراء', 'Purchase')}</option><option value="subcontract">{L('مقاول باطن', 'Subcontract')}</option></select>
                                <input value={newProc.item} onChange={e => setNewProc({ ...newProc, item: e.target.value })} placeholder={L('الصنف', 'Item')} className={`${field} py-2 md:col-span-2`} />
                                <input type="number" value={newProc.quantity} onChange={e => setNewProc({ ...newProc, quantity: e.target.value })} placeholder={L('كمية', 'Qty')} className={`${field} py-2`} />
                                <input type="number" value={newProc.estimated_cost} onChange={e => setNewProc({ ...newProc, estimated_cost: e.target.value })} placeholder={L('تكلفة تقديرية', 'Est. cost')} className={`${field} py-2`} />
                                <button onClick={addProc} className="px-4 py-2 rounded-lg bg-gold text-darkwhite font-bold text-sm hover:bg-yellow-600">+ {L('طلب', 'Request')}</button>
                            </div>
                        </div>
                        <div className="overflow-x-auto rounded-xl border border-[#3E3B3F]">
                            <table className="w-full text-sm" style={{ minWidth: '760px' }}>
                                <thead><tr className="bg-[#242428] text-[#DBA935]/90">{[L('النوع', 'Kind'), L('الصنف', 'Item'), L('كمية', 'Qty'), L('تكلفة', 'Cost'), L('الحالة', 'Status'), ''].map((h, i) => <th key={i} className="py-2.5 px-3 text-start whitespace-nowrap border-b border-[#DBA935]/20">{h}</th>)}</tr></thead>
                                <tbody>
                                    {procurements.length === 0 ? <tr><td colSpan={6} className="text-center py-8 text-silver">{L('لا توجد طلبات', 'No requests')}</td></tr> :
                                        procurements.map(p => (
                                            <tr key={p.id} className="border-b border-[#3E3B3F]/60 text-white hover:bg-gold/10">
                                                <td className="py-2 px-3 whitespace-nowrap">{{ material: L('خامات', 'Material'), custody: L('عهدة', 'Custody'), purchase: L('شراء', 'Purchase'), subcontract: L('مقاول', 'Subcontract') }[p.kind as string] || p.kind}</td>
                                                <td className="py-2 px-3">{p.item}</td>
                                                <td className="py-2 px-3">{num(p.quantity)}</td>
                                                <td className="py-2 px-3">{num(p.estimated_cost)}</td>
                                                <td className="py-2 px-3"><select value={p.status} onChange={e => setProcStatus(p.id, e.target.value)} className={`${field} py-1`}><option value="requested">{L('مطلوب', 'Requested')}</option><option value="approved">{L('معتمد', 'Approved')}</option><option value="purchased">{L('تم الشراء', 'Purchased')}</option><option value="received">{L('مستلم', 'Received')}</option><option value="returned">{L('مرتجع', 'Returned')}</option></select></td>
                                                <td className="py-2 px-3 whitespace-nowrap"><span className="inline-flex items-center gap-3"><button onClick={() => setProcApproval(p)} className="text-[#DBA935] hover:underline text-xs">{L('اعتماد', 'Approvals')}</button><button onClick={() => delProc(p.id)} className="text-red-400 hover:text-red-300 text-xs">{L('حذف', 'Delete')}</button></span></td>
                                            </tr>
                                        ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* ===== EXECUTION ===== */}
                {tab === 'exec' && (
                    <div className="space-y-4">
                        <div className="bg-black/30 rounded-xl border border-gold/20 p-4">
                            <h3 className="text-gold font-semibold mb-3">{L('توزيع المهام', 'Task assignment')}</h3>
                            <div className="grid md:grid-cols-5 gap-2">
                                <input value={newTask.name} onChange={e => setNewTask({ ...newTask, name: e.target.value })} placeholder={L('اسم المهمة', 'Task name')} className={`${field} py-2 md:col-span-2`} />
                                <select value={newTask.employeeId} onChange={e => setNewTask({ ...newTask, employeeId: e.target.value })} className={`${field} py-2`}>
                                    <option value="">{L('موظف مسجّل', 'Registered employee')}</option>
                                    {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                                </select>
                                <input value={newTask.external} onChange={e => setNewTask({ ...newTask, external: e.target.value })} placeholder={L('أو اسم خارجي/فريلانس', 'or external/freelance')} className={`${field} py-2`} disabled={!!newTask.employeeId} />
                                <button onClick={addTask} className="px-4 py-2 rounded-lg bg-gold text-darkwhite font-bold text-sm hover:bg-yellow-600">+ {L('إضافة', 'Add')}</button>
                            </div>
                        </div>
                        <div className="overflow-x-auto rounded-xl border border-[#3E3B3F]">
                            <table className="w-full text-sm" style={{ minWidth: '700px' }}>
                                <thead><tr className="bg-[#242428] text-[#DBA935]/90">{[L('الكود', 'Code'), L('المهمة', 'Task'), L('المسؤول', 'Assignee'), L('الأولوية', 'Priority'), L('الحالة', 'Status'), ''].map((h, i) => <th key={i} className="py-2.5 px-3 text-start whitespace-nowrap border-b border-[#DBA935]/20">{h}</th>)}</tr></thead>
                                <tbody>
                                    {tasks.length === 0 ? <tr><td colSpan={6} className="text-center py-8 text-silver">{L('لا توجد مهام', 'No tasks')}</td></tr> :
                                        tasks.map(t => (
                                            <tr key={t.TaskID} className="border-b border-[#3E3B3F]/60 text-white hover:bg-gold/10">
                                                <td className="py-2 px-3 text-gold whitespace-nowrap">{t.TaskID}</td>
                                                <td className="py-2 px-3">{t.TaskName}</td>
                                                <td className="py-2 px-3 whitespace-nowrap">{t.EmployeeID ? empName(t.EmployeeID) : (t.TaskNotes || '—')}</td>
                                                <td className="py-2 px-3">{t.TaskPriority || '—'}</td>
                                                <td className="py-2 px-3"><select value={t.Status || 'todo'} onChange={e => setTaskStatus(t.TaskID, e.target.value)} className={`${field} py-1`}><option value="todo">{L('لم تبدأ', 'To do')}</option><option value="in_progress">{L('جارية', 'In progress')}</option><option value="review">{L('مراجعة', 'Review')}</option><option value="done">{L('مكتملة', 'Done')}</option></select></td>
                                                <td className="py-2 px-3"><button onClick={() => delTask(t.TaskID)} className="text-red-400 hover:text-red-300 text-xs">{L('حذف', 'Delete')}</button></td>
                                            </tr>
                                        ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* ===== CLOSURE ===== */}
                {tab === 'closure' && (
                    <div className="space-y-4">
                        <div><label className="block text-silver text-sm mb-1">{L('الدروس المستفادة', 'Lessons learned')}</label><p className="text-silver/50 text-[11px] mb-1">{L('اكتب هنا ما سار جيداً وما يجب تحسينه، ثم اضغط «حفظ الدروس». تُحفظ أيضاً عند إغلاق المشروع.', 'Write what went well and what to improve, then press "Save lessons". Also saved when you close the project.')}</p><textarea value={project.LessonsLearned || ''} onChange={e => setProject({ ...project, LessonsLearned: e.target.value })} rows={5} className={ta} placeholder={L('ما الذي سار جيداً وما الذي يجب تحسينه...', 'What went well and what to improve...')} /></div>
                        <div className="flex flex-wrap gap-2">
                            <button onClick={save} disabled={saving} className="px-4 py-2 rounded-lg bg-gold text-darkwhite text-sm font-bold hover:bg-yellow-600 disabled:opacity-50">{saving ? L('جارٍ الحفظ...', 'Saving...') : L('حفظ الدروس', 'Save lessons')}</button>
                            <button onClick={async () => { await save(); await supabase.from('projects').update({ Status: 'completed' }).eq('ProjectCode', code); setProject((p: any) => ({ ...p, Status: 'completed' })); setMsg(L('تم إغلاق المشروع ✓', 'Project closed ✓')); }} className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-bold hover:bg-green-700">{L('إغلاق المشروع', 'Close project')}</button>
                            <span className="self-center text-xs px-2 py-0.5 rounded-full bg-gold/10 text-gold">{L('الحالة', 'Status')}: {project.Status || '—'}</span>
                        </div>
                    </div>
                )}
            </div>

            {procApproval && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)' }} onClick={() => { setProcApproval(null); load(); }} dir={isAr ? 'rtl' : 'ltr'}>
                    <div className="bg-[#1a1a1e]/95 backdrop-blur-md rounded-2xl shadow-2xl border border-gold/30 w-full max-w-lg max-h-[88vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center p-5 border-b border-silver/20">
                            <div>
                                <h2 className="text-lg font-alata text-gold">{L('اعتماد طلب عهدة/مشتريات', 'Procurement approval')}</h2>
                                <p className="text-silver/70 text-xs mt-0.5">{procApproval.item} — {num(procApproval.estimated_cost)} {L('ج.م', 'EGP')}</p>
                            </div>
                            <button onClick={() => { setProcApproval(null); load(); }} className="text-silver p-1 hover:bg-silver/20 rounded">✕</button>
                        </div>
                        <div className="p-5">
                            <ApprovalPanel entityType="procurement" entityId={procApproval.id} value={Number(procApproval.estimated_cost) || 0} locale={locale} onStatusChange={() => load()} />
                            <p className="text-silver/50 text-[11px] mt-3">{L('عند اكتمال الاعتماد تتحوّل الحالة إلى «معتمد» تلقائياً.', 'On full approval the status becomes "approved" automatically.')}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function PLAN_STATUS_LABEL(s: string | null, ar: boolean) {
    const m: Record<string, [string, string]> = { draft: ['مسودة', 'Draft'], approved: ['معتمد', 'Approved'], rejected: ['مرفوض', 'Rejected'] };
    const v = m[s || 'draft'] || m.draft; return ar ? v[0] : v[1];
}

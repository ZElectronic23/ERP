'use client';

// HR geofence editor. Loads Leaflet + OpenStreetMap from CDN (no API key). Click the map to set a
// work-area centre, choose a radius, name it (optionally tie it to a project/site), and save.
// Then assign employees to a geofence — that becomes where their attendance punch must happen.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocale } from 'next-intl';

declare global { interface Window { L: any } }

const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';

function loadLeaflet(): Promise<any> {
    return new Promise((resolve, reject) => {
        if (window.L) return resolve(window.L);
        if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
            const link = document.createElement('link');
            link.rel = 'stylesheet'; link.href = LEAFLET_CSS;
            document.head.appendChild(link);
        }
        const existing = document.querySelector(`script[src="${LEAFLET_JS}"]`) as HTMLScriptElement | null;
        if (existing) { existing.addEventListener('load', () => resolve(window.L)); return; }
        const s = document.createElement('script');
        s.src = LEAFLET_JS; s.async = true;
        s.onload = () => resolve(window.L);
        s.onerror = () => reject(new Error('leaflet load failed'));
        document.head.appendChild(s);
    });
}

interface Geofence { id: string; name: string; project_code: string | null; center_lat: number; center_lng: number; radius_m: number; active: boolean }
interface Assignment { employee_id: string; geofence_id: string }
interface Emp { EmployeeID: string; Name: string; Department: string | null }

export default function GeofenceEditor() {
    const locale = useLocale();
    const isAr = locale === 'ar';
    const L = (ar: string, en: string) => (isAr ? ar : en);

    const mapEl = useRef<HTMLDivElement>(null);
    const mapRef = useRef<any>(null);
    const markerRef = useRef<any>(null);
    const circleRef = useRef<any>(null);

    const [geofences, setGeofences] = useState<Geofence[]>([]);
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [employees, setEmployees] = useState<Emp[]>([]);
    const [name, setName] = useState('');
    const [projectCode, setProjectCode] = useState('');
    const [radius, setRadius] = useState(150);
    const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null);
    const [selected, setSelected] = useState<string>('');
    const [empToAssign, setEmpToAssign] = useState('');
    const [msg, setMsg] = useState('');
    const [err, setErr] = useState('');
    const [ready, setReady] = useState(false);

    const load = useCallback(async () => {
        try {
            const res = await fetch('/api/attendance/geofences');
            const j = await res.json();
            if (!res.ok) { setErr(j.error || 'Error'); return; }
            setGeofences(j.geofences || []); setAssignments(j.assignments || []); setEmployees(j.employees || []);
        } catch (e: any) { setErr(e.message); }
    }, []);
    useEffect(() => { load(); }, [load]);

    // init map
    useEffect(() => {
        let cancelled = false;
        loadLeaflet().then((Lf) => {
            if (cancelled || !mapEl.current || mapRef.current) return;
            const map = Lf.map(mapEl.current).setView([30.0444, 31.2357], 11); // Cairo default
            Lf.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19, attribution: '© OpenStreetMap',
            }).addTo(map);
            map.on('click', (e: any) => setCenter({ lat: e.latlng.lat, lng: e.latlng.lng }));
            mapRef.current = map;
            setReady(true);
            // try to centre on the user's location
            navigator.geolocation?.getCurrentPosition(p => map.setView([p.coords.latitude, p.coords.longitude], 15), () => {});
        }).catch(() => setErr(L('تعذّر تحميل الخريطة', 'Failed to load the map')));
        return () => { cancelled = true; };
    }, [L]);

    // draw marker + circle for the picked centre/radius
    useEffect(() => {
        const Lf = window.L; const map = mapRef.current;
        if (!Lf || !map || !center) return;
        if (markerRef.current) markerRef.current.setLatLng(center); else markerRef.current = Lf.marker(center).addTo(map);
        if (circleRef.current) { circleRef.current.setLatLng(center); circleRef.current.setRadius(radius); }
        else circleRef.current = Lf.circle(center, { radius, color: '#DBA935', fillColor: '#DBA935', fillOpacity: 0.15 }).addTo(map);
    }, [center, radius, ready]);

    const save = async () => {
        setErr(''); setMsg('');
        if (!name.trim()) { setErr(L('أدخل اسم المحيط', 'Enter a name')); return; }
        if (!center) { setErr(L('اضغط على الخريطة لتحديد مركز المحيط', 'Click the map to set the centre')); return; }
        const res = await fetch('/api/attendance/geofences', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: name.trim(), project_code: projectCode.trim() || null, center_lat: center.lat, center_lng: center.lng, radius_m: radius }),
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) { setErr(j.error || 'Error'); return; }
        setMsg(L('تم حفظ المحيط ✓', 'Geofence saved ✓'));
        setName(''); setProjectCode('');
        await load();
    };

    const assign = async () => {
        if (!selected || !empToAssign) return;
        setErr(''); setMsg('');
        const res = await fetch('/api/attendance/geofences', {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ employee_id: empToAssign, geofence_id: selected }),
        });
        if (!res.ok) { const j = await res.json().catch(() => ({})); setErr(j.error || 'Error'); return; }
        setEmpToAssign(''); setMsg(L('تم ربط الموظف بالمحيط ✓', 'Employee assigned ✓')); await load();
    };
    const unassign = async (employee_id: string, geofence_id: string) => {
        await fetch('/api/attendance/geofences', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'unassign', employee_id, geofence_id }) });
        await load();
    };
    const removeFence = async (id: string) => {
        await fetch(`/api/attendance/geofences?id=${id}`, { method: 'DELETE' });
        if (selected === id) setSelected('');
        await load();
    };

    const focusFence = (g: Geofence) => {
        setSelected(g.id);
        const map = mapRef.current;
        if (map) map.setView([g.center_lat, g.center_lng], 16);
    };
    const empName = (id: string) => employees.find(e => e.EmployeeID === id)?.Name || id;
    const assignedTo = (gid: string) => assignments.filter(a => a.geofence_id === gid);
    const field = 'px-3 py-2 bg-[#0a0a0c] border border-silver/30 rounded-lg text-silver text-sm focus:outline-none focus:border-gold';

    return (
        <div className="space-y-4" dir={isAr ? 'rtl' : 'ltr'}>
            <p className="text-silver/60 text-xs">{L('اضغط على الخريطة لتحديد مركز محيط العمل، اختر نصف القطر وسمّ المحيط ثم احفظه، ثم اربط الموظفين به. سيُسجَّل حضور الموظف فقط داخل هذا المحيط.', 'Click the map to set the work-area centre, pick a radius, name & save it, then assign employees. A punch is accepted only inside this area.')}</p>
            {err && <div className="p-2 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">{err}</div>}
            {msg && <div className="p-2 bg-green-500/10 border border-green-500/30 rounded-lg text-green-300 text-sm">{msg}</div>}

            <div ref={mapEl} className="w-full h-80 rounded-xl overflow-hidden border border-gold/20 bg-[#0a0a0c]" />

            <div className="grid md:grid-cols-4 gap-2 items-end">
                <div><label className="block text-silver text-xs mb-1">{L('اسم المحيط', 'Geofence name')}</label><input value={name} onChange={e => setName(e.target.value)} className={`${field} w-full`} placeholder={L('مثال: مقر العميل - التجمع', 'e.g. Client site - NC')} /></div>
                <div><label className="block text-silver text-xs mb-1">{L('كود المشروع (اختياري)', 'Project code (optional)')}</label><input value={projectCode} onChange={e => setProjectCode(e.target.value)} className={`${field} w-full`} placeholder="PRJ-..." /></div>
                <div><label className="block text-silver text-xs mb-1">{L('نصف القطر', 'Radius')}: {radius} {L('م', 'm')}</label><input type="range" min={20} max={1000} step={10} value={radius} onChange={e => setRadius(Number(e.target.value))} className="w-full accent-gold" /></div>
                <button onClick={save} className="px-4 py-2 bg-gold text-darkwhite rounded-lg font-bold text-sm hover:bg-yellow-600">{L('حفظ المحيط', 'Save geofence')}</button>
            </div>
            {center && <p className="text-silver/40 text-[11px]">{L('المركز المحدَّد', 'Picked centre')}: {center.lat.toFixed(5)}, {center.lng.toFixed(5)}</p>}

            <div className="border-t border-silver/15 pt-3">
                <h4 className="text-gold text-sm font-bold mb-2">{L('المحيطات المحفوظة', 'Saved geofences')} ({geofences.length})</h4>
                <div className="space-y-2">
                    {geofences.length === 0 && <p className="text-silver/40 text-xs">{L('لا توجد محيطات بعد.', 'No geofences yet.')}</p>}
                    {geofences.map(g => (
                        <div key={g.id} className={`rounded-lg border p-3 ${selected === g.id ? 'border-gold bg-gold/5' : 'border-silver/15 bg-[#1a1a1e]'}`}>
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                                <button onClick={() => focusFence(g)} className="text-silver text-sm hover:text-gold">
                                    📍 {g.name} <span className="text-silver/40 text-xs">· {g.radius_m}م{g.project_code ? ` · ${g.project_code}` : ''}</span>
                                </button>
                                <button onClick={() => removeFence(g.id)} className="text-red-400 hover:text-red-300 text-xs">{L('حذف', 'Delete')}</button>
                            </div>
                            {selected === g.id && (
                                <div className="mt-2 border-t border-silver/10 pt-2">
                                    <div className="flex gap-2 flex-wrap items-center">
                                        <select value={empToAssign} onChange={e => setEmpToAssign(e.target.value)} className={field}>
                                            <option value="">{L('— اختر موظفاً للربط —', '— pick employee —')}</option>
                                            {employees.map(e => <option key={e.EmployeeID} value={e.EmployeeID}>{e.Name}{e.Department ? ` (${e.Department})` : ''}</option>)}
                                        </select>
                                        <button onClick={assign} disabled={!empToAssign} className="px-3 py-2 bg-gold/20 text-gold rounded-lg text-sm hover:bg-gold/30 disabled:opacity-50">+ {L('ربط', 'Assign')}</button>
                                    </div>
                                    <div className="mt-2 flex flex-wrap gap-1.5">
                                        {assignedTo(g.id).map(a => (
                                            <span key={a.employee_id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#0a0a0c] border border-silver/20 text-silver/80 text-[11px]">
                                                {empName(a.employee_id)}
                                                <button onClick={() => unassign(a.employee_id, g.id)} className="text-red-400 hover:text-red-300">✕</button>
                                            </span>
                                        ))}
                                        {assignedTo(g.id).length === 0 && <span className="text-silver/40 text-[11px]">{L('لا يوجد موظفون مرتبطون', 'No employees assigned')}</span>}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

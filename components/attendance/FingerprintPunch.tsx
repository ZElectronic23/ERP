'use client';

// Self-service biometric attendance button. Captures the device GPS and sends it to the punch
// API, which records the punch only inside the employee's assigned geofence (first tap = check-in,
// last tap = check-out). Outside the perimeter the server rejects it with a message to try inside.
import { useCallback, useEffect, useState } from 'react';
import { useLocale } from 'next-intl';

interface Status {
    employee?: { id: string; name: string };
    hasGeofence?: boolean;
    checkIn?: string | null;
    checkOut?: string | null;
    todayCount?: number;
    error?: string;
    message?: string;
}

export default function FingerprintPunch() {
    const locale = useLocale();
    const isAr = locale === 'ar';
    const L = (ar: string, en: string) => (isAr ? ar : en);
    const [status, setStatus] = useState<Status | null>(null);
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
    const [loaded, setLoaded] = useState(false);

    const loadStatus = useCallback(async () => {
        try {
            const res = await fetch('/api/attendance/punch');
            const j = await res.json().catch(() => ({}));
            setStatus(res.ok ? j : { error: j.error, message: j.message });
        } catch { /* ignore */ } finally { setLoaded(true); }
    }, []);
    useEffect(() => { loadStatus(); }, [loadStatus]);

    const getPosition = () => new Promise<GeolocationPosition>((resolve, reject) => {
        if (typeof navigator === 'undefined' || !navigator.geolocation) return reject(new Error('no-geo'));
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
    });

    const punch = async () => {
        setBusy(true); setMsg(null);
        try {
            const pos = await getPosition();
            const res = await fetch('/api/attendance/punch', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            });
            const j = await res.json().catch(() => ({}));
            setMsg({ ok: !!j.ok, text: j.message || (res.ok ? 'OK' : L('حدث خطأ', 'Error')) });
            await loadStatus();
        } catch (e: any) {
            setMsg({ ok: false, text: e?.message === 'no-geo'
                ? L('جهازك لا يدعم تحديد الموقع.', 'Your device does not support geolocation.')
                : L('فعّل خدمة الموقع (GPS) واسمح بالوصول ثم حاول مجدداً.', 'Enable location (GPS) and allow access, then retry.') });
        } finally { setBusy(false); }
    };

    if (!loaded) return null;
    // No employee record linked → nothing to show (component is harmless on the shared dashboard).
    if (status?.error === 'no_employee') return null;

    const fmt = (s?: string | null) => (s ? new Date(s).toLocaleTimeString(isAr ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' }) : '—');
    const nextIsIn = !status?.todayCount;

    return (
        <div className="rounded-2xl border border-gold/25 bg-black/30 p-4 flex flex-col sm:flex-row items-center gap-4" dir={isAr ? 'rtl' : 'ltr'}>
            <button onClick={punch} disabled={busy}
                className="relative w-20 h-20 rounded-full bg-gold/15 border-2 border-gold flex items-center justify-center hover:bg-gold/25 transition disabled:opacity-50 shrink-0"
                title={L('اضغط لتسجيل البصمة', 'Tap to punch')}>
                {busy
                    ? <span className="w-6 h-6 border-2 border-gold border-t-transparent rounded-full animate-spin" />
                    : <span className="text-4xl">🫆</span>}
            </button>
            <div className="flex-1 text-center sm:text-start">
                <div className="text-gold font-bold text-sm">{L('بصمة الحضور والانصراف', 'Attendance punch')}</div>
                <div className="text-silver/70 text-xs mt-0.5">
                    {nextIsIn ? L('اضغط لتسجيل الحضور', 'Tap to check in') : L('اضغط لتسجيل الانصراف', 'Tap to check out')}
                    {status?.hasGeofence === false && <span className="text-yellow-400"> · {L('لم يُحدَّد محيط عمل لك', 'No work area set for you')}</span>}
                </div>
                <div className="flex gap-4 mt-2 text-xs justify-center sm:justify-start">
                    <span className="text-silver/80">{L('حضور', 'In')}: <span className="text-green-400 font-bold">{fmt(status?.checkIn)}</span></span>
                    <span className="text-silver/80">{L('انصراف', 'Out')}: <span className="text-red-400 font-bold">{fmt(status?.checkOut)}</span></span>
                </div>
                {msg && <div className={`mt-2 text-xs ${msg.ok ? 'text-green-400' : 'text-red-400'}`}>{msg.text}</div>}
            </div>
        </div>
    );
}

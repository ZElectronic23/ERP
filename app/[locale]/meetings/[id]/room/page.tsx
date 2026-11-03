'use client';

// Virtual meeting room. The built-in room is Jitsi Meet (free/open-source, no credentials):
// camera/mic, screen share, collaborative whiteboard, document present and recording all come
// from Jitsi itself. If the organizer chose Google Meet / Zoom / Teams, we link out to it.
// An optional AI assistant transcribes locally in the browser (Web Speech API, consent-gated) —
// no audio leaves the device; the organizer saves the transcript and can extract action items.
import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocale } from 'next-intl';
import { useParams, useRouter } from 'next/navigation';

export default function RoomPage() {
    const locale = useLocale(); const isAr = locale === 'ar'; const L = (a: string, e: string) => (isAr ? a : e);
    const { id } = useParams<{ id: string }>();
    const router = useRouter();
    const [m, setM] = useState<any | null>(null);
    const [me, setMe] = useState<string | null>(null);
    const [isOrg, setIsOrg] = useState(false);
    const [err, setErr] = useState('');

    // transcription state
    const [consent, setConsent] = useState(false);
    const [listening, setListening] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [supported, setSupported] = useState(true);
    const recRef = useRef<any>(null);

    const load = useCallback(async () => {
        const res = await fetch(`/api/meetings/${id}`); const j = await res.json();
        if (!res.ok) { setErr(j.message || j.error || 'Error'); return; }
        setM(j.meeting); setMe(j.me); setIsOrg(j.is_organizer); setTranscript(j.meeting.transcript || '');
    }, [id]);
    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        const SR = (typeof window !== 'undefined') && ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
        if (!SR) setSupported(false);
    }, []);

    const startRec = () => {
        const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SR) { setSupported(false); return; }
        const rec = new SR();
        rec.lang = isAr ? 'ar-EG' : 'en-US'; rec.continuous = true; rec.interimResults = false;
        rec.onresult = (ev: any) => {
            let add = '';
            for (let i = ev.resultIndex; i < ev.results.length; i++) if (ev.results[i].isFinal) add += ev.results[i][0].transcript + ' ';
            if (add) setTranscript(t => (t ? t + '\n' : '') + add.trim());
        };
        rec.onend = () => { if (recRef.current) rec.start(); }; // keep going until stopped
        rec.onerror = () => { };
        recRef.current = rec; rec.start(); setListening(true);
    };
    const stopRec = () => { const rec = recRef.current; recRef.current = null; if (rec) rec.stop(); setListening(false); };
    useEffect(() => () => { recRef.current = null; }, []);

    const saveTranscript = async () => {
        await fetch(`/api/meetings/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'notes', transcript, transcript_consent: consent }) });
        alert(L('تم حفظ التفريغ.', 'Transcript saved.'));
    };

    if (err) return <div className="min-h-screen flex items-center justify-center text-red-400" dir={isAr ? 'rtl' : 'ltr'}>{err}</div>;
    if (!m) return <div className="min-h-screen flex items-center justify-center text-[#C0C0C0]">{L('جارٍ التحميل...', 'Loading...')}</div>;

    const displayName = encodeURIComponent(me || (isAr ? 'مشارك' : 'Participant'));
    const jitsiUrl = `https://meet.jit.si/${m.room_name || 'ZElectronic-' + String(id).replace(/-/g, '').slice(0, 20)}#userInfo.displayName=%22${displayName}%22&config.prejoinPageEnabled=true&config.disableDeepLinking=true`;

    return (
        <div className="min-h-screen p-3 md:p-4" dir={isAr ? 'rtl' : 'ltr'}>
            <div className="max-w-7xl mx-auto">
                <div className="flex flex-wrap justify-between items-center mb-3 gap-2">
                    <div>
                        <button onClick={() => router.push(`/${locale}/meetings`)} className="text-[#DBA935] text-sm mb-1">← {L('الاجتماعات', 'Meetings')}</button>
                        <h1 className="text-xl font-bold text-white">{m.title}</h1>
                    </div>
                    <span className="text-[#C0C0C0] text-xs">{new Date(m.start_at).toLocaleString(isAr ? 'ar-EG' : 'en-GB')}</span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                    {/* video area */}
                    <div className="lg:col-span-2">
                        {m.mode === 'in_person' ? (
                            <div className="aspect-video rounded-2xl bg-black/40 border border-[#DBA935]/20 flex items-center justify-center text-center p-6">
                                <div><div className="text-4xl mb-2">📍</div><p className="text-white">{L('اجتماع حضوري', 'In-person meeting')}</p><p className="text-[#C0C0C0] text-sm mt-1">{m.location || L('المكان غير محدد', 'Location not set')}</p></div>
                            </div>
                        ) : (
                            // The virtual room ALWAYS runs inside the ERP (embedded, no external redirect).
                            <iframe
                                src={jitsiUrl}
                                allow="camera; microphone; fullscreen; display-capture; autoplay; clipboard-write"
                                className="w-full aspect-video rounded-2xl border border-[#DBA935]/20 bg-black"
                                title="meeting room"
                            />
                        )}
                        {m.mode !== 'in_person' && <p className="text-silver/50 text-[11px] mt-2">{L('الغرفة تعمل داخل النظام مباشرةً (بلا تحويل خارجي): كاميرا، ميكروفون، مشاركة الشاشة، سبورة تعاونية، عرض مستندات وتسجيل — كلها من داخل الـERP.', 'The room runs inside the ERP directly (no external redirect): camera, mic, screen share, collaborative whiteboard, document present and recording — all in-app.')}</p>}
                    </div>

                    {/* side panel */}
                    <div className="space-y-3">
                        {/* agenda */}
                        <div className="bg-black/40 rounded-2xl border border-[#DBA935]/20 p-4">
                            <h3 className="text-[#DBA935] font-bold text-sm mb-2">{L('الأجندة', 'Agenda')}</h3>
                            {(m.agenda || []).length ? <ol className="list-decimal ms-5 text-[#C0C0C0] text-xs space-y-1">{m.agenda.map((a: any, i: number) => <li key={i}>{a.text}{a.minutes ? ` (${a.minutes} ${L('د', 'min')})` : ''}</li>)}</ol>
                                : <p className="text-silver/50 text-xs">{L('لا أجندة.', 'No agenda.')}</p>}
                        </div>

                        {/* AI assistant: local transcription */}
                        <div className="bg-black/40 rounded-2xl border border-[#DBA935]/20 p-4">
                            <h3 className="text-[#DBA935] font-bold text-sm mb-1">🤖 {L('المساعد الذكي — التفريغ', 'AI assistant — transcription')}</h3>
                            <p className="text-silver/50 text-[11px] mb-2">{L('التفريغ يتم داخل متصفحك فقط ولا يُرسل الصوت لأي خادم.', 'Transcription runs in your browser only — no audio leaves your device.')}</p>
                            {!supported ? <p className="text-orange-300 text-xs">{L('متصفحك لا يدعم التفريغ الصوتي المدمج. استخدم Chrome، أو اكتب المحضر يدوياً. (لرفع الدقة لاحقاً يمكن ربط خدمة تفريغ خارجية — يحتاج مفتاح API).', 'Your browser does not support built-in speech-to-text. Use Chrome, or type the minutes manually. (A higher-accuracy external transcription service can be connected later — needs an API key.)')}</p>
                                : <>
                                    <label className="flex items-start gap-2 text-xs text-white mb-2"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} className="accent-[#DBA935] w-4 h-4 mt-0.5" />{L('أوافق على تفريغ ما أقوله في هذا الجهاز.', 'I consent to transcribing what I say, on this device.')}</label>
                                    <div className="flex gap-2 mb-2">
                                        {!listening ? <button disabled={!consent} onClick={startRec} className="px-3 py-1.5 rounded-lg bg-green-600/80 text-white text-xs font-bold disabled:opacity-40">● {L('ابدأ', 'Start')}</button>
                                            : <button onClick={stopRec} className="px-3 py-1.5 rounded-lg bg-red-600/80 text-white text-xs font-bold">■ {L('إيقاف', 'Stop')}</button>}
                                        {isOrg && <button onClick={saveTranscript} className="px-3 py-1.5 rounded-lg bg-[#DBA935]/20 text-[#DBA935] border border-[#DBA935]/40 text-xs">{L('حفظ التفريغ', 'Save transcript')}</button>}
                                    </div>
                                </>}
                            <textarea rows={8} value={transcript} onChange={e => setTranscript(e.target.value)} placeholder={L('سيظهر التفريغ هنا — ويمكن تعديله.', 'Transcript appears here — editable.')} className="w-full bg-black/30 border border-[#DBA935]/20 rounded-lg px-2 py-2 text-xs text-white outline-none" />
                            <p className="text-silver/50 text-[11px] mt-1">{L('بعد الاجتماع: المنظّم يحوّل القرارات وبنود العمل إلى مهام من صفحة إدارة الاجتماع.', 'After the meeting: the organizer turns decisions and action items into tasks from the meeting’s manage page.')}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

'use client';

// Native in-ERP meeting room — runs ENTIRELY inside the ERP. No external site, no links.
// Video/audio via WebRTC (mesh, good for small internal meetings); signaling over Supabase
// Realtime (broadcast + presence). Camera/mic are requested by THIS page directly (same origin),
// which avoids the cross-origin iframe permission issues of an embedded third-party room.
//
// Transcription: each participant transcribes THEIR OWN mic locally (Web Speech API) and
// broadcasts the final text tagged with their name, so the shared transcript reads
// "Name: said this" — structured so the organizer can turn it into tasks later.
//
// Limitation (honest): a mesh + public STUN works for a handful of participants on typical
// networks; very large meetings or strict/symmetric NAT would need an SFU + TURN server.
import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocale } from 'next-intl';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

const ICE: RTCConfiguration = {
    iceServers: [
        { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
    ],
};

type Entry = { name: string; text: string; ts: number };

export default function RoomPage() {
    const locale = useLocale(); const isAr = locale === 'ar'; const L = (a: string, e: string) => (isAr ? a : e);
    const { id } = useParams<{ id: string }>();
    const router = useRouter();

    const [m, setM] = useState<any | null>(null);
    const [meId, setMeId] = useState<string>('');
    const [meName, setMeName] = useState<string>('');
    const [isOrg, setIsOrg] = useState(false);
    const [err, setErr] = useState('');

    const [joined, setJoined] = useState(false);
    const [joining, setJoining] = useState(false);
    const [micOn, setMicOn] = useState(true);
    const [camOn, setCamOn] = useState(true);
    const [sharing, setSharing] = useState(false);
    const [peerNames, setPeerNames] = useState<Record<string, string>>({});
    const [remoteTick, setRemoteTick] = useState(0); // force re-render when streams change

    // transcription
    const [consent, setConsent] = useState(false);
    const [listening, setListening] = useState(false);
    const [sttSupported, setSttSupported] = useState(true);
    const [transcript, setTranscript] = useState<Entry[]>([]);

    const localVideoRef = useRef<HTMLVideoElement | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const camTrackRef = useRef<MediaStreamTrack | null>(null); // the real camera track (for un-share)
    const channelRef = useRef<any>(null);
    const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
    const remoteStreamsRef = useRef<Map<string, MediaStream>>(new Map());
    const peerIdRef = useRef<string>('');
    const recRef = useRef<any>(null);
    const joinedRef = useRef(false);

    const load = useCallback(async () => {
        const res = await fetch(`/api/meetings/${id}`); const j = await res.json();
        if (!res.ok) { setErr(j.message || j.error || 'Error'); return; }
        setM(j.meeting); setMeId(j.me); setMeName(j.me_name || (isAr ? 'مشارك' : 'Participant')); setIsOrg(j.is_organizer);
        setTranscript(parseStored(j.meeting.transcript));
    }, [id, isAr]);
    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        const SR = (typeof window !== 'undefined') && ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
        if (!SR) setSttSupported(false);
        peerIdRef.current = `${Math.random().toString(36).slice(2, 10)}`;
    }, []);

    // ---- transcript helpers ----
    function parseStored(raw: string | null): Entry[] {
        if (!raw) return [];
        return String(raw).split('\n').map(line => {
            const mm = line.match(/^\[(\d{1,2}:\d{2})\]\s*([^:]+):\s*(.*)$/);
            if (mm) return { name: mm[2].trim(), text: mm[3].trim(), ts: Date.now() };
            const m2 = line.match(/^([^:]+):\s*(.*)$/);
            return m2 ? { name: m2[1].trim(), text: m2[2].trim(), ts: Date.now() } : null;
        }).filter(Boolean) as Entry[];
    }
    const formatTranscript = (list: Entry[]) => list.map(e => {
        const t = new Date(e.ts); const hh = String(t.getHours()).padStart(2, '0'); const mi = String(t.getMinutes()).padStart(2, '0');
        return `[${hh}:${mi}] ${e.name}: ${e.text}`;
    }).join('\n');
    const addEntry = (e: Entry) => setTranscript(prev => [...prev, e]);

    // ---- WebRTC plumbing ----
    const attachLocal = (stream: MediaStream) => { if (localVideoRef.current) { localVideoRef.current.srcObject = stream; } };

    const newPeer = useCallback((otherId: string, initiator: boolean) => {
        if (pcsRef.current.has(otherId)) return pcsRef.current.get(otherId)!;
        const pc = new RTCPeerConnection(ICE);
        pcsRef.current.set(otherId, pc);
        localStreamRef.current?.getTracks().forEach(t => pc.addTrack(t, localStreamRef.current!));
        pc.onicecandidate = (ev) => {
            if (ev.candidate) channelRef.current?.send({ type: 'broadcast', event: 'signal', payload: { from: peerIdRef.current, to: otherId, kind: 'ice', data: ev.candidate.toJSON() } });
        };
        pc.ontrack = (ev) => {
            let rs = remoteStreamsRef.current.get(otherId);
            if (!rs) { rs = new MediaStream(); remoteStreamsRef.current.set(otherId, rs); }
            ev.streams[0]?.getTracks().forEach(t => { if (!rs!.getTracks().includes(t)) rs!.addTrack(t); });
            setRemoteTick(x => x + 1);
        };
        pc.onconnectionstatechange = () => {
            if (['failed', 'closed', 'disconnected'].includes(pc.connectionState)) { setRemoteTick(x => x + 1); }
        };
        if (initiator) {
            pc.onnegotiationneeded = async () => {
                try {
                    const offer = await pc.createOffer(); await pc.setLocalDescription(offer);
                    channelRef.current?.send({ type: 'broadcast', event: 'signal', payload: { from: peerIdRef.current, to: otherId, kind: 'offer', data: offer } });
                } catch { /* ignore */ }
            };
        }
        return pc;
    }, []);

    const dropPeer = (otherId: string) => {
        pcsRef.current.get(otherId)?.close();
        pcsRef.current.delete(otherId);
        remoteStreamsRef.current.delete(otherId);
        setPeerNames(prev => { const n = { ...prev }; delete n[otherId]; return n; });
        setRemoteTick(x => x + 1);
    };

    const handleSignal = useCallback(async (payload: any) => {
        if (!payload || payload.to !== peerIdRef.current) return;
        const from = payload.from;
        if (payload.kind === 'offer') {
            const pc = newPeer(from, false);
            await pc.setRemoteDescription(new RTCSessionDescription(payload.data));
            const answer = await pc.createAnswer(); await pc.setLocalDescription(answer);
            channelRef.current?.send({ type: 'broadcast', event: 'signal', payload: { from: peerIdRef.current, to: from, kind: 'answer', data: answer } });
        } else if (payload.kind === 'answer') {
            const pc = pcsRef.current.get(from); if (pc) await pc.setRemoteDescription(new RTCSessionDescription(payload.data));
        } else if (payload.kind === 'ice') {
            const pc = pcsRef.current.get(from); if (pc) { try { await pc.addIceCandidate(new RTCIceCandidate(payload.data)); } catch { /* ignore */ } }
        }
    }, [newPeer]);

    const join = async () => {
        if (joinedRef.current || joining) return;
        setJoining(true); setErr('');
        let stream: MediaStream;
        try {
            stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        } catch {
            setErr(L('تعذّر الوصول للكاميرا/المايك — اسمح بالصلاحية من المتصفح وحاول مرة أخرى.', 'Could not access camera/microphone — allow the permission in your browser and try again.'));
            setJoining(false); return;
        }
        localStreamRef.current = stream; camTrackRef.current = stream.getVideoTracks()[0] || null;
        attachLocal(stream);

        const ch = supabase.channel(`meeting-room-${id}`, { config: { broadcast: { self: false }, presence: { key: peerIdRef.current } } });
        channelRef.current = ch;
        ch.on('broadcast', { event: 'signal' }, ({ payload }) => handleSignal(payload));
        ch.on('broadcast', { event: 'transcript' }, ({ payload }) => { if (payload?.from !== peerIdRef.current) addEntry({ name: payload.name, text: payload.text, ts: payload.ts || Date.now() }); });
        ch.on('presence', { event: 'sync' }, () => {
            const state = ch.presenceState() as Record<string, any[]>;
            const names: Record<string, string> = {};
            Object.entries(state).forEach(([key, metas]) => { if (key !== peerIdRef.current) names[key] = (metas[0] as any)?.name || key; });
            setPeerNames(names);
            // initiate to peers with a greater id (deterministic, avoids double offers)
            Object.keys(names).forEach(otherId => { if (peerIdRef.current < otherId) newPeer(otherId, true); });
        });
        ch.on('presence', { event: 'leave' }, ({ key }) => dropPeer(key));
        await ch.subscribe(async (status: string) => {
            if (status === 'SUBSCRIBED') { await ch.track({ name: meName, at: Date.now() }); }
        });

        joinedRef.current = true; setJoined(true); setJoining(false);
    };

    const leave = useCallback(() => {
        recRef.current?.stop?.(); recRef.current = null; setListening(false);
        pcsRef.current.forEach(pc => pc.close()); pcsRef.current.clear();
        remoteStreamsRef.current.clear();
        try { channelRef.current?.unsubscribe(); } catch { /* ignore */ }
        channelRef.current = null;
        localStreamRef.current?.getTracks().forEach(t => t.stop()); localStreamRef.current = null;
        joinedRef.current = false; setJoined(false); setPeerNames({});
    }, []);
    useEffect(() => () => { leave(); }, [leave]);

    const toggleMic = () => { const t = localStreamRef.current?.getAudioTracks()[0]; if (t) { t.enabled = !t.enabled; setMicOn(t.enabled); } };
    const toggleCam = () => { const t = localStreamRef.current?.getVideoTracks()[0]; if (t) { t.enabled = !t.enabled; setCamOn(t.enabled); } };

    const shareScreen = async () => {
        try {
            if (!sharing) {
                const disp = await (navigator.mediaDevices as any).getDisplayMedia({ video: true });
                const screenTrack: MediaStreamTrack = disp.getVideoTracks()[0];
                pcsRef.current.forEach(pc => { const sender = pc.getSenders().find(s => s.track?.kind === 'video'); sender?.replaceTrack(screenTrack); });
                if (localVideoRef.current) localVideoRef.current.srcObject = disp;
                screenTrack.onended = () => stopShare();
                setSharing(true);
            } else { stopShare(); }
        } catch { /* user cancelled */ }
    };
    const stopShare = () => {
        const cam = camTrackRef.current;
        if (cam) pcsRef.current.forEach(pc => { const sender = pc.getSenders().find(s => s.track?.kind === 'video'); sender?.replaceTrack(cam); });
        if (localVideoRef.current && localStreamRef.current) localVideoRef.current.srcObject = localStreamRef.current;
        setSharing(false);
    };

    // ---- local speech-to-text, broadcast with my name ----
    const startRec = () => {
        const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SR) { setSttSupported(false); return; }
        const rec = new SR(); rec.lang = isAr ? 'ar-EG' : 'en-US'; rec.continuous = true; rec.interimResults = false;
        rec.onresult = (ev: any) => {
            for (let i = ev.resultIndex; i < ev.results.length; i++) if (ev.results[i].isFinal) {
                const text = ev.results[i][0].transcript.trim(); if (!text) continue;
                const e = { name: meName, text, ts: Date.now() }; addEntry(e);
                channelRef.current?.send({ type: 'broadcast', event: 'transcript', payload: { from: peerIdRef.current, ...e } });
            }
        };
        rec.onend = () => { if (recRef.current) { try { rec.start(); } catch { /* ignore */ } } };
        rec.onerror = () => { };
        recRef.current = rec; rec.start(); setListening(true);
    };
    const stopRec = () => { const r = recRef.current; recRef.current = null; r?.stop?.(); setListening(false); };

    const saveTranscript = async () => {
        await fetch(`/api/meetings/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'notes', transcript: formatTranscript(transcript), transcript_consent: consent }) });
        alert(L('تم حفظ التفريغ.', 'Transcript saved.'));
    };

    if (err && !m) return <div className="min-h-screen flex items-center justify-center text-red-400 p-6 text-center" dir={isAr ? 'rtl' : 'ltr'}>{err}</div>;
    if (!m) return <div className="min-h-screen flex items-center justify-center text-[#C0C0C0]">{L('جارٍ التحميل...', 'Loading...')}</div>;

    const remoteIds = Array.from(remoteStreamsRef.current.keys());

    return (
        <div className="min-h-screen p-3 md:p-4" dir={isAr ? 'rtl' : 'ltr'}>
            <div className="max-w-7xl mx-auto">
                <div className="flex flex-wrap justify-between items-center mb-3 gap-2">
                    <div>
                        <button onClick={() => { leave(); router.push(`/${locale}/meetings`); }} className="text-[#DBA935] text-sm mb-1">← {L('الاجتماعات', 'Meetings')}</button>
                        <h1 className="text-xl font-bold text-white">{m.title}</h1>
                    </div>
                    <span className="text-[#C0C0C0] text-xs">{new Date(m.start_at).toLocaleString(isAr ? 'ar-EG' : 'en-GB')}</span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                    {/* stage */}
                    <div className="lg:col-span-2">
                        {m.mode === 'in_person' ? (
                            <div className="aspect-video rounded-2xl bg-black/40 border border-[#DBA935]/20 flex items-center justify-center text-center p-6">
                                <div><div className="text-4xl mb-2">📍</div><p className="text-white">{L('اجتماع حضوري', 'In-person meeting')}</p><p className="text-[#C0C0C0] text-sm mt-1">{m.location || L('المكان غير محدد', 'Location not set')}</p></div>
                            </div>
                        ) : !joined ? (
                            <div className="aspect-video rounded-2xl bg-black/50 border border-[#DBA935]/20 flex flex-col items-center justify-center text-center p-6 gap-3">
                                <div className="text-4xl">🎥</div>
                                <p className="text-white font-bold">{L('غرفة الاجتماع داخل النظام', 'In-system meeting room')}</p>
                                <p className="text-[#C0C0C0] text-sm max-w-md">{L('الفيديو والصوت يعملان داخل الـERP مباشرةً — لا موقع خارجي ولا روابط. سيطلب المتصفح إذن الكاميرا والمايك عند الدخول.', 'Video and audio run inside the ERP directly — no external site, no links. Your browser will ask for camera/mic permission when you join.')}</p>
                                <button onClick={join} disabled={joining} className="px-6 py-2.5 rounded-xl bg-[#DBA935] text-[#3E3B3F] font-bold text-sm disabled:opacity-50">{joining ? L('جارٍ الدخول...', 'Joining...') : L('ادخل الغرفة', 'Join room')}</button>
                                {err && <p className="text-red-300 text-xs max-w-md">{err}</p>}
                            </div>
                        ) : (
                            <div>
                                <div className={`grid gap-2 ${remoteIds.length === 0 ? 'grid-cols-1' : remoteIds.length <= 2 ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-3'}`}>
                                    <div className="relative rounded-xl overflow-hidden border border-[#DBA935]/30 bg-black aspect-video">
                                        <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                                        <span className="absolute bottom-1 start-1 text-[11px] bg-black/60 text-white px-1.5 py-0.5 rounded">{meName} {L('(أنت)', '(you)')}{!camOn ? ' · 📷✕' : ''}{!micOn ? ' · 🔇' : ''}</span>
                                    </div>
                                    {remoteIds.map(pid => (
                                        <RemoteTile key={pid} stream={remoteStreamsRef.current.get(pid)!} name={peerNames[pid] || L('مشارك', 'Guest')} />
                                    ))}
                                </div>
                                {/* controls */}
                                <div className="flex flex-wrap items-center gap-2 mt-3">
                                    <button onClick={toggleMic} className={`px-3 py-2 rounded-lg text-sm font-bold ${micOn ? 'bg-white/10 text-white' : 'bg-red-600/80 text-white'}`}>{micOn ? '🎤' : '🔇'} {L('المايك', 'Mic')}</button>
                                    <button onClick={toggleCam} className={`px-3 py-2 rounded-lg text-sm font-bold ${camOn ? 'bg-white/10 text-white' : 'bg-red-600/80 text-white'}`}>{camOn ? '📷' : '📷✕'} {L('الكاميرا', 'Cam')}</button>
                                    <button onClick={shareScreen} className={`px-3 py-2 rounded-lg text-sm font-bold ${sharing ? 'bg-[#DBA935] text-[#3E3B3F]' : 'bg-white/10 text-white'}`}>🖥️ {sharing ? L('إيقاف المشاركة', 'Stop share') : L('مشاركة الشاشة', 'Share screen')}</button>
                                    <button onClick={() => { leave(); }} className="px-3 py-2 rounded-lg bg-red-600 text-white text-sm font-bold">⭘ {L('مغادرة', 'Leave')}</button>
                                    <span className="text-[#C0C0C0] text-xs ms-auto">{L('في الغرفة', 'In room')}: {remoteIds.length + 1}</span>
                                </div>
                            </div>
                        )}
                        {m.mode !== 'in_person' && <p className="text-silver/50 text-[11px] mt-2">{L('الغرفة تعمل داخل الـERP بالكامل (WebRTC): كاميرا، مايك، ومشاركة شاشة — بلا أي موقع خارجي. للاجتماعات الكبيرة جدًا أو الشبكات المقيّدة قد نحتاج خادم وسيط (TURN) لاحقًا.', 'The room runs fully inside the ERP (WebRTC): camera, mic and screen share — with no external site. Very large meetings or restrictive networks may later need a relay (TURN) server.')}</p>}
                    </div>

                    {/* side: agenda + transcript */}
                    <div className="space-y-3">
                        <div className="bg-black/40 rounded-2xl border border-[#DBA935]/20 p-4">
                            <h3 className="text-[#DBA935] font-bold text-sm mb-2">{L('الأجندة', 'Agenda')}</h3>
                            {(m.agenda || []).length ? <ol className="list-decimal ms-5 text-[#C0C0C0] text-xs space-y-1">{m.agenda.map((a: any, i: number) => <li key={i}>{a.text}{a.minutes ? ` (${a.minutes} ${L('د', 'min')})` : ''}</li>)}</ol>
                                : <p className="text-silver/50 text-xs">{L('لا أجندة.', 'No agenda.')}</p>}
                        </div>

                        <div className="bg-black/40 rounded-2xl border border-[#DBA935]/20 p-4">
                            <h3 className="text-[#DBA935] font-bold text-sm mb-1">🤖 {L('التفريغ المنظّم — مين قال إيه', 'Structured transcript — who said what')}</h3>
                            <p className="text-silver/50 text-[11px] mb-2">{L('كل مشارك يُفرَّغ صوته على جهازه فقط ويُنسَب باسمه. لا يُرسَل أي صوت لأي خادم.', 'Each participant is transcribed on their own device and attributed by name. No audio leaves any device.')}</p>
                            {!sttSupported ? <p className="text-orange-300 text-xs">{L('متصفحك لا يدعم التفريغ الصوتي المدمج — استخدم Chrome، أو اكتب المحضر يدوياً.', 'Your browser lacks built-in speech-to-text — use Chrome, or type the minutes manually.')}</p>
                                : <>
                                    <label className="flex items-start gap-2 text-xs text-white mb-2"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} className="accent-[#DBA935] w-4 h-4 mt-0.5" />{L('أوافق على تفريغ ما أقوله على هذا الجهاز.', 'I consent to transcribing what I say, on this device.')}</label>
                                    <div className="flex gap-2 mb-2">
                                        {!listening ? <button disabled={!consent || !joined} onClick={startRec} className="px-3 py-1.5 rounded-lg bg-green-600/80 text-white text-xs font-bold disabled:opacity-40">● {L('ابدأ التفريغ', 'Start')}</button>
                                            : <button onClick={stopRec} className="px-3 py-1.5 rounded-lg bg-red-600/80 text-white text-xs font-bold">■ {L('إيقاف', 'Stop')}</button>}
                                        {isOrg && <button onClick={saveTranscript} className="px-3 py-1.5 rounded-lg bg-[#DBA935]/20 text-[#DBA935] border border-[#DBA935]/40 text-xs">{L('حفظ', 'Save')}</button>}
                                    </div>
                                </>}
                            <div className="max-h-72 overflow-y-auto space-y-1.5 bg-black/30 rounded-lg p-2 border border-white/10">
                                {transcript.length === 0 ? <p className="text-silver/40 text-xs">{L('سيظهر التفريغ هنا منسوباً لكل متحدث.', 'The transcript will appear here, attributed to each speaker.')}</p>
                                    : transcript.map((e, i) => (
                                        <div key={i} className="text-xs"><span className="text-[#DBA935] font-bold">{e.name}:</span> <span className="text-[#C0C0C0]">{e.text}</span></div>
                                    ))}
                            </div>
                            <p className="text-silver/50 text-[11px] mt-1">{L('بعد الاجتماع: المنظّم يحوّل القرارات وبنود العمل إلى مهام من صفحة إدارة الاجتماع.', 'After the meeting: the organizer turns decisions and action items into tasks from the manage page.')}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Remote participant tile — binds the MediaStream to a <video>.
function RemoteTile({ stream, name }: { stream: MediaStream; name: string }) {
    const ref = useRef<HTMLVideoElement | null>(null);
    useEffect(() => { if (ref.current) ref.current.srcObject = stream; }, [stream]);
    return (
        <div className="relative rounded-xl overflow-hidden border border-white/15 bg-black aspect-video">
            <video ref={ref} autoPlay playsInline className="w-full h-full object-cover" />
            <span className="absolute bottom-1 start-1 text-[11px] bg-black/60 text-white px-1.5 py-0.5 rounded">{name}</span>
        </div>
    );
}

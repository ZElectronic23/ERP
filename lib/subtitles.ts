// Subtitle parsing/serialisation for translating captions while preserving timestamps.
// Accepts SRT or WebVTT, returns WebVTT (what <track> needs). Translation of the cue text is
// done by the caller via the translation service, so timestamps stay byte-for-byte intact.

export type Cue = { start: string; end: string; text: string };

// Normalise a timestamp to VTT form (HH:MM:SS.mmm). SRT uses a comma for milliseconds.
function normTime(t: string): string {
    t = t.trim().replace(',', '.');
    // allow MM:SS.mmm → 00:MM:SS.mmm
    if (/^\d{1,2}:\d{2}\.\d{1,3}$/.test(t)) t = '00:' + t;
    return t;
}

export function parseSubtitles(raw: string): Cue[] {
    const text = (raw || '').replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
    if (!text) return [];
    const body = text.replace(/^WEBVTT[^\n]*\n/, '').trim();
    const blocks = body.split(/\n\s*\n/);
    const cues: Cue[] = [];
    for (const block of blocks) {
        const lines = block.split('\n').filter(l => l.trim() !== '');
        const tlIdx = lines.findIndex(l => l.includes('-->'));
        if (tlIdx === -1) continue;
        const m = lines[tlIdx].match(/([\d:.,]+)\s*-->\s*([\d:.,]+)/);
        if (!m) continue;
        const txt = lines.slice(tlIdx + 1).join('\n').trim();
        if (!txt) continue;
        cues.push({ start: normTime(m[1]), end: normTime(m[2]), text: txt });
    }
    return cues;
}

export function serializeVtt(cues: Cue[]): string {
    const body = cues.map((c, i) => `${i + 1}\n${c.start} --> ${c.end}\n${c.text}`).join('\n\n');
    return `WEBVTT\n\n${body}\n`;
}

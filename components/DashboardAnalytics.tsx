'use client';

import { useState, useEffect } from 'react';
import {
    ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';

const COLORS = ['#DBA935', '#60a5fa', '#4ade80', '#f87171', '#a78bfa', '#fb923c', '#C0C0C0', '#facc15'];

type ChartType = 'bar' | 'pie' | 'line';

export default function DashboardAnalytics({ locale = 'ar' }: { locale?: string }) {
    const isAr = locale === 'ar';
    const L = (ar: string, en: string) => (isAr ? ar : en);
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');
    const [analysis, setAnalysis] = useState('financial');
    const [chart, setChart] = useState<ChartType>('bar');

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch('/api/dashboard/analytics');
                const j = await res.json();
                if (!res.ok) throw new Error(j.error || 'Error');
                setData(j);
            } catch (e: any) { setErr(e.message); }
            finally { setLoading(false); }
        })();
    }, []);

    const ANALYSES: { key: string; ar: string; en: string; default: ChartType; monthly?: boolean }[] = [
        { key: 'financial', ar: 'الأرباح والمصروفات', en: 'Profit & expenses', default: 'bar' },
        { key: 'monthly', ar: 'الإيرادات مقابل المصروفات (شهرياً)', en: 'Revenue vs expenses (monthly)', default: 'line', monthly: true },
        { key: 'receivables', ar: 'المستحقات (ديون العملاء)', en: 'Receivables (client debts)', default: 'bar' },
        { key: 'projectsByStatus', ar: 'حالة المشاريع', en: 'Projects by status', default: 'pie' },
        { key: 'employeesByDept', ar: 'الموظفون حسب الإدارة', en: 'Employees by department', default: 'bar' },
    ];
    const current = ANALYSES.find(a => a.key === analysis)!;
    const rows: any[] = data?.[analysis] || [];
    const money = (n: number) => Number(n || 0).toLocaleString();

    const pick = (key: string) => {
        const a = ANALYSES.find(x => x.key === key)!;
        setAnalysis(key);
        setChart(a.default);
    };

    const axis = { stroke: '#C0C0C0', fontSize: 11 };
    const tooltipStyle = { backgroundColor: '#1a1a1e', border: '1px solid #DBA935', borderRadius: 10, color: '#fff', fontSize: 12 };

    const renderChart = () => {
        if (current.monthly) {
            return (
                <LineChart data={rows}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff14" />
                    <XAxis dataKey="name" {...axis} /><YAxis {...axis} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend wrapperStyle={{ fontSize: 12, color: '#C0C0C0' }} />
                    <Line type="monotone" dataKey="revenue" name={L('الإيرادات', 'Revenue')} stroke="#4ade80" strokeWidth={2} />
                    <Line type="monotone" dataKey="expenses" name={L('المصروفات', 'Expenses')} stroke="#f87171" strokeWidth={2} />
                </LineChart>
            );
        }
        if (chart === 'pie') {
            return (
                <PieChart>
                    <Pie data={rows} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={(e: any) => `${e.name}: ${money(e.value)}`}>
                        {rows.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => money(v)} />
                </PieChart>
            );
        }
        if (chart === 'line') {
            return (
                <LineChart data={rows}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff14" />
                    <XAxis dataKey="name" {...axis} /><YAxis {...axis} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => money(v)} />
                    <Line type="monotone" dataKey="value" name={isAr ? current.ar : current.en} stroke="#DBA935" strokeWidth={2} />
                </LineChart>
            );
        }
        return (
            <BarChart data={rows}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff14" />
                <XAxis dataKey="name" {...axis} /><YAxis {...axis} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => money(v)} cursor={{ fill: '#ffffff08' }} />
                <Bar dataKey="value" name={isAr ? current.ar : current.en} radius={[6, 6, 0, 0]}>
                    {rows.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
            </BarChart>
        );
    };

    return (
        <div className="bg-black/40 backdrop-blur-sm p-4 md:p-5 rounded-3xl border border-[#DBA935]/20" dir={isAr ? 'rtl' : 'ltr'}>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <h2 className="text-[#DBA935] font-bold">{L('التحليلات', 'Analytics')}</h2>
                {!current.monthly && (
                    <div className="flex gap-1 bg-black/30 rounded-lg p-1 border border-[#DBA935]/20">
                        {([['bar', L('أعمدة', 'Bar')], ['pie', L('دائرة', 'Pie')], ['line', L('خطي', 'Line')]] as const).map(([k, lab]) => (
                            <button key={k} onClick={() => setChart(k as ChartType)} className={`px-3 py-1 rounded-md text-xs transition ${chart === k ? 'bg-[#DBA935] text-[#3E3B3F] font-bold' : 'text-[#C0C0C0] hover:bg-[#DBA935]/10'}`}>{lab}</button>
                        ))}
                    </div>
                )}
            </div>

            {/* analysis selector */}
            <div className="flex flex-wrap gap-2 mb-4">
                {ANALYSES.map(a => (
                    <button key={a.key} onClick={() => pick(a.key)} className={`px-3 py-1.5 rounded-lg text-xs transition ${analysis === a.key ? 'bg-[#DBA935] text-[#3E3B3F] font-bold' : 'bg-white/5 text-[#C0C0C0] hover:bg-white/10'}`}>
                        {isAr ? a.ar : a.en}
                    </button>
                ))}
            </div>

            {loading ? <div className="text-center py-16 text-[#C0C0C0]">{L('جارٍ تحميل البيانات...', 'Loading data...')}</div>
                : err ? <div className="text-center py-16 text-red-400 text-sm">{err}</div>
                    : rows.length === 0 ? <div className="text-center py-16 text-[#C0C0C0] text-sm">{L('لا توجد بيانات كافية لهذا التحليل بعد', 'Not enough data for this analysis yet')}</div>
                        : (
                            <div style={{ width: '100%', height: 320 }}>
                                <ResponsiveContainer>{renderChart()}</ResponsiveContainer>
                            </div>
                        )}
        </div>
    );
}

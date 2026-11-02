'use client';

import { useFormStatus } from 'react-dom';

export default function ClientForm({
    action,
    locale,
    initialData = {},
}: {
    action: (formData: FormData) => void;
    locale: string;
    initialData?: any;
}) {
    const { pending } = useFormStatus();
    const isAr = locale === 'ar';
    const L = (ar: string, en: string) => (isAr ? ar : en);

    const formatDisValue = (val: number | null) => {
        if (val === null || val === undefined) return '';
        return (val * 100).toString();
    };

    const field = 'w-full px-3 py-2 bg-[#0a0a0c] border border-silver/30 rounded-lg text-white placeholder-silver/50 focus:outline-none focus:border-gold transition-all text-sm';
    const lbl = 'block text-silver mb-1 text-xs';

    return (
        <form action={action} className="max-w-4xl mx-auto bg-black/40 backdrop-blur-sm shadow-2xl rounded-3xl border border-[#DBA935]/20 p-5 md:p-6" dir={isAr ? 'rtl' : 'ltr'}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className={lbl}>{L('اسم العميل', 'Client Name')} <span className="text-red-500">*</span></label>
                    <input type="text" name="ClientName" defaultValue={initialData.ClientName} required className={field} />
                </div>

                <div>
                    <label className={lbl}>{L('تصنيف العميل', 'Client Category')}</label>
                    <select name="client_kind" defaultValue={initialData.client_kind || 'actual'} className={field}>
                        <option value="actual">{L('عميل فعلي', 'Actual client')}</option>
                        <option value="potential">{L('عميل محتمل', 'Potential lead')}</option>
                    </select>
                </div>

                <div>
                    <label className={lbl}>{L('نوع العميل', 'Client Type')}</label>
                    <input type="text" name="Client Type" defaultValue={initialData['Client Type']} className={field} placeholder={L('مثال: شركة، فرد، منتجع', 'e.g. company, individual')} />
                </div>

                <div>
                    <label className={lbl}>{L('الجوال', 'Mobile No.')}</label>
                    <input type="tel" name="Mobile No." defaultValue={initialData['Mobile No.']} className={field} dir="ltr" />
                </div>

                <div>
                    <label className={lbl}>{L('البريد الإلكتروني', 'E-Mail')}</label>
                    <input type="email" name="E-Mail" defaultValue={initialData['E-Mail']} className={field} dir="ltr" />
                </div>

                <div className="md:col-span-2">
                    <label className={lbl}>{L('العنوان', 'Address')}</label>
                    <textarea name="Address" defaultValue={initialData.Address} rows={2} className={field} />
                </div>

                <div>
                    <label className={lbl}>{L('سبب الخصم', 'Discount Reason')}</label>
                    <input type="text" name="DisReason" defaultValue={initialData.DisReason} className={field} />
                </div>

                <div>
                    <label className={lbl}>{L('قيمة الخصم (%)', 'Discount Value (%)')}</label>
                    <input type="number" name="DisValue" defaultValue={formatDisValue(initialData.DisValue)} step="0.01" min="0" max="100" className={field} dir="ltr" />
                </div>

                <div>
                    <label className={lbl}>{L('تكرار المتابعة', 'Follow-up Frequency')}</label>
                    <input type="text" name="FollowUpFrequency" defaultValue={initialData.FollowUpFrequency} className={field} placeholder={L('مثال: شهريًا، كل 3 شهور', 'e.g. monthly')} />
                </div>

                <div>
                    <label className={lbl}>{L('طريقة المتابعة', 'Follow-up Method')}</label>
                    <input type="text" name="FollowUpMethod" defaultValue={initialData.FollowUpMethod} className={field} placeholder={L('مثال: اتصال، بريد', 'e.g. call, email')} />
                </div>

                <div>
                    <label className={lbl}>{L('آخر متابعة', 'Last Follow-up Date')}</label>
                    <input type="date" name="LastFollowUpDate" defaultValue={initialData.LastFollowUpDate?.split('T')[0]} className={field} />
                </div>

                <div>
                    <label className={lbl}>{L('المتابعة القادمة', 'Next Follow-up Date')}</label>
                    <input type="date" name="NextFollowUpDate" defaultValue={initialData.NextFollowUpDate?.split('T')[0]} className={field} />
                </div>

                <div className="md:col-span-2">
                    <label className={lbl}>{L('ملاحظات (تعاملات، مستحقات، تنبيهات...)', 'Notes (dealings, dues, warnings...)')}</label>
                    <textarea name="notes" defaultValue={initialData.notes} rows={3} className={field}
                        placeholder={L('مثال: عليه مستحقات متأخرة / عميل صعب في التعامل / يفضّل التواصل مساءً', 'e.g. has overdue dues / difficult to deal with / prefers evening contact')} />
                </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
                <button type="button" onClick={() => window.history.back()} className="px-5 py-2 bg-silver/10 rounded-lg text-silver hover:bg-silver/20 transition text-sm">
                    {L('إلغاء', 'Cancel')}
                </button>
                <button type="submit" disabled={pending} className="px-6 py-2 bg-[#DBA935] text-[#3E3B3F] font-bold rounded-lg hover:bg-[#DBA935]/90 transition disabled:opacity-50 text-sm">
                    {pending ? L('جارٍ الحفظ...', 'Saving...') : L('حفظ', 'Save')}
                </button>
            </div>
        </form>
    );
}

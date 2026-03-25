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

    // دالة لتحويل القيم الرقمية إلى نسبة مئوية للعرض
    const formatDisValue = (val: number | null) => {
        if (val === null || val === undefined) return '';
        return (val * 100).toString();
    };

    return (
        <form action={action} className="max-w-4xl mx-auto bg-white shadow rounded-lg p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* ClientName */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Client Name <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        name="ClientName"
                        defaultValue={initialData.ClientName}
                        required
                        className="w-full border rounded px-3 py-2"
                    />
                </div>

                {/* Client Type */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Client Type
                    </label>
                    <input
                        type="text"
                        name="Client Type"
                        defaultValue={initialData['Client Type']}
                        className="w-full border rounded px-3 py-2"
                        placeholder="مثال: شركة، فرد، منتجع"
                    />
                </div>

                {/* Mobile No. */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Mobile No.
                    </label>
                    <input
                        type="tel"
                        name="Mobile No."
                        defaultValue={initialData['Mobile No.']}
                        className="w-full border rounded px-3 py-2"
                    />
                </div>

                {/* E-Mail */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        E-Mail
                    </label>
                    <input
                        type="email"
                        name="E-Mail"
                        defaultValue={initialData['E-Mail']}
                        className="w-full border rounded px-3 py-2"
                    />
                </div>

                {/* Address */}
                <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Address
                    </label>
                    <textarea
                        name="Address"
                        defaultValue={initialData.Address}
                        rows={2}
                        className="w-full border rounded px-3 py-2"
                    />
                </div>

                {/* DisReason و DisValue */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Discount Reason
                    </label>
                    <input
                        type="text"
                        name="DisReason"
                        defaultValue={initialData.DisReason}
                        className="w-full border rounded px-3 py-2"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Discount Value (%)
                    </label>
                    <input
                        type="number"
                        name="DisValue"
                        defaultValue={formatDisValue(initialData.DisValue)}
                        step="0.01"
                        min="0"
                        max="100"
                        className="w-full border rounded px-3 py-2"
                        onChange={(e) => {
                            // تحويل النسبة المئوية إلى رقم عشري قبل الإرسال
                            // لكن FormData سترسل النص، سنقوم بالتحويل في الـ server action
                        }}
                    />
                </div>

                {/* Follow-up Fields */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Follow-up Frequency
                    </label>
                    <input
                        type="text"
                        name="FollowUpFrequency"
                        defaultValue={initialData.FollowUpFrequency}
                        className="w-full border rounded px-3 py-2"
                        placeholder="مثال: شهريًا، كل 3 شهور"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Follow-up Method
                    </label>
                    <input
                        type="text"
                        name="FollowUpMethod"
                        defaultValue={initialData.FollowUpMethod}
                        className="w-full border rounded px-3 py-2"
                        placeholder="مثال: اتصال، بريد إلكتروني"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Last Follow-up Date
                    </label>
                    <input
                        type="date"
                        name="LastFollowUpDate"
                        defaultValue={initialData.LastFollowUpDate?.split('T')[0]}
                        className="w-full border rounded px-3 py-2"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Next Follow-up Date
                    </label>
                    <input
                        type="date"
                        name="NextFollowUpDate"
                        defaultValue={initialData.NextFollowUpDate?.split('T')[0]}
                        className="w-full border rounded px-3 py-2"
                    />
                </div>
            </div>

            {/* Buttons */}
            <div className="flex justify-end gap-4 mt-6">
                <button
                    type="button"
                    onClick={() => window.history.back()}
                    className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    disabled={pending}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                    {pending ? 'Saving...' : 'Save'}
                </button>
            </div>
        </form>
    );
}
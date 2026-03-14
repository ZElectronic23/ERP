// components/data/Pagination.tsx
'use client';

interface PaginationProps {
    currentPage: number;
    totalPages: number;
    totalCount: number;
    limit: number;
    onPageChange: (page: number) => void;
    onLimitChange?: (limit: number) => void;
    language: 'ar' | 'en';
    limitOptions?: number[];
}

export default function Pagination({
    currentPage,
    totalPages,
    totalCount,
    limit,
    onPageChange,
    onLimitChange,
    language,
    limitOptions = [10, 25, 50, 100],
}: PaginationProps) {
    const from = (currentPage - 1) * limit + 1;
    const to = Math.min(currentPage * limit, totalCount);

    return (
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 bg-[#2a2a2a] rounded-xl border border-[#3E3B3F] shadow-sm text-xs">
            {/* معلومات العدد */}
            <div className="text-silver">
                {language === 'ar'
                    ? `${from} - ${to} من ${totalCount}`
                    : `${from} - ${to} of ${totalCount}`}
            </div>

            {/* اختيار عدد العناصر */}
            {onLimitChange && (
                <div className="flex items-center gap-2">
                    <span className="text-silver">{language === 'ar' ? 'عرض:' : 'Show:'}</span>
                    <select
                        value={limit}
                        onChange={(e) => onLimitChange(Number(e.target.value))}
                        className="bg-[#1a1a1a] border border-[#3E3B3F] rounded-lg px-2 py-1 text-white text-xs focus:outline-none focus:border-gold hover:border-gold transition-colors"
                    >
                        {limitOptions.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                        ))}
                    </select>
                </div>
            )}

            {/* أزرار التنقل */}
            <div className="flex items-center gap-1">
                <button
                    onClick={() => onPageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className={`px-3 py-1 rounded-lg transition-all ${currentPage === 1
                            ? 'text-silver/40 cursor-not-allowed bg-transparent'
                            : 'text-silver hover:bg-gold/20 hover:text-gold border border-transparent hover:border-gold/30'
                        }`}
                >
                    {language === 'ar' ? 'السابق' : 'Prev'}
                </button>

                {/* عرض الصفحات كأرقام (اختياري، يمكن إضافته لاحقاً) */}
                <span className="text-silver px-2">
                    {currentPage} / {totalPages}
                </span>

                <button
                    onClick={() => onPageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className={`px-3 py-1 rounded-lg transition-all ${currentPage === totalPages
                            ? 'text-silver/40 cursor-not-allowed bg-transparent'
                            : 'text-silver hover:bg-gold/20 hover:text-gold border border-transparent hover:border-gold/30'
                        }`}
                >
                    {language === 'ar' ? 'التالي' : 'Next'}
                </button>
            </div>
        </div>
    );
}
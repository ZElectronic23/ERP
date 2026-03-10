'use client';

import { useState, useEffect, useRef } from 'react';

interface CategoryDropdownProps {
    categories: string[];
    selectedCategory: string;
    onSelectCategory: (cat: string) => void;  // ✅ تغيير الاسم من category لـ cat
    language: 'ar' | 'en';
}

const T = {
    ar: {
        category: 'الفئة',
        allCategories: 'جميع الفئات',
        noCategories: 'لا توجد فئات'
    },
    en: {
        category: 'Category',
        allCategories: 'All Categories',
        noCategories: 'No Categories'
    }
};

export default function CategoryDropdown({
    categories,
    selectedCategory,
    onSelectCategory,
    language
}: CategoryDropdownProps) {
    const [showMenu, setShowMenu] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const tx = T[language];

    // إغلاق القائمة عند الضغط خارجها
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
                setShowMenu(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleSelect = (category: string) => {
        onSelectCategory(category);
        setShowMenu(false);
    };

    // النص المعروض في الزر
    const displayText = selectedCategory || tx.allCategories;

    return (
        <div
            ref={wrapperRef}
            className="relative"
            style={{ zIndex: 9998 }}
        >
            {/* ===== زر الفئة ===== */}
            <button
                type="button"
                onClick={() => setShowMenu(p => !p)}
                className="px-3 py-1.5 bg-[#0a0a0c] border border-silver/30 rounded-full text-white hover:border-gold focus:outline-none text-[11px] transition-all flex items-center gap-1.5 min-w-[90px]"
            >
                <span className="flex-1 text-left truncate">{displayText}</span>
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                    className={`w-3 h-3 text-gold transition-transform ${showMenu ? 'rotate-180' : ''}`}
                >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
            </button>

            {/* ===== القائمة المنسدلة ===== */}
            {showMenu && (
                <div
                    className="absolute top-full mt-1 w-56 bg-[#1a1a1e] border border-gold/30 rounded-xl shadow-2xl overflow-hidden left-0"
                    dir={language === 'ar' ? 'rtl' : 'ltr'}
                >
                    {/* جميع الفئات */}
                    <div
                        onClick={() => handleSelect('')}
                        className={`px-4 py-2.5 text-sm cursor-pointer transition-colors border-b border-silver/10 flex items-center gap-2 ${!selectedCategory
                                ? 'bg-gold/20 text-gold'
                                : 'text-silver hover:bg-gold/10 hover:text-white'
                            }`}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                        </svg>
                        <span>{tx.allCategories}</span>
                    </div>

                    {/* قائمة الفئات */}
                    {categories.length > 0 ? (
                        <div className="max-h-60 overflow-y-auto scrollbar-thin scrollbar-thumb-gold/50 scrollbar-track-transparent">
                            {categories.map((cat) => (
                                <div
                                    key={cat}
                                    onClick={() => handleSelect(cat)}
                                    className={`px-4 py-2.5 text-sm cursor-pointer transition-colors border-b border-silver/5 last:border-0 flex items-center gap-2 ${selectedCategory === cat
                                            ? 'bg-gold/20 text-gold'
                                            : 'text-silver hover:bg-gold/10 hover:text-white'
                                        }`}
                                >
                                    {/* أيقونة التحديد */}
                                    {selectedCategory === cat ? (
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-gold">
                                            <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
                                        </svg>
                                    ) : (
                                        <div className="w-4 h-4" />
                                    )}
                                    <span className="flex-1 truncate">{cat}</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="px-4 py-6 text-center text-silver/50 text-xs">
                            {tx.noCategories}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
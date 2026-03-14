'use client';

import { useTranslations } from 'next-intl';
import Dropdown from './ui/Dropdown';

interface CategoryDropdownProps {
    categories: string[];
    selectedCategory: string;
    onSelectCategory: (category: string) => void;
    language: 'ar' | 'en';
}

export default function CategoryDropdown({
    categories,
    selectedCategory,
    onSelectCategory,
    language
}: CategoryDropdownProps) {
    const t = useTranslations();

    const options = [
        { value: '', label: t('allCategories') },
        ...categories.map(cat => ({ value: cat, label: cat }))
    ];

    return (
        <Dropdown
            options={options}
            value={selectedCategory}
            onChange={onSelectCategory}
            placeholder={t('category')}
            language={language}
            className="min-w-[100px]"
        />
    );
}
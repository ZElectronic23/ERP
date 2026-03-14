'use client';

import { usePathname } from 'next/navigation';
import Header from './Header';

export default function HeaderWrapper() {
    const pathname = usePathname();
    // إذا كان المسار يحتوي على "/login" لا نظهر الهيدر
    if (pathname?.includes('/login')) {
        return null;
    }
    return <Header />;
}
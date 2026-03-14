'use client';

import { useState, useRef, useEffect } from 'react';

export interface DropdownOption {
    value: string;
    label: string;
}

interface DropdownProps {
    options: DropdownOption[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    language: 'ar' | 'en';
    className?: string;
}

export default function Dropdown({
    options,
    value,
    onChange,
    placeholder,
    language,
    className = ''
}: DropdownProps) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectedOption = options.find(opt => opt.value === value);

    return (
        <div className={`relative ${className}`} ref={dropdownRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full px-3 py-1.5 bg-[#0a0a0c] border border-silver/30 rounded-full text-white text-xs focus:outline-none focus:border-gold transition-all flex items-center justify-between"
            >
                <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
                <svg
                    className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {isOpen && (
                <div
                    className={`absolute top-full mt-1 w-full bg-[#1a1a1e] border border-gold/30 rounded-xl shadow-2xl overflow-hidden z-50 ${language === 'ar' ? 'right-0' : 'left-0'
                        }`}
                >
                    {options.map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            onClick={() => {
                                onChange(option.value);
                                setIsOpen(false);
                            }}
                            className={`w-full px-3 py-2 text-right text-xs hover:bg-gold/20 transition-colors ${option.value === value ? 'bg-gold/30 text-gold' : 'text-silver'
                                }`}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
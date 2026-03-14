'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';

// تعريف نوع Puter في النافذة
declare global {
    interface Window {
        puter: any;
    }
}

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

interface AIChatModalProps {
    isOpen: boolean;
    onClose: () => void;
    pathname: string;
}

export default function AIChatModal({ isOpen, onClose, pathname }: AIChatModalProps) {
    const t = useTranslations();
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const modalRef = useRef<HTMLDivElement>(null);

    // استخراج اسم الصفحة من المسار
    const pageName = pathname.split('/').pop() || 'home';

    // رسالة الترحيب
    useEffect(() => {
        if (isOpen && messages.length === 0) {
            setMessages([
                {
                    role: 'assistant',
                    content: t('aiWelcome', { page: pageName })
                }
            ]);
        }
    }, [isOpen, messages.length, pageName, t]);

    // التمرير لآخر رسالة
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // إغلاق عند النقر خارج المحتوى
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
                onClose();
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen, onClose]);

    const handleSend = async () => {
        if (!input.trim() || loading) return;
        if (!window.puter) {
            setMessages(prev => [...prev, { role: 'assistant', content: 'Puter.js not loaded. Please refresh the page.' }]);
            return;
        }

        const userMessage = input.trim();
        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
        setLoading(true);

        try {
            // بناء سياق الصفحة
            const context = `أنت مساعد ذكي لصفحة ${pageName}. ساعد المستخدم في الأسئلة المتعلقة بهذه الصفحة فقط.`;

            // استدعاء Puter.js مع نموذج NVIDIA Nemotron (مجاني)
            const response = await window.puter.ai.chat(
                context + "\n\nسؤال المستخدم: " + userMessage,
                { model: "nvidia/nemotron-3-nano-30b-a3b:free" }
            );

            setMessages(prev => [...prev, { role: 'assistant', content: response }]);
        } catch (error) {
            console.error('Chat error:', error);
            setMessages(prev => [
                ...prev,
                { role: 'assistant', content: t('aiError') || 'عذراً، حدث خطأ. حاول مرة أخرى.' }
            ]);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div
                ref={modalRef}
                className="bg-[#1a1a1e] rounded-2xl border border-gold/30 w-full max-w-md max-h-[70vh] flex flex-col shadow-2xl"
            >
                {/* رأس المودال */}
                <div className="flex justify-between items-center p-4 border-b border-silver/20">
                    <h3 className="text-gold font-alata text-lg">
                        {t('aiAssistant')} <span className="text-silver/50 text-sm">({pageName})</span>
                    </h3>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-silver/20 rounded-lg transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-silver">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* منطقة الرسائل */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {messages.map((msg, idx) => (
                        <div
                            key={idx}
                            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                            <div
                                className={`max-w-[80%] p-3 rounded-lg text-sm ${msg.role === 'user'
                                        ? 'bg-gold text-darkwhite rounded-br-none'
                                        : 'bg-[#2a2a2e] text-silver rounded-bl-none'
                                    }`}
                            >
                                {msg.content}
                            </div>
                        </div>
                    ))}
                    {loading && (
                        <div className="flex justify-start">
                            <div className="bg-[#2a2a2e] p-3 rounded-lg rounded-bl-none">
                                <div className="flex gap-1">
                                    <span className="w-2 h-2 bg-silver/50 rounded-full animate-bounce"></span>
                                    <span className="w-2 h-2 bg-silver/50 rounded-full animate-bounce delay-100"></span>
                                    <span className="w-2 h-2 bg-silver/50 rounded-full animate-bounce delay-200"></span>
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* منطقة الإدخال */}
                <div className="p-4 border-t border-silver/20">
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                            placeholder={t('aiPlaceholder')}
                            className="flex-1 px-3 py-2 bg-[#0a0a0c] border border-silver/30 rounded-lg text-white text-sm focus:outline-none focus:border-gold"
                        />
                        <button
                            onClick={handleSend}
                            disabled={loading || !input.trim()}
                            className="px-4 py-2 bg-gold text-darkwhite rounded-lg font-bold text-sm hover:bg-yellow-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {t('send')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
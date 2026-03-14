import { NextResponse } from 'next/server';

function getSystemPrompt(page: string): string {
    const prompts: Record<string, string> = {
        products: `أنت مساعد ذكي لصفحة إدارة المنتجات. 
    يمكنك مساعدة المستخدم في:
    - شرح كيفية إضافة منتج جديد
    - توضيح معنى الحقول (كود المنتج، السعر، الكمية، الوحدة)
    - شرح كيفية تعديل أو حذف منتج
    - مساعدة في فهم الفلاتر والبحث
    - الإجابة عن أسئلة حول المخزون والأسعار
    
    لا تجب على أسئلة خارج نطاق إدارة المنتجات.`,

        users: `أنت مساعد ذكي لصفحة إدارة المستخدمين.
    يمكنك مساعدة المستخدم في:
    - شرح كيفية إضافة مستخدم جديد
    - توضيح أنواع المستخدمين (موظف، شريك، عميل)
    - شرح الأدوار والصلاحيات
    - كيفية تفعيل/تعطيل المستخدمين
    - استعادة المستخدمين المحذوفين
    
    لا تجب على أسئلة خارج نطاق إدارة المستخدمين.`,

        default: `أنت مساعد ذكي لنظام ERP.
    ساعد المستخدم في الأسئلة المتعلقة بالصفحة الحالية.
    إذا لم تكن متأكداً من الإجابة، قل أنك تحتاج المزيد من المعلومات.`
    };

    return prompts[page] || prompts.default;
}

export async function POST(request: Request) {
    try {
        const { message, page } = await request.json();

        console.log(`[Chat API] Received message for page "${page}":`, message);

        // يمكنك استخدام أي نموذج مجاني من Hugging Face
        const model = 'microsoft/DialoGPT-medium'; // نموذج محادثة مجاني
        // بديل: 'HuggingFaceH4/zephyr-7b-beta' (أقوى)

        const hfToken = process.env.HUGGINGFACE_API_KEY;
        if (!hfToken) {
            return NextResponse.json(
                { error: 'Hugging Face API key is not configured' },
                { status: 500 }
            );
        }

        const response = await fetch(
            `https://api-inference.huggingface.co/models/${model}`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${hfToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    inputs: `[SYSTEM] ${getSystemPrompt(page)}\n[USER] ${message}\n[ASSISTANT]`,
                    parameters: {
                        max_new_tokens: 200,
                        temperature: 0.7,
                        top_p: 0.95,
                    },
                }),
            }
        );

        if (!response.ok) {
            const error = await response.text();
            console.error('[Chat API] Hugging Face error:', error);
            return NextResponse.json(
                { error: 'Failed to get response from AI' },
                { status: response.status }
            );
        }

        const result = await response.json();
        // تنسيق الرد يختلف حسب النموذج، هنا مثال بسيط
        const reply = Array.isArray(result) && result[0]?.generated_text
            ? result[0].generated_text.split('[ASSISTANT]').pop()?.trim() || 'عذراً، لم أفهم.'
            : 'عذراً، حدث خطأ في الرد.';

        return NextResponse.json({ reply });
    } catch (error: any) {
        console.error('[Chat API] Internal error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
'use client';

interface PasswordStrengthMeterProps {
    strength: number; // 0-5
}

export default function PasswordStrengthMeter({ strength }: PasswordStrengthMeterProps) {
    const getStrengthText = () => {
        switch (strength) {
            case 0: return { text: 'ضعيف جداً', color: 'bg-red-500' };
            case 1: return { text: 'ضعيف', color: 'bg-red-400' };
            case 2: return { text: 'متوسط', color: 'bg-yellow-500' };
            case 3: return { text: 'جيد', color: 'bg-blue-500' };
            case 4: return { text: 'قوي', color: 'bg-green-500' };
            case 5: return { text: 'قوي جداً', color: 'bg-green-600' };
            default: return { text: '', color: 'bg-gray-500' };
        }
    };

    const { text, color } = getStrengthText();

    return (
        <div className="mt-1">
            <div className="flex gap-1 h-1">
                {[...Array(5)].map((_, i) => (
                    <div
                        key={i}
                        className={`flex-1 h-full rounded-full transition-all ${i < strength ? color : 'bg-silver/20'
                            }`}
                    />
                ))}
            </div>
            {strength > 0 && (
                <p className="text-xs text-silver mt-1">{text}</p>
            )}
        </div>
    );
}
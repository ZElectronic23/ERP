'use client';

import { useState, useRef } from 'react';
import ReactCrop, { Crop, PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

interface ImageCropperProps {
    imageSrc: string;
    onCropComplete: (croppedImageUrl: string) => void;
    onCancel: () => void;
    aspect?: number;
    circular?: boolean;
}

export default function ImageCropper({
    imageSrc,
    onCropComplete,
    onCancel,
    aspect = 1,
    circular = false
}: ImageCropperProps) {
    const [crop, setCrop] = useState<Crop>({
        unit: '%',
        width: 90,
        height: 90,
        x: 5,
        y: 5
    });
    const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null);
    const imgRef = useRef<HTMLImageElement>(null);

    const getCroppedImg = () => {
        if (!completedCrop || !imgRef.current) return;

        const canvas = document.createElement('canvas');
        const scaleX = imgRef.current.naturalWidth / imgRef.current.width;
        const scaleY = imgRef.current.naturalHeight / imgRef.current.height;
        const ctx = canvas.getContext('2d');

        if (!ctx) return;

        canvas.width = completedCrop.width;
        canvas.height = completedCrop.height;

        ctx.drawImage(
            imgRef.current,
            completedCrop.x * scaleX,
            completedCrop.y * scaleY,
            completedCrop.width * scaleX,
            completedCrop.height * scaleY,
            0,
            0,
            completedCrop.width,
            completedCrop.height
        );

        canvas.toBlob((blob) => {
            if (!blob) return;
            const url = URL.createObjectURL(blob);
            onCropComplete(url);
        }, 'image/jpeg', 0.95);
    };

    return (
        <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-black/70">
            <div className="bg-[#1a1a1e] rounded-2xl border border-gold/30 p-6 max-w-3xl w-full">
                <h3 className="text-lg font-alata text-gold mb-4">تحديد الصورة</h3>
                <ReactCrop
                    crop={crop}
                    onChange={(c) => setCrop(c)}
                    onComplete={(c) => setCompletedCrop(c)}
                    aspect={aspect}
                    circularCrop={circular}
                    className="max-h-[60vh] mx-auto"
                >
                    <img ref={imgRef} src={imageSrc} alt="Crop" className="max-h-[60vh]" />
                </ReactCrop>
                <div className="flex gap-3 mt-4">
                    <button
                        onClick={getCroppedImg}
                        className="flex-1 px-4 py-2 bg-gold text-darkwhite rounded-lg font-bold hover:bg-yellow-600"
                    >
                        تطبيق
                    </button>
                    <button
                        onClick={onCancel}
                        className="flex-1 px-4 py-2 bg-silver/10 text-silver rounded-lg hover:bg-silver/20"
                    >
                        إلغاء
                    </button>
                </div>
            </div>
        </div>
    );
}
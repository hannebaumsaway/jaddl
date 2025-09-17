'use client';

import React, { useEffect } from 'react';
import { X, ZoomIn } from 'lucide-react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface LightboxProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  imageAlt: string;
  title?: string;
}

export function Lightbox({ isOpen, onClose, imageUrl, imageAlt, title }: LightboxProps) {
  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll when lightbox is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Close button */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-4 right-4 z-10 text-white hover:bg-white/20"
        onClick={onClose}
      >
        <X className="h-6 w-6" />
      </Button>

      {/* Image container */}
      <div 
        className="relative max-w-[90vw] max-h-[90vh] mx-4 flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative w-full h-full max-h-[90vh] flex items-center justify-center">
          <Image
            src={imageUrl}
            alt={imageAlt}
            width={1200}
            height={800}
            className="object-contain max-w-full max-h-[90vh] rounded-lg"
            priority
            sizes="90vw"
            style={{ maxHeight: '90vh' }}
          />
        </div>
        
        {/* Image title/caption */}
        {title && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 rounded-b-lg">
            <p className="text-white text-sm font-medium">{title}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Hook for managing lightbox state
export function useLightbox() {
  const [isOpen, setIsOpen] = React.useState(false);
  const [imageUrl, setImageUrl] = React.useState('');
  const [imageAlt, setImageAlt] = React.useState('');
  const [title, setTitle] = React.useState('');

  const openLightbox = (url: string, alt: string, imageTitle?: string) => {
    setImageUrl(url);
    setImageAlt(alt);
    setTitle(imageTitle || '');
    setIsOpen(true);
  };

  const closeLightbox = () => {
    setIsOpen(false);
  };

  return {
    isOpen,
    imageUrl,
    imageAlt,
    title,
    openLightbox,
    closeLightbox,
  };
}

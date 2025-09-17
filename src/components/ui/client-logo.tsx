'use client';

import React from 'react';
import { ThemeAwareLogo } from './theme-aware-logo';

interface ClientLogoProps {
  type: 'wordmark' | 'logo';
  className?: string;
  style?: React.CSSProperties;
  alt?: string;
}

export function ClientLogo({ type, className, style, alt }: ClientLogoProps) {
  return (
    <ThemeAwareLogo
      type={type}
      className={className}
      style={style}
      alt={alt}
    />
  );
}

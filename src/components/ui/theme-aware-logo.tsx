'use client';

import React from 'react';
import { useTheme } from 'next-themes';

interface ThemeAwareLogoProps {
  type: 'wordmark' | 'logo';
  className?: string;
  style?: React.CSSProperties;
  alt?: string;
}

export function ThemeAwareLogo({ 
  type, 
  className = '', 
  style = {}, 
  alt = 'JADDL' 
}: ThemeAwareLogoProps) {
  const { theme } = useTheme();
  
  const getLogoSrc = () => {
    if (type === 'wordmark') {
      return theme === 'dark' ? "/images/jaddl-nav-wordmark.svg" : "/images/jaddl-nav-wordmark-dark.svg";
    } else {
      return theme === 'dark' ? "/images/jaddl-nav-logo.svg" : "/images/jaddl-nav-logo-dark.svg";
    }
  };

  return (
    <img
      src={getLogoSrc()}
      alt={alt}
      className={className}
      style={style}
    />
  );
}

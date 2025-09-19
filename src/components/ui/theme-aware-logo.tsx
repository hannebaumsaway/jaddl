import React from 'react';
import { ThemeAwareWordmark } from './ThemeAwareWordmark';
import { ThemeAwareLogo as ThemeAwareLogoComponent } from './ThemeAwareLogo';

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
  if (type === 'wordmark') {
    return <ThemeAwareWordmark className={className} style={style} />;
  }
  
  if (type === 'logo') {
    return <ThemeAwareLogoComponent className={className} style={style} />;
  }
  
  return null;
}

'use client';

import { useEffect, useRef } from 'react';
import CircleType from 'circletype';

interface CurvedTextProps {
  text: string;
  className?: string;
  radius?: number;
}

export function CurvedText({ 
  text, 
  className = '', 
  radius = 600
}: CurvedTextProps) {
  const textRef = useRef<HTMLDivElement>(null);
  const circleTypeRef = useRef<CircleType | null>(null);

  useEffect(() => {
    if (!textRef.current) return;

    const updateCircleType = () => {
      // Clean up previous instance
      if (circleTypeRef.current) {
        circleTypeRef.current.destroy();
        circleTypeRef.current = null;
      }

      // Only apply CircleType on medium screens and up (md: breakpoint)
      const isMobile = window.innerWidth < 768; // md breakpoint is 768px
      
      if (!isMobile && textRef.current) {
        // Create CircleType instance with the specified radius
        circleTypeRef.current = new CircleType(textRef.current);
        circleTypeRef.current.radius(radius).dir(1); // Clockwise for upward arc
      }
    };

    // Initial setup
    updateCircleType();

    // Add resize listener for real-time responsiveness
    window.addEventListener('resize', updateCircleType);

    return () => {
      window.removeEventListener('resize', updateCircleType);
      if (circleTypeRef.current) {
        circleTypeRef.current.destroy();
      }
    };
  }, [text, radius]);

  return (
    <div 
      ref={textRef}
      className={`text-4xl md:text-5xl lg:text-6xl font-bold text-foreground uppercase leading-tight ${className}`}
      style={{ fontFamily: 'Rubik One, sans-serif' }}
    >
      {text}
    </div>
  );
}

'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import type { Route } from 'next';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const navigationItems = [
  { name: 'News', href: '/news' },
  { name: 'Scores', href: '/scores' },
  { name: 'Standings', href: '/standings' },
  { name: 'Survivor', href: '/survivor' },
  { name: 'Teams', href: '/teams' },
  { name: 'History', href: '/history' },
];

export function Header() {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  const NavItems = ({ className, onClick }: { className?: string; onClick?: () => void }) => (
    <nav className={cn('flex space-x-8', className)}>
      {navigationItems.map((item) => (
        <Link
          key={item.href}
          href={item.href as Route}
          onClick={onClick}
          className={cn(
            'text-lg font-medium transition-colors hover:text-primary lowercase text-foreground font-mono',
            pathname === item.href
              ? 'text-primary'
              : 'text-foreground hover:text-primary'
          )}
        >
          {item.name}
        </Link>
      ))}
    </nav>
  );

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="container mx-auto flex h-20 items-center justify-between px-4">
          {/* Logo */}
          <Link href="/" className="flex items-center">
            <img
              src="/images/jaddl-nav-wordmark-dark.svg"
              alt="JADDL"
              className="h-14 w-auto"
              style={{ maxWidth: '240px' }}
            />
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:block">
            <NavItems />
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden">
            <Button 
              variant="ghost" 
              size="icon" 
              className="text-muted-foreground"
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle menu</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile Navigation Overlay */}
      <div className={cn(
        "fixed inset-0 z-50 md:hidden transition-opacity duration-300",
        isMobileMenuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      )}>
        {/* Backdrop */}
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300"
          onClick={closeMobileMenu}
        />
        
        {/* Slide-out Panel */}
        <div className={cn(
          "fixed right-0 top-0 h-full w-80 max-w-[85vw] bg-background border-l shadow-lg transform transition-transform duration-300 ease-in-out",
          isMobileMenuOpen ? "translate-x-0" : "translate-x-full"
        )}>
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b">
              <img
                src="/images/jaddl-nav-wordmark-dark.svg"
                alt="JADDL"
                className="h-10 w-auto"
                style={{ maxWidth: '180px' }}
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={closeMobileMenu}
                className="text-muted-foreground"
              >
                <X className="h-5 w-5" />
                <span className="sr-only">Close menu</span>
              </Button>
            </div>

            {/* Navigation Items */}
            <div className="flex-1 p-6">
              <NavItems 
                className="flex-col space-x-0 space-y-6" 
                onClick={closeMobileMenu}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
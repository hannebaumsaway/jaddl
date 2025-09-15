'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';
import type { Route } from 'next';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

const navigationItems = [
  { name: 'News', href: '/news' },
  { name: 'Scores', href: '/scores' },
  { name: 'Standings', href: '/standings' },
  { name: 'Teams', href: '/teams' },
  { name: 'History', href: '/history' },
];

export function Header() {
  const pathname = usePathname();

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
    <header className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div className="container mx-auto flex h-20 items-center justify-between px-4">
        {/* Logo */}
        <Link href="/" className="flex items-center">
          <Image
            src="/images/jaddl-nav-wordmark-dark.svg"
            alt="JADDL"
            width={240}
            height={54}
            className="h-14"
            unoptimized
          />
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:block">
          <NavItems />
        </div>

        {/* Mobile Navigation */}
        <div className="md:hidden">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" className="text-muted-foreground">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle menu</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[300px] sm:w-[400px]">
              <div className="flex flex-col space-y-4 mt-6">
                <div className="flex items-center mb-6">
                  <Image
                    src="/images/jaddl-nav-wordmark-dark.svg"
                    alt="JADDL"
                    width={210}
                    height={48}
                    className="h-12"
                    unoptimized
                  />
                </div>
                <NavItems className="flex-col space-x-0 space-y-4" />
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </header>
  );
}

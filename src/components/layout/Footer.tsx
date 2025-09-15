import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Trophy, Mail, Calendar, Users } from 'lucide-react';
import type { Route } from 'next';

import { Separator } from '@/components/ui/separator';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-muted border-t border-muted mt-auto">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* League Info */}
          <div className="space-y-4">
            <Image 
              src="/images/jaddl-nav-logo-dark.svg" 
              alt="JADDL Logo" 
              width={256}
              height={128}
              className="h-32 w-auto"
              unoptimized
            />
          </div>

          {/* Quick Links */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
              Quick Links
            </h3>
            <nav className="flex flex-col space-y-2">
              <Link 
                href="/standings" 
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                Current Standings
              </Link>
              <Link 
                href="/scores" 
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                This Week&apos;s Scores
              </Link>
              <Link 
                href="/teams" 
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                All Teams
              </Link>
              <Link 
                href="/history" 
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                League History
              </Link>
            </nav>
          </div>

          {/* League Stats */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
              League Info
            </h3>
            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="flex items-center space-x-2">
                <Users className="h-4 w-4" />
                <span>12 Team League</span>
              </div>
              <div className="flex items-center space-x-2">
                <Calendar className="h-4 w-4" />
                <span>Est. 2020</span>
              </div>
              <div className="flex items-center space-x-2">
                <Trophy className="h-4 w-4" />
                <span>4 Seasons Completed</span>
              </div>
            </div>
          </div>

          {/* Contact */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
              Contact
            </h3>
            <div className="space-y-2">
              <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                <Mail className="h-4 w-4" />
                <span>jaddl.commish@gmail.com</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Questions about trades, rules, or league management? 
                Reach out to the commish.
              </p>
            </div>
          </div>
        </div>

        <Separator className="my-6" />

        {/* Bottom Section */}
        <div className="flex flex-col sm:flex-row justify-between items-center space-y-4 sm:space-y-0">
          <div className="text-sm text-muted-foreground">
            © {currentYear} Jared Allen's Designated Drivers League. All rights reserved.
          </div>
          <div className="flex space-x-4 text-xs text-muted-foreground">
            <Link href={"/privacy" as Route} className="hover:text-primary transition-colors">
              Privacy Policy
            </Link>
            <Link href={"/rules" as Route} className="hover:text-primary transition-colors">
              League Rules
            </Link>
            <Link href={"/support" as Route} className="hover:text-primary transition-colors">
              Support
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

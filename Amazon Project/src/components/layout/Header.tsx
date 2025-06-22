
import Link from 'next/link';
import { Coins, Menu as MenuIcon } from 'lucide-react';
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { NavMenu } from './NavMenu';

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 max-w-screen-2xl items-center justify-between">
        <Link href="/dashboard" className="flex items-center space-x-2">
          <Coins className="h-8 w-8 text-primary" />
          <span className="text-2xl font-bold font-headline text-foreground">PrototypePay</span>
        </Link>
        
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <MenuIcon className="h-6 w-6" />
              <span className="sr-only">Open menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[300px] sm:w-[340px] p-0 flex flex-col">
            {/* The NavMenu component will now render the content for the Sheet */}
            <NavMenu />
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}

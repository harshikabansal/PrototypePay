
"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useAppContext } from '@/contexts/AppContext';
import { Home, Landmark, LogOut, ArrowLeftRight, History, Hourglass, CreditCard, QrCode } from 'lucide-react'; // Changed ReceiveIcon to QrCode
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from '@/components/ui/separator';
import { SheetClose, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: Home },
  { href: '/add-funds', label: 'Add Funds to Wallet', icon: CreditCard },
  { href: '/send', label: 'Send Coins (QR)', icon: ArrowLeftRight }, // Updated label
  { href: '/scan-qr', label: 'Receive via QR Scan', icon: QrCode }, // Updated href, label and icon
  { href: '/pending-wallet', label: 'Pending Wallet', icon: Hourglass }, 
  { href: '/transfer', label: 'Transfer to Bank', icon: Landmark },
  { href: '/history', label: 'History', icon: History },
];

export function NavMenu() {
  const pathname = usePathname();
  const { logout, user, balance, pendingReceivedBalance } = useAppContext();

  const getInitials = (email: string | undefined) => {
    if (!email) return 'CS';
    const nameParts = user?.fullName?.split(' ') || [];
    if (nameParts.length >= 2) {
      return (nameParts[0][0] + nameParts[1][0]).toUpperCase();
    }
    if (nameParts.length === 1 && nameParts[0].length > 0) {
      return nameParts[0].substring(0,2).toUpperCase();
    }
    return email.substring(0, 2).toUpperCase();
  };

  const avatarSrc = user?.profilePictureUrl || `https://placehold.co/100x100.png?text=${getInitials(user?.email)}`;
  const avatarAiHint = user?.profilePictureUrl ? "profile picture" : "avatar user";

  return (
    <>
      <SheetHeader className="p-4 pb-2">
        <div className="flex items-center space-x-3 mb-3">
          <Avatar className="h-12 w-12">
            <AvatarImage src={avatarSrc} alt={user?.fullName || user?.email || 'User'} data-ai-hint={avatarAiHint} />
            <AvatarFallback>{getInitials(user?.email)}</AvatarFallback>
          </Avatar>
          <div>
            <SheetTitle className="text-lg">{user?.fullName || user?.email}</SheetTitle>
            <SheetDescription className="text-xs">
              UPI: {user?.upiId || 'N/A'} <br />
              Bank Balance: {(user?.bankBalance || 0).toFixed(2)} LCUs <br />
              Main Wallet: {balance.toFixed(2)} Coins <br />
              Pending Received: {pendingReceivedBalance.toFixed(2)} Coins
            </SheetDescription>
          </div>
        </div>
        <Separator />
      </SheetHeader>

      <nav className="flex-grow px-4 py-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <SheetClose asChild key={item.href}>
            <Button
              variant={pathname === item.href ? 'secondary' : 'ghost'}
              asChild
              className="w-full justify-start text-base py-3"
            >
              <Link href={item.href} className="flex items-center w-full">
                <item.icon className="mr-3 h-5 w-5" />
                {item.label}
              </Link>
            </Button>
          </SheetClose>
        ))}
      </nav>

      <SheetFooter className="p-4 border-t mt-auto">
        <SheetClose asChild>
          <Button variant="outline" onClick={logout} className="w-full">
            <LogOut className="mr-2 h-4 w-4" />
            Log out
          </Button>
        </SheetClose>
      </SheetFooter>
    </>
  );
}

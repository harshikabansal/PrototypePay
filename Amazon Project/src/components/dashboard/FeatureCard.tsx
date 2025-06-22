import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { LucideIcon } from 'lucide-react';
import { ArrowRight } from 'lucide-react';

interface FeatureCardProps {
  title: string;
  description: string;
  link: string;
  linkText: string;
  icon: LucideIcon;
}

export function FeatureCard({ title, description, link, linkText, icon: Icon }: FeatureCardProps) {
  return (
    <Card className="flex flex-col h-full shadow-lg hover:shadow-xl transition-shadow duration-300">
      <CardHeader className="pb-4">
        <div className="flex items-center space-x-3 mb-2">
          <Icon className="h-8 w-8 text-primary" />
          <CardTitle className="text-2xl font-headline">{title}</CardTitle>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex-grow flex flex-col justify-end">
        <Button asChild className="w-full mt-auto bg-primary hover:bg-primary/90 text-primary-foreground">
          <Link href={link}>
            {linkText}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

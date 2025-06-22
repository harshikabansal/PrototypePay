import { RegisterForm } from '@/components/auth/RegisterForm';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Register | PrototypePay',
};

export default function RegisterPage() {
  return <RegisterForm />;
}

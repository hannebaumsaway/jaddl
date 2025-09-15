import React from 'react';
import { Metadata } from 'next';
import { LoginForm } from './login-form';

export const metadata: Metadata = {
  title: 'Admin Login - JADDL',
  description: 'JADDL Admin Login',
};

export default function AdminLoginPage() {
  return <LoginForm />;
}

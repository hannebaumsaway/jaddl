import React from 'react';
import { Metadata } from 'next';
import { AdminDashboard } from './admin-dashboard';

export const metadata: Metadata = {
  title: 'Admin Dashboard - JADDL',
  description: 'JADDL Admin Dashboard',
};

export default function AdminPage() {
  return <AdminDashboard />;
}

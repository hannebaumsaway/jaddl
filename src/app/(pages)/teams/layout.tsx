import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Teams',
  description: 'Meet all the teams and owners in the JADDL fantasy football league.',
};

export default function TeamsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

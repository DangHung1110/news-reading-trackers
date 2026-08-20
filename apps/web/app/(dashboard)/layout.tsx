import type { ReactNode } from 'react';

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="shell">
      <header>
        <h1>News Reading Activity Tracker</h1>
        <p>Project foundation</p>
      </header>
      <main>{children}</main>
    </div>
  );
}

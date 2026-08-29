'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import { useRealtimeStatus } from '../realtime-provider';

const navigation = [
  { href: '/dashboard', label: 'Tổng quan', mark: '01' },
  { href: '/articles', label: 'Bài báo', mark: '02' },
  { href: '/sessions', label: 'Phiên đọc', mark: '03' },
  { href: '/settings/sites', label: 'Cấu hình site', mark: '04' },
];

const labels: Record<string, string> = {
  dashboard: 'Tổng quan',
  articles: 'Bài báo',
  sessions: 'Phiên đọc',
  settings: 'Cài đặt',
  sites: 'Cấu hình site',
};

export function DashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const realtimeStatus = useRealtimeStatus();
  const segments = pathname.split('/').filter(Boolean);
  const currentTitle = labels[segments.at(-1) ?? ''] ?? 'Chi tiết';

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="brand" href="/dashboard">
          <span className="brand-mark">NR</span>
          <span>
            <strong>News Tracker</strong>
            <small>Reading activity</small>
          </span>
        </Link>
        <nav aria-label="Điều hướng chính">
          {navigation.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                className={active ? 'nav-link active' : 'nav-link'}
                href={item.href}
                key={item.href}
              >
                <span>{item.mark}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="app-content">
        <header className="topbar">
          <div>
            <div className="breadcrumb">News Tracker / {currentTitle}</div>
            <strong>{currentTitle}</strong>
          </div>
          <div className="topbar-status">
            <span className={`realtime-status realtime-${realtimeStatus}`}>
              <i /> Realtime {realtimeStatus}
            </span>
            <span className="environment">Local</span>
          </div>
        </header>
        <main className="page-content">{children}</main>
      </div>
    </div>
  );
}

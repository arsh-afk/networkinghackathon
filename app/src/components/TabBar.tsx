"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/deck', label: 'Deck',    icon: '⬡' },
  { href: '/scan', label: 'Scan', icon: '⌗' },
  { href: '/network', label: 'Network', icon: '◎' },
  { href: '/me', label: 'Me',    icon: '◆' },
];

export function TabBar() {
  const path = usePathname();
  const isActive = (href: string) => {
    if (href === '/deck') return path === '/deck' || path === '/';
    return path === href;
  };

  return (
    <nav className="tab-bar" aria-label="Main navigation">
      <div className="tab-bar-inner">
        {TABS.map(tab => (
          <Link
            key={tab.href}
            href={tab.href}
            className={`tab-btn ${isActive(tab.href) ? 'active' : ''}`}
            aria-current={isActive(tab.href) ? 'page' : undefined}
          >
            <span style={{ fontSize: 20 }}>{tab.icon}</span>
            {tab.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

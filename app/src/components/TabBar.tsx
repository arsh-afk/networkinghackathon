"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: "/deck", label: "Deck", icon: "⬡" },
  { href: "/scan", label: "Scan", icon: "⌗" },
  { href: "/network", label: "Network", icon: "◎" },
  { href: "/me", label: "Me", icon: "◆" },
];

export function TabBar() {
  const path = usePathname();
  const isActive = (href: string) => {
    if (href === "/deck") return path === "/deck" || path === "/";
    return path === href;
  };

  return (
    <nav className="tab-bar" aria-label="Main navigation">
      <div className="tab-bar-inner">
        {TABS.map((tab) => {
          const active = isActive(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`tab-btn${active ? " active" : ""}`}
              aria-current={active ? "page" : undefined}
            >
              <span className="tab-icon" aria-hidden="true">{tab.icon}</span>
              <span className="tab-label">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function AppShell({ children, exceptionCount = 0 }) {
    const pathname = usePathname();

    const navItems = [
        { href: '/', label: 'Batch Dashboard', icon: '⚡', section: 'OPERATIONS' },
        { href: '/clients', label: 'Clients', icon: '👥', section: 'OPERATIONS' },
        { href: '/exceptions', label: 'Exceptions Queue', icon: '⚠️', badge: exceptionCount, section: 'OPERATIONS' },
        { href: '/ingest', label: 'Ingest Report', icon: '📥', section: 'TOOLS' },
    ];

    const sections = {};
    navItems.forEach(item => {
        if (!sections[item.section]) sections[item.section] = [];
        sections[item.section].push(item);
    });

    return (
        <div className="app-layout">
            <aside className="sidebar">
                <div className="sidebar-brand">
                    <h1>
                        <span className="brand-icon">⟐</span>
                        <span>
                            Colmex Pro
                            <div className="brand-sub">Tax Ops Platform</div>
                        </span>
                    </h1>
                </div>
                <nav className="sidebar-nav">
                    {Object.entries(sections).map(([section, items]) => (
                        <div key={section}>
                            <div className="nav-section-label">{section}</div>
                            {items.map(item => (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`nav-item ${pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href)) ? 'active' : ''}`}
                                >
                                    <span className="nav-icon">{item.icon}</span>
                                    {item.label}
                                    {item.badge > 0 && <span className="nav-badge">{item.badge}</span>}
                                </Link>
                            ))}
                        </div>
                    ))}
                </nav>
                <div className="sidebar-footer">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                        <span className="status-dot online"></span>
                        System Online
                    </div>
                    <div style={{ marginTop: 4 }}>v1.0 MVP • Demo Mode</div>
                </div>
            </aside>
            <main className="main-content">
                {children}
            </main>
        </div>
    );
}

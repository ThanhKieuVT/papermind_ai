"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ComponentType, type ReactNode } from "react";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { cx } from "@/components/ui/primitives";
import { Clover, SleepingCat } from "@/components/ui/illustrations";
import {
  IconBookOpen,
  IconCalendar,
  IconCap,
  IconCompare,
  IconDashboard,
  IconHeart,
  IconLibrary,
  IconMenu,
  IconSearch,
  IconSettings,
} from "@/components/ui/icons";

type NavItem = { href: string; label: string; icon: ComponentType<{ size?: number }> };

const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: "Workspace",
    items: [
      { href: "/", label: "Dashboard", icon: IconDashboard },
      { href: "/discover", label: "Discover Papers", icon: IconSearch },
      { href: "/reader", label: "PDF Reader", icon: IconBookOpen },
      { href: "/library", label: "My Library", icon: IconLibrary },
      { href: "/venues", label: "Venues & Deadlines", icon: IconCalendar },
    ],
  },
  {
    title: "Learn",
    items: [
      { href: "/compare", label: "Compare Papers", icon: IconCompare },
      { href: "/study", label: "Study Center", icon: IconCap },
    ],
  },
  {
    title: "Personal",
    items: [{ href: "/photos", label: "Photos I Love", icon: IconHeart }],
  },
];

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 shadow-md shadow-brand-700/30">
        <Clover size={24} leaf="#e3edd9" vein="#2c3d23" />
      </span>
      <span className="leading-tight">
        <span className="block text-[15px] font-semibold tracking-tight text-stone-900 dark:text-white">PaperMind AI</span>
        <span className="block text-xs text-stone-500 dark:text-stone-400">Research workspace</span>
      </span>
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  const link = (item: NavItem) => {
    const active = isActive(item.href);
    const Icon = item.icon;
    return (
      <li key={item.href}>
        <Link
          href={item.href}
          onClick={() => setMenuOpen(false)}
          aria-current={active ? "page" : undefined}
          className={cx(
            "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
            active
              ? "bg-brand-600/10 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200"
              : "text-stone-600 hover:bg-stone-100 hover:text-stone-900 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-white",
          )}
        >
          <span className={cx(active ? "text-brand-600 dark:text-brand-300" : "text-stone-400 group-hover:text-stone-600 dark:group-hover:text-stone-200")}>
            <Icon size={18} />
          </span>
          {item.label}
        </Link>
      </li>
    );
  };

  return (
    <div className="min-h-screen lg:flex">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2">
        Skip to content
      </a>
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-stone-200/80 bg-white/90 px-4 py-3 backdrop-blur dark:border-stone-800 dark:bg-stone-900/90 lg:hidden">
        <Brand />
        <button
          type="button"
          className="rounded-lg p-2 text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800"
          aria-expanded={menuOpen}
          aria-controls="main-nav"
          aria-label="Toggle menu"
          onClick={() => setMenuOpen((o) => !o)}
        >
          <IconMenu size={20} />
        </button>
      </header>
      <aside
        className={cx(
          "border-r border-stone-200/80 bg-white dark:border-stone-800 dark:bg-stone-900 lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-64 lg:shrink-0 lg:flex-col",
          menuOpen ? "block" : "hidden",
        )}
      >
        <div className="hidden px-5 pb-4 pt-6 lg:block">
          <Brand />
        </div>
        <nav id="main-nav" aria-label="Main navigation" className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 overflow-y-auto px-3 py-2">
            {NAV_GROUPS.map((group) => (
              <div key={group.title} className="mb-5">
                <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-stone-400 dark:text-stone-500">{group.title}</p>
                <ul className="space-y-0.5">{group.items.map(link)}</ul>
              </div>
            ))}
          </div>
          <div className="border-t border-stone-200/80 px-3 py-3 dark:border-stone-800">
          <ul className="space-y-0.5">
            {link({ href: "/settings", label: "Settings", icon: IconSettings })}
            <li><ThemeToggle /></li>
          </ul>
          <p className="mt-3 px-3 text-[11px] leading-relaxed text-stone-400 dark:text-stone-500">
            Your library stays in this browser. Nothing is synced.
          </p>
          <SleepingCat className="mx-3 mt-2 h-10 w-20 opacity-90" />
          </div>
        </nav>
      </aside>
      <main id="main" className="min-w-0 flex-1 px-4 py-6 sm:px-8 lg:px-10 lg:py-10">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}

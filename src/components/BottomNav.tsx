"use client";

import { Activity, ChartPie, House, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { t } from "@/i18n";
import styles from "./BottomNav.module.css";

/**
 * Tabs and the sections that live under each one: screens reached from a
 * tab's menu keep that tab highlighted (e.g. Cuentas/Personas → Ajustes).
 */
const ITEMS = [
  { href: "/", label: t.nav.home, icon: House, also: [] },
  { href: "/movimientos", label: t.nav.movements, icon: Activity, also: [] },
  { href: "/reportes", label: t.nav.reports, icon: ChartPie, also: ["/salud"] },
  { href: "/ajustes", label: t.nav.settings, icon: Settings, also: ["/cuentas", "/personas", "/diezmo"] },
];

const isActive = (pathname: string, href: string, also: string[]) =>
  href === "/"
    ? pathname === "/"
    : [href, ...also].some((p) => pathname === p || pathname.startsWith(`${p}/`));

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className={styles.nav} aria-label="Principal">
      {ITEMS.map(({ href, label, icon: Icon, also }) => {
        const active = isActive(pathname, href, also);
        return (
          <Link
            key={href}
            href={href}
            className={styles.item}
            aria-current={active ? "page" : undefined}
          >
            <Icon size={24} strokeWidth={1.75} aria-hidden />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

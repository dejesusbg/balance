"use client";

import { ChartPie, House, ListOrdered, Settings, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { t } from "@/i18n";
import styles from "./BottomNav.module.css";

const ITEMS = [
  { href: "/", label: t.nav.home, icon: House },
  { href: "/movimientos", label: t.nav.movements, icon: ListOrdered },
  { href: "/personas", label: t.nav.people, icon: Users },
  { href: "/reportes", label: t.nav.reports, icon: ChartPie },
  { href: "/ajustes", label: t.nav.settings, icon: Settings },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className={styles.nav} aria-label="Principal">
      {ITEMS.map(({ href, label, icon: Icon }) => {
        const active =
          href === "/"
            ? pathname === "/" || pathname.startsWith("/cuentas")
            : pathname.startsWith(href) || (href === "/reportes" && pathname.startsWith("/salud"));
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

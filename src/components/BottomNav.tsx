"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { t } from "@/i18n";
import styles from "./BottomNav.module.css";

const ITEMS = [
  { href: "/", label: t.nav.home },
  { href: "/movimientos", label: t.nav.movements },
  { href: "/personas", label: t.nav.people },
  { href: "/reportes", label: t.nav.reports },
  { href: "/ajustes", label: t.nav.settings },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className={styles.nav} aria-label="Principal">
      {ITEMS.map((item) => {
        const active =
          item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={styles.item}
            aria-current={active ? "page" : undefined}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

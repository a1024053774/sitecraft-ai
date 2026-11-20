import Link from "next/link";
import type { Route } from "next";
import { ArrowRight } from "lucide-react";

export type TopbarSection = "home" | "sites" | "settings";

const links = [
  { id: "home", href: "/", label: "首页" },
  { id: "sites", href: "/sites", label: "全部站点" },
  { id: "settings", href: "/settings", label: "模型接口与设置" },
] as const;
const newSite = { href: "/workspace?new=1", label: "新建站点" };

// T-220: one top bar for the home, site list and settings pages; the workspace has its own.
export function AppTopbar({ active }: { active: TopbarSection }) {
  return (
    <header className="app-topbar">
      <Link href="/" className="brand" aria-label="Sitecraft AI 首页">
        <span className="brand-mark">S/</span>sitecraft
      </Link>
      <nav className="app-nav" aria-label="主导航">
        {links.map((item) => (
          <Link key={item.id} href={item.href as Route} className={active === item.id ? "active" : ""} aria-current={active === item.id ? "page" : undefined}>
            {item.label}
          </Link>
        ))}
      </nav>
      <Link href={newSite.href as Route} className="primary-button app-new-site">
        {newSite.label} <ArrowRight size={15} />
      </Link>
    </header>
  );
}

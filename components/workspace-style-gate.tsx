"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

const STYLE_ID = "sitecraft-workspace-styles";

function isWorkspacePath(pathname: string) {
  if (pathname.startsWith("/api/")) return false;
  if (pathname.startsWith("/published/")) return false;
  return !/^\/templates\/[^/]+\/preview(?:\/|$)/.test(pathname);
}

export function WorkspaceStyleGate() {
  const pathname = usePathname();
  useEffect(() => {
    const existing = document.getElementById(STYLE_ID);
    if (isWorkspacePath(pathname)) {
      if (existing) return;
      const link = document.createElement("link");
      link.id = STYLE_ID;
      link.rel = "stylesheet";
      link.href = "/workspace.css";
      document.head.appendChild(link);
      return;
    }
    existing?.remove();
  }, [pathname]);
  return null;
}

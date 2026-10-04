import type { Metadata } from 'next'
import { WorkspaceStyleGate } from "@/components/workspace-style-gate";

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f6f8f5' },
    { media: '(prefers-color-scheme: dark)', color: '#142319' },
  ],
} as const;

export const metadata: Metadata = {
  title: 'SiteCraft AI | 企业独立站工作台',
  description: '用自然语言搭建、修改和发布企业独立站。',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body><WorkspaceStyleGate />{children}</body>
    </html>
  )
}

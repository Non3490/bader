'use client'

import { ReactNode } from 'react'

type Role = 'admin' | 'seller' | 'agent' | 'driver'

interface PageShellProps {
  role: Role
  activePage: string
  children: ReactNode
  showKpiStrip?: boolean
}

// PageShell is a passthrough — the sidebar and layout are provided by the
// (dashboard) route-group layout (DashboardLayout). Rendering a second sidebar
// here would cause the duplicated-sidebar bug.
export function PageShell({ children }: PageShellProps) {
  return <>{children}</>
}

import type { ComponentProps } from 'react'
import {
  LayoutDashboard,
  ClipboardList,
  Package,
  BarChart2,
  Phone,
  Truck,
  MapPin,
  DollarSign,
  FileText,
  Wallet,
  Lock,
  ShoppingBag,
  PackageSearch,
  Users,
  Settings,
  Activity,
  List,
  Receipt,
  HandCoins,
  Eye,
  FileSpreadsheet,
  History,
  Globe,
  type LucideProps,
} from 'lucide-react'

export type LucideIcon = React.ComponentType<LucideProps>

export interface NavItem {
  label: string
  href: string
  icon?: LucideIcon
  badge?: number
}

export interface NavGroup {
  key: string
  label: string
  icon: LucideIcon
  children: NavItem[]
  roles?: string[]
}

// Pinned navigation items (always visible, no accordion)
export const NAV_PINNED: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '/admin' },
  { label: 'Orders', icon: ClipboardList, href: '/orders' },
  { label: 'Inventory', icon: Package, href: '/inventory' },
]

// Collapsible navigation groups
export const NAV_GROUPS: NavGroup[] = [
  {
    key: 'operations',
    label: 'Operations',
    icon: Phone,
    roles: ['ADMIN'],
    children: [
      { label: 'Call Center', href: '/call-center' },
      { label: 'Deliveries', href: '/deliveries' },
      { label: 'Delivery Performance', href: '/delivery-performance' },
      { label: 'Delivery Zones', href: '/delivery-zones' },
      { label: 'Drivers', href: '/drivers' },
      { label: 'Cash Handoffs', href: '/cash-handoffs' },
    ],
  },
  {
    key: 'finance',
    label: 'Finance',
    icon: DollarSign,
    roles: ['ADMIN'],
    children: [
      { label: 'Overview', href: '/finance' },
      { label: 'Invoices', href: '/finance/invoices' },
      { label: 'Seller Wallets', href: '/finance/wallets' },
      { label: 'Agent Fees', href: '/finance/agent-fees' },
      { label: 'Delivery Fees', href: '/finance/delivery-fees' },
      { label: 'Transactions', href: '/finance/transactions' },
      { label: 'Remittance', href: '/finance/remittance' },
      { label: 'Expenses', href: '/finance/expenses' },
    ],
  },
  {
    key: 'marketplace',
    label: 'Marketplace',
    icon: ShoppingBag,
    roles: ['ADMIN'],
    children: [
      { label: 'Products', href: '/products' },
      { label: 'Customers', href: '/admin/customers' },
    ],
  },
  {
    key: 'system',
    label: 'System',
    icon: Settings,
    roles: ['ADMIN'],
    children: [
      { label: 'Users', href: '/admin/users' },
      { label: 'Blacklist', href: '/admin/blacklist' },
      { label: 'Settings', href: '/admin/settings' },
      { label: 'Activity Logs', href: '/admin/activity-logs' },
      { label: 'Sourcing', href: '/admin/sourcing', icon: Globe },
    ],
  },
  {
    key: 'analytics',
    label: 'Analytics',
    icon: BarChart2,
    roles: ['ADMIN'],
    children: [
      { label: 'Dashboard', href: '/analytics' },
      { label: 'City Performance', href: '/analytics/city-performance' },
      { label: 'Insights', href: '/analytics/insights' },
      { label: 'Reports', href: '/admin/reports' },
    ],
  },
]

// CALL_CENTER role navigation
export const CALL_CENTER_NAV: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
  { label: 'Orders', icon: ClipboardList, href: '/orders' },
  { label: 'Call Queue', icon: Phone, href: '/call-center' },
  { label: 'Log Expense', icon: Receipt, href: '/expense-log' },
]

export const CALL_CENTER_GROUPS: NavGroup[] = []

// DELIVERY role navigation
export const DELIVERY_NAV: NavItem[] = [
  { label: 'Dashboard', icon: Truck, href: '/driver/dashboard' },
]

export const DELIVERY_GROUPS: NavGroup[] = []

// SELLER role navigation
export const SELLER_NAV: NavItem[] = [
  { label: 'My Dashboard', icon: LayoutDashboard, href: '/seller' },
  { label: 'Products', icon: Package, href: '/products' },
  { label: 'My Orders', icon: Package, href: '/seller/orders' },
  { label: 'My Stock', icon: Package, href: '/seller/stock' },
]

export const SELLER_GROUPS: NavGroup[] = [
  {
    key: 'finance',
    label: 'Finance',
    icon: DollarSign,
    roles: ['SELLER'],
    children: [
      { label: 'My Finance', href: '/seller/finance' },
      { label: 'My Invoices', href: '/seller/finance/invoices' },
      { label: 'My Wallet', href: '/seller/wallet' },
    ],
  },
  {
    key: 'marketplace',
    label: 'Marketplace',
    icon: ShoppingBag,
    roles: ['SELLER'],
    children: [
      { label: 'Sourcing', href: '/seller/sourcing' },
    ],
  },
  {
    key: 'tools',
    label: 'Tools',
    icon: PackageSearch,
    roles: ['SELLER'],
    children: [
      { label: 'Import Orders', href: '/seller/import' },
      { label: 'Integrations', href: '/seller/integrations' },
    ],
  },
  {
    key: 'account',
    label: 'Account',
    icon: Users,
    roles: ['SELLER'],
    children: [
      { label: 'My Team', href: '/seller/team' },
      { label: 'API Access', href: '/seller/api' },
    ],
  },
  {
    key: 'analytics',
    label: 'Analytics',
    icon: BarChart2,
    roles: ['SELLER'],
    children: [
      { label: 'Products Analytics', href: '/seller/analytics/products' },
    ],
  },
]

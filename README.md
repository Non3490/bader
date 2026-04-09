# Gabon COD Platform

A full-featured Cash on Delivery (COD) e-commerce platform built for the Gabon market. Manages orders, deliveries, call center operations, inventory, finance, and seller portals.

## Tech Stack

- **Framework:** Next.js 16 + React 19 + TypeScript
- **Database:** PostgreSQL (Neon) + Prisma ORM
- **Styling:** Tailwind CSS + shadcn/ui
- **Real-time:** Pusher
- **Communications:** Twilio (voice/SMS)
- **Maps:** Leaflet + React-Leaflet

## Features

- **Admin Dashboard** — user management, audit logs, system settings, analytics
- **Order Management** — create, track, import (CSV/Excel), bundle, and export orders
- **Call Center** — inbound/outbound calls, order confirmations, callback scheduling
- **Delivery Portal** — driver app with GPS tracking, route optimization, POD capture
- **Seller Portal** — product catalog, inventory, orders, finance, API access
- **Inventory System** — stock tracking, snapshots, movements, low-stock alerts
- **Finance** — invoices, wallets, withdrawals, remittance, expense tracking
- **Analytics** — KPIs, city performance, product insights, revenue tracking
- **Integrations** — Shopify, YouCan, Dropify, Lightfunnels webhooks + Google Sheets

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database

### Installation

```bash
# Clone the repository
git clone https://github.com/Non3490/bader.git
cd bader

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your database URL and other credentials

# Generate Prisma client
npx prisma generate

# Push database schema
npx prisma db push

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
gabon-cod-platform/
├── prisma/
│   └── schema.prisma       # Database schema
├── public/                  # Static assets
├── src/
│   ├── app/                 # Next.js App Router pages & API routes
│   │   ├── (auth)/          # Login & registration
│   │   ├── (dashboard)/     # Main dashboard pages
│   │   ├── admin/           # Admin auth pages
│   │   ├── driver/          # Driver portal
│   │   └── api/             # REST API endpoints
│   ├── components/          # React components
│   │   ├── ui/              # shadcn/ui base components
│   │   ├── layout/          # App layout components
│   │   ├── admin/           # Admin-specific components
│   │   ├── analytics/       # Charts & analytics widgets
│   │   ├── call-center/     # Call center components
│   │   ├── delivery/        # Delivery components
│   │   ├── driver/          # Driver app components
│   │   ├── inventory/       # Inventory components
│   │   └── orders/          # Order components
│   ├── config/              # App configuration
│   ├── hooks/               # Custom React hooks
│   ├── lib/                 # Utilities & services
│   └── types/               # TypeScript type definitions
├── .env.example             # Environment variables template
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

## Environment Variables

See [`.env.example`](.env.example) for the full list of required and optional environment variables.

Key variables:
- `DATABASE_URL` — PostgreSQL connection string (required)
- `JWT_SECRET` — Secret key for authentication (required in production)
- `PUSHER_*` — Pusher credentials for real-time features
- `TWILIO_*` — Twilio credentials for voice/SMS

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run db:push` | Push schema changes to database |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:migrate` | Run database migrations |
| `npm run db:studio` | Open Prisma Studio |

## License

MIT

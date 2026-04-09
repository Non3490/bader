/**
 * Gabon COD Platform — Realistic Seed Script
 * Mirrors the 7-day Gabon scenario: 5 sellers, 5 products, 2 agents, 3 delivery men, 236 leads
 *
 * Run: npx tsx prisma/seed.ts
 */

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const db = new PrismaClient()

const CITIES = ['Libreville', 'Port-Gentil', 'Franceville', 'Oyem']
const CITY_WEIGHTS = [0.72, 0.15, 0.08, 0.05] // 72% Libreville etc.

const GABONESE_NAMES = [
  'Marie-Louise Moussavou', 'Jean-Claude Nze', 'Yvette Ella', 'François Mba',
  'Nadège Obiang', 'Rodrigue Nguema', 'Aurore Mintsa', 'Thierry Biyogo',
  'Carine Ondo', 'Patrice Koumba', 'Rose Mvé', 'Serge Bekale',
  'Christiane Akue', 'Hervé Bounguendza', 'Laetitia Nkoghe', 'Arnaud Tsinga',
  'Bernadette Ogoula', 'Giscard Moubamba', 'Solange Mfoubou', 'Eric Boundono',
  'Martine Bongo', 'Alexandre Ntoutoume', 'Florence Aboré', 'Désiré Mbadinga',
  'Rosalie Kombila', 'Wilfried Eyené', 'Pascaline Meyo', 'Junior Mebiame',
  'Angeline Mombo', 'Clifford Engone', 'Vanessa Ndombi', 'Gustave Assogho',
  'Patricia Mounguengui', 'Constant Mouyabi', 'Delphine Mabika', 'Thierry Mihindou'
]

const LIBREVILLE_ZONES = [
  'Akanda, derrière le Total', 'PK5, route de Ntoum', 'Nombakélé, près de la mairie',
  'Louis, face à la station Shell', 'Owendo, quartier industriel', 'Nzeng-Ayong, carrefour',
  'Centre-ville, boulevard Triomphal', 'Angondjé, résidence Les Palmiers',
  'PK8, route de Kango', 'PK12, village Andème', 'Plein-Ciel, immeuble Gabon Télécom',
  'Mont-Bouët, marché', 'Atong-Abè, église catholique', 'Batavéa, port autonome'
]

function weightedRandom(items: string[], weights: number[]): string {
  const r = Math.random()
  let sum = 0
  for (let i = 0; i < items.length; i++) {
    sum += weights[i]
    if (r <= sum) return items[i]
  }
  return items[items.length - 1]
}

function randomPhone(): string {
  const prefixes = ['060', '061', '062', '066', '074', '077']
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)]
  const num = Math.floor(Math.random() * 9000000 + 1000000).toString()
  return `+241 ${prefix.slice(1)} ${num.slice(0, 2)} ${num.slice(2, 4)} ${num.slice(4, 6)}`
}

function randomAddress(city: string): string {
  if (city === 'Libreville') return LIBREVILLE_ZONES[Math.floor(Math.random() * LIBREVILLE_ZONES.length)]
  if (city === 'Port-Gentil') return `Port-Gentil, quartier ${['Ozouri', 'Agondjé', 'Ballard'][Math.floor(Math.random() * 3)]}`
  return `${city}, quartier central`
}

function daysAgo(d: number): Date {
  return new Date(Date.now() - d * 24 * 60 * 60 * 1000)
}

async function hashPw(pw: string) {
  return bcrypt.hash(pw, 10)
}

async function main() {
  console.log('🌍 Seeding Gabon COD Platform...')

  // ── Super Admin (Admin Table) ─────────────────────────────────────
  const superAdminPassword = Math.random().toString(36).slice(-12) // Generate random password
  const superAdmin = await db.admin.upsert({
    where: { email: 'admin@gaboncod.com' },
    update: {},
    create: {
      email: 'admin@gaboncod.com',
      password: await hashPw(superAdminPassword),
      name: 'Super Admin',
      role: 'SUPER_ADMIN',
      status: 'ACTIVE'
    }
  })
  console.log('✅ Super Admin created:', superAdmin.email)

  // ── Admin (User Table) ──────────────────────────────────────────────────
  const admin = await db.user.create({
    data: {
      email: 'admin@gaboncod.com',
      password: await hashPw('admin123'),
      name: 'Admin Gabon COD',
      role: 'ADMIN',
      phone: '+241 077 00 00 00'
    }
  })
  console.log('✅ Admin created:', admin.email)

  // ── Sellers ────────────────────────────────────────────────────────
  const sellerData = [
    { name: 'Hervé Bounguendza', email: 'herve@gaboncod.com' },
    { name: 'Chancelle Mba',     email: 'chancelle@gaboncod.com' },
    { name: 'Patrick Koumba',    email: 'patrick@gaboncod.com' },
    { name: 'Laure Mintsa',      email: 'laure@gaboncod.com' },
    { name: 'Joël Nguema',       email: 'joel@gaboncod.com' }
  ]

  const sellers = await Promise.all(sellerData.map(s =>
    db.user.create({
      data: { ...s, password: bcrypt.hashSync('seller123', 10), role: 'SELLER', phone: randomPhone() }
    })
  ))
  console.log('✅ 5 sellers created')

  // ── Call Center Agents ─────────────────────────────────────────────
  const agentData = [
    { name: 'Merveille Ondo', email: 'merveille@gaboncod.com' },
    { name: 'Gisèle Ella',   email: 'gisele@gaboncod.com' }
  ]

  const agents = await Promise.all(agentData.map(a =>
    db.user.create({
      data: { ...a, password: bcrypt.hashSync('agent123', 10), role: 'CALL_CENTER', phone: randomPhone() }
    })
  ))
  console.log('✅ 2 call center agents created')

  // ── Delivery Men ───────────────────────────────────────────────────
  const deliveryData = [
    { name: 'Jean-Claude Nze', email: 'jeanclaude@gaboncod.com' }, // Libreville Centre + Akanda
    { name: 'Rodrigue Bekale', email: 'rodrigue@gaboncod.com' },    // PK5–PK12
    { name: 'Serge Moubamba', email: 'serge@gaboncod.com' }         // Port-Gentil
  ]

  const deliveryMen = await Promise.all(deliveryData.map(d =>
    db.user.create({
      data: { ...d, password: bcrypt.hashSync('delivery123', 10), role: 'DELIVERY', phone: randomPhone() }
    })
  ))
  console.log('✅ 3 delivery men created')

  // ── Products + Stock ───────────────────────────────────────────────
  type ProductConfig = {
    name: string; sku: string; costPrice: number; sellPrice: number
    stock: number; alertLevel: number; leads: number; sellerIdx: number
  }
  const productConfigs: ProductConfig[] = [
    { name: 'Blender Portable',   sku: 'BP-001', costPrice: 5000,  sellPrice: 15000, stock: 60, alertLevel: 10, leads: 45, sellerIdx: 0 },
    { name: 'Ceinture Minceur',   sku: 'CM-002', costPrice: 3500,  sellPrice: 12000, stock: 40, alertLevel: 8,  leads: 34, sellerIdx: 1 },
    { name: 'Lampe Solaire',      sku: 'LS-003', costPrice: 2500,  sellPrice: 8000,  stock: 90, alertLevel: 15, leads: 78, sellerIdx: 2 },
    { name: 'Fer à Lisser Pro',   sku: 'FL-004', costPrice: 6000,  sellPrice: 18000, stock: 30, alertLevel: 5,  leads: 45, sellerIdx: 3 },
    { name: 'Brosse Électrique',  sku: 'BE-005', costPrice: 3000,  sellPrice: 10000, stock: 50, alertLevel: 10, leads: 34, sellerIdx: 4 }
  ]

  const products = await Promise.all(productConfigs.map(async (cfg) => {
    const seller = sellers[cfg.sellerIdx]
    const product = await db.product.create({
      data: {
        sellerId: seller.id,
        sku: cfg.sku,
        name: cfg.name,
        costPrice: cfg.costPrice,
        sellPrice: cfg.sellPrice
      }
    })
    const stock = await db.stock.create({
      data: {
        productId: product.id,
        sellerId: seller.id,
        warehouse: 'Libreville Main',
        quantity: cfg.stock,
        alertLevel: cfg.alertLevel
      }
    })
    await db.stockMovement.create({
      data: {
        stockId: stock.id,
        type: 'IN',
        quantity: cfg.stock,
        reason: 'Initial stock — sourced from supplier'
      }
    })
    return { product, stock, cfg }
  }))
  console.log('✅ 5 products + stock created')

  // ── Wallets ────────────────────────────────────────────────────────
  await Promise.all(sellers.map(s =>
    db.wallet.create({ data: { sellerId: s.id } })
  ))
  console.log('✅ 5 seller wallets created')

  // ── Orders (236 leads over 7 days) ─────────────────────────────────
  console.log('📦 Creating 236 orders...')

  // Status distribution matching the scenario
  type OrderStatus = 'NEW' | 'CONFIRMED' | 'CANCELLED' | 'SHIPPED' | 'DELIVERED' | 'RETURNED' | 'POSTPONED'
  type OrderConfig = {
    status: OrderStatus
    weight: number
    deliveryManIdx?: number
    daysDelivered?: number
  }
  const statusDistribution: OrderConfig[] = [
    { status: 'NEW',       weight: 0.05, daysDelivered: 0 },
    { status: 'CONFIRMED', weight: 0.06, daysDelivered: 0 },
    { status: 'CANCELLED', weight: 0.18, daysDelivered: 0 },
    { status: 'SHIPPED',   weight: 0.04, deliveryManIdx: 0, daysDelivered: 0 },
    { status: 'DELIVERED', weight: 0.45, deliveryManIdx: 0, daysDelivered: 2 },
    { status: 'RETURNED',  weight: 0.13, deliveryManIdx: 0, daysDelivered: 3 },
    { status: 'POSTPONED', weight: 0.09, deliveryManIdx: 0, daysDelivered: 0 }
  ]

  let orderCount = 0
  const usedPhones = new Set<string>()

  for (const pData of products) {
    const { product, cfg } = pData
    const seller = sellers[cfg.sellerIdx]

    for (let i = 0; i < cfg.leads; i++) {
      // Pick a status based on weights
      const r = Math.random()
      let cumulative = 0
      let chosenStatus = statusDistribution[0]
      for (const sd of statusDistribution) {
        cumulative += sd.weight
        if (r <= cumulative) { chosenStatus = sd; break }
      }

      // Ensure unique phone
      let phone = randomPhone()
      while (usedPhones.has(phone)) phone = randomPhone()
      usedPhones.add(phone)

      const city = weightedRandom(CITIES, CITY_WEIGHTS)
      const createdAt = daysAgo(Math.floor(Math.random() * 7))

      // Pick delivery man based on city
      let deliveryManId: string | null = null
      if (['SHIPPED', 'DELIVERED', 'RETURNED', 'POSTPONED'].includes(chosenStatus.status)) {
        if (city === 'Port-Gentil') deliveryManId = deliveryMen[2].id
        else if (['Franceville', 'Oyem'].includes(city)) deliveryManId = null // held
        else deliveryManId = Math.random() < 0.6 ? deliveryMen[0].id : deliveryMen[1].id
      }

      // Agent assignment (round-robin)
      const assignedAgentId = agents[orderCount % 2].id

      const trackingNumber = `GC-${Math.random().toString(36).substring(2, 8).toUpperCase()}`

      const statusDates: Record<string, unknown> = {}
      if (['CONFIRMED', 'SHIPPED', 'DELIVERED', 'RETURNED'].includes(chosenStatus.status)) {
        statusDates.confirmedAt = new Date(createdAt.getTime() + 2 * 60 * 60 * 1000)
      }
      if (['SHIPPED', 'DELIVERED', 'RETURNED'].includes(chosenStatus.status)) {
        statusDates.shippedAt = new Date(createdAt.getTime() + 24 * 60 * 60 * 1000)
      }
      if (chosenStatus.status === 'DELIVERED') {
        statusDates.deliveredAt = new Date(createdAt.getTime() + 2 * 24 * 60 * 60 * 1000)
      }
      if (chosenStatus.status === 'RETURNED') {
        statusDates.returnedAt = new Date(createdAt.getTime() + 3 * 24 * 60 * 60 * 1000)
      }
      if (chosenStatus.status === 'CANCELLED') {
        statusDates.cancelledAt = new Date(createdAt.getTime() + 1 * 60 * 60 * 1000)
      }

      await db.order.create({
        data: {
          trackingNumber,
          sellerId: seller.id,
          deliveryManId,
          assignedAgentId,
          recipientName: GABONESE_NAMES[Math.floor(Math.random() * GABONESE_NAMES.length)],
          phone,
          address: randomAddress(city),
          city,
          codAmount: cfg.sellPrice,
          status: chosenStatus.status,
          source: Math.random() < 0.6 ? 'MANUAL' : Math.random() < 0.5 ? 'IMPORT' : 'SHOPIFY',
          productCost: cfg.costPrice,
          shippingCost: 2000,
          callAttempts: chosenStatus.status === 'NEW' ? 0 : Math.floor(Math.random() * 3) + 1,
          createdAt,
          ...statusDates,
          items: {
            create: [{
              productId: product.id,
              quantity: 1,
              unitPrice: cfg.sellPrice
            }]
          },
          history: {
            create: {
              newStatus: chosenStatus.status,
              changedById: admin.id,
              createdAt
            }
          }
        }
      })

      // Credit wallet for delivered orders
      if (chosenStatus.status === 'DELIVERED') {
        await db.wallet.update({
          where: { sellerId: seller.id },
          data: {
            balance: { increment: cfg.sellPrice },
            totalEarned: { increment: cfg.sellPrice }
          }
        })
      }

      orderCount++
    }
  }
  console.log(`✅ ${orderCount} orders created`)

  // ── Activity Log ───────────────────────────────────────────────────
  await db.activityLog.create({
    data: {
      userId: admin.id,
      role: 'ADMIN',
      action: 'SEED_COMPLETE',
      details: `Database seeded with Gabon scenario: ${orderCount} orders, 5 sellers, 2 agents, 3 delivery men`
    }
  })

  // ── Summary ────────────────────────────────────────────────────────
  console.log('\n🎉 Seed complete!\n')
  console.log('══════════════════════════════════════════════════════')
  console.log('⚠️  IMPORTANT: SUPER ADMIN CREDENTIALS ⚠️')
  console.log('══════════════════════════════════════════════════════')
  console.log(`Email:    admin@gaboncod.com`)
  console.log(`Password: ${superAdminPassword}`)
  console.log(`Role:     SUPER_ADMIN`)
  console.log('══════════════════════════════════════════════════════')
  console.log('\nOther Login Credentials:')
  console.log('─────────────────────────────────────────────')
  console.log('ADMIN:    admin@gaboncod.com      / admin123')
  console.log('SELLERS:  herve@gaboncod.com      / seller123')
  console.log('          chancelle@gaboncod.com  / seller123')
  console.log('          patrick@gaboncod.com    / seller123')
  console.log('          laure@gaboncod.com      / seller123')
  console.log('          joel@gaboncod.com       / seller123')
  console.log('AGENTS:   merveille@gaboncod.com  / agent123')
  console.log('          gisele@gaboncod.com     / agent123')
  console.log('DELIVERY: jeanclaude@gaboncod.com / delivery123')
  console.log('          rodrigue@gaboncod.com   / delivery123')
  console.log('          serge@gaboncod.com      / delivery123')
  console.log('─────────────────────────────────────────────')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => db.$disconnect())

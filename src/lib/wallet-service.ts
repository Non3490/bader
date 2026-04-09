import { db } from '@/lib/db'

export async function ensureWallet(sellerId: string) {
  return db.wallet.upsert({
    where: { sellerId },
    create: { sellerId },
    update: {}
  })
}

export async function creditWallet(
  sellerId: string,
  amount: number,
  description: string,
  orderId?: string
) {
  const wallet = await ensureWallet(sellerId)
  await db.$transaction([
    db.wallet.update({
      where: { id: wallet.id },
      data: {
        balance: { increment: amount },
        totalEarned: { increment: amount }
      }
    }),
    db.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: 'CREDIT',
        amount,
        description,
        orderId: orderId ?? null
      }
    })
  ])
}

export async function debitWallet(
  sellerId: string,
  amount: number,
  description: string,
  orderId?: string
) {
  const wallet = await ensureWallet(sellerId)
  await db.$transaction([
    db.wallet.update({
      where: { id: wallet.id },
      data: {
        balance: { decrement: amount },
        totalDeducted: { increment: amount }
      }
    }),
    db.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: 'DEBIT',
        amount,
        description,
        orderId: orderId ?? null
      }
    })
  ])
}

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkUsers() {
  // Check all users
  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true, role: true, parentSellerId: true },
    orderBy: { role: 'asc' }
  });

  console.log('=== USERS ===');
  users.forEach(u => {
    console.log(u.email + ' | ' + u.role + ' | ParentSellerId: ' + (u.parentSellerId || 'NULL'));
  });

  // Check the first NEW order's seller
  const orderSeller = await prisma.order.findFirst({
    where: { status: 'NEW' },
    select: { sellerId: true, seller: { select: { id: true, email: true, name: true } } }
  });

  if (orderSeller) {
    console.log('');
    console.log('=== FIRST NEW ORDER SELLER ===');
    console.log('Seller ID:', orderSeller.sellerId);
    console.log('Seller Email:', orderSeller.seller?.email);
    console.log('Seller Name:', orderSeller.seller?.name);
  }

  await prisma.$disconnect();
  process.exit(0);
}

checkUsers().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});

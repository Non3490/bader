import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { db } from '@/lib/db'
import { v2 as cloudinary } from 'cloudinary'

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

/**
 * POST /api/delivery/[id]/signature
 * Upload customer signature to Cloudinary
 * DELIVERY + ADMIN roles only
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSession()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (user.role !== 'DELIVERY' && user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params

  try {
    const { signature } = await request.json()

    if (!signature || typeof signature !== 'string') {
      return NextResponse.json({ error: 'Invalid signature data' }, { status: 400 })
    }

    // Verify order exists and user has access
    const order = await db.order.findUnique({
      where: { id },
      include: { deliveryMan: true }
    })

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // DELIVERY role can only update their own assigned orders
    if (user.role === 'DELIVERY' && order.deliveryManId !== user.id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Extract base64 data
    const base64Data = signature.replace(/^data:image\/[a-z]+;base64,/, '')

    // Validate base64
    const buffer = Buffer.from(base64Data, 'base64')

    // Validate buffer size (max 1MB for signature)
    if (buffer.length > 1024 * 1024) {
      return NextResponse.json({ error: 'Signature too large' }, { status: 400 })
    }

    // Upload to Cloudinary
    const uploadResult = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          folder: `signatures/${id}`,
          resource_type: 'auto',
          transformation: [
            { quality: 'auto' },
            { width: 600, crop: 'limit' }
          ],
          format: 'png'
        },
        (error, result) => {
          if (error) {
            console.error('Cloudinary upload error:', error)
            reject(error)
          } else {
            resolve(result)
          }
        }
      ).end(buffer)
    })

    // Update order with signature URL
    await db.order.update({
      where: { id },
      data: { podSignatureUrl: (uploadResult as any).secure_url }
    })

    return NextResponse.json({
      url: (uploadResult as any).secure_url,
      publicId: (uploadResult as any).public_id
    })
  } catch (error) {
    console.error('Signature upload error:', error)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}

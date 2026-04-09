import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'

/**
 * GET /api/twilio/token
 * Generate agent access token for Twilio Device
 * CALL_CENTER + ADMIN only
 */
export async function GET(request: NextRequest) {
  const user = await getSession()
  if (!user || (user.role !== 'CALL_CENTER' && user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  // Check that all required Twilio credentials are configured
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const apiKey = process.env.TWILIO_API_KEY
  const apiSecret = process.env.TWILIO_API_SECRET
  const twimlAppSid = process.env.TWILIO_TWIML_APP_SID

  if (!accountSid || !authToken || !apiKey || !apiSecret || !twimlAppSid) {
    return NextResponse.json(
      { error: 'Twilio is not configured', configured: false },
      { status: 503 }
    )
  }

  try {
    const { Twilio } = await import('twilio')
    const twilioClient = new Twilio(accountSid, authToken)

    const token = new twilioClient.jwt.AccessToken(
      accountSid,
      apiKey,
      apiSecret,
      { identity: user.id }
    )

    token.addGrant(
      new twilioClient.jwt.AccessToken.VoiceGrant({
        outgoingApplicationSid: twimlAppSid,
        incomingAllow: true
      })
    )

    return NextResponse.json({ token: token.toJwt() })
  } catch (error) {
    console.error('Failed to generate Twilio token:', error)
    return NextResponse.json({ error: 'Failed to generate token' }, { status: 500 })
  }
}

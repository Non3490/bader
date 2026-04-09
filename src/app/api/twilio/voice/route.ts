import { NextRequest, NextResponse } from 'next/server'
import { twiml as twiml } from 'twilio'

/**
 * POST /api/twilio/voice
 * TwiML handler with auto-recording
 * PUBLIC endpoint (called by Twilio)
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const to = formData.get('To') as string
    const from = formData.get('From') as string

    const response = twiml.VoiceResponse()

    // Add dial with auto-recording
    const dial = response.dial({
      callerId: from,
      record: 'record-from-ringing-dual',
      recordingStatusCallback: `${process.env.NEXT_PUBLIC_APP_URL}/api/twilio/recording-complete`
    })
    dial.number(to)

    return new NextResponse(response.toString(), {
      headers: { 'Content-Type': 'text/xml' }
    })
  } catch (error) {
    console.error('TwiML error:', error)
    return new NextResponse('<Response><Error>Failed to process call</Error></Response>', {
      status: 500,
      headers: { 'Content-Type': 'text/xml' }
    })
  }
}

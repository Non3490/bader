import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * POST /api/twilio/recording-complete
 * Save recording URL to DB when call recording is complete
 * PUBLIC endpoint (called by Twilio)
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const callSid = formData.get('CallSid') as string
    const recordingUrl = formData.get('RecordingUrl') as string
    const recordingSid = formData.get('RecordingSid') as string
    const recordingDuration = parseInt(formData.get('RecordingDuration') as string || '0')
    const recordingStatus = formData.get('RecordingStatus') as string

    // Find pending recording by Twilio call SID
    const recording = await db.callRecording.findFirst({
      where: {
        twilioCallSid: callSid,
        status: 'PENDING'
      }
    })

    if (recording) {
      // Update recording with actual data
      await db.callRecording.update({
        where: { id: recording.id },
        data: {
          recordingUrl,
          recordingSid,
          durationSeconds: recordingDuration,
          status: recordingStatus === 'completed' ? 'COMPLETED' : 'FAILED'
        }
      })
    }

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error('Failed to save recording:', error)
    return new NextResponse(null, { status: 500 })
  }
}

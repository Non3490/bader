// Email Service for Team Invitations
// Using a simple console-based implementation
// Replace with real email service (Nodemailer, Resend, Mailgun, etc.) in production

export interface EmailOptions {
  to: string
  subject: string
  html?: string
  text?: string
}

/**
 * Send team invitation email
 * In production, replace with real email service like:
 * - Nodemailer (SMTP)
 * - Resend (API)
 * - Mailgun (API)
 * - SendGrid (API)
 */
export async function sendTeamInviteEmail(
  email: string,
  inviteeName: string,
  inviterName: string,
  temporaryPassword: string,
  companyName?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const loginUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const subject = `You're invited to join ${companyName || 'Gabon COD Platform'}`

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Welcome to the Team! 🎉</h1>
        </div>
        <div style="padding: 30px; background-color: #f9fafb;">
          <p style="color: #374151; font-size: 16px; line-height: 1.6;">
            Hi ${inviteeName},
          </p>
          <p style="color: #374151; font-size: 16px; line-height: 1.6;">
            ${inviterName} has invited you to join their team on the Gabon COD Platform.
          </p>
          <div style="background: white; border-radius: 8px; padding: 20px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h3 style="color: #667eea; margin-top: 0; font-size: 18px;">Your Login Credentials</h3>
            <p style="color: #6b7280; margin: 10px 0; font-size: 14px;">
              <strong>Email:</strong> ${email}
            </p>
            <p style="color: #6b7280; margin: 10px 0; font-size: 14px;">
              <strong>Temporary Password:</strong> <code style="background: #f3f4f6; padding: 2px 8px; border-radius: 4px;">${temporaryPassword}</code>
            </p>
            <p style="color: #9ca3af; font-size: 13px; margin-top: 15px;">
              Please change your password after your first login.
            </p>
          </div>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${loginUrl}/login" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
              Login Now
            </a>
          </div>
          <p style="color: #6b7280; font-size: 14px; text-align: center;">
            If you have any questions, please contact ${inviterName}.
          </p>
        </div>
        <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="color: #9ca3af; font-size: 12px; margin: 0;">
            © ${new Date().getFullYear()} Gabon COD Platform. All rights reserved.
          </p>
        </div>
      </div>
    `

    // Console log for development (replace with real email service in production)
    console.log('[Email Service] Sending team invitation:')
    console.log('To:', email)
    console.log('Subject:', subject)
    console.log('--------------------------------------------------')
    console.log(html)
    console.log('--------------------------------------------------')

    // In production, integrate with a real email service:
    //
    // Using Nodemailer (SMTP):
    // import nodemailer from 'nodemailer'
    // const transporter = nodemailer.createTransport({
    //   host: process.env.SMTP_HOST,
    //   port: parseInt(process.env.SMTP_PORT || '587'),
    //   auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    // })
    // await transporter.sendMail({ to: email, subject, html })
    //
    // Using Resend (API):
    // import { Resend } from 'resend'
    // const resend = new Resend(process.env.RESEND_API_KEY)
    // await resend.emails.send({ from: 'noreply@gaboncod.com', to: email, subject, html })

    return { success: true }
  } catch (error) {
    console.error('[Email Service] Failed to send email:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

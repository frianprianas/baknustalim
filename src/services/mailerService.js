const nodemailer = require('nodemailer');

const MAIL_HOST = process.env.MAILCOW_MAIL_HOST || 'mail.smk.baktinusantara666.sch.id';
const SMTP_PORT = parseInt(process.env.MAILCOW_SMTP_PORT) || 465;
const SMTP_USER = process.env.SMTP_USER || 'admin@smk.baktinusantara666.sch.id';
const SMTP_PASS = process.env.SMTP_PASS || 'Buhun666';

const transporter = nodemailer.createTransport({
  host: MAIL_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465,
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS
  },
  connectionTimeout: 5000,
  greetingTimeout: 5000
});

/**
 * Send HTML notification email
 * 
 * @param {string} to - Recipient email
 * @param {string} subject - Email subject
 * @param {string} title - Action title
 * @param {string} bodyHtml - HTML body content
 */
async function sendNotification(to, subject, title, bodyHtml) {
  try {
    const appName = 'BaknusTa\'lim';
    const fromAddress = `"${appName} Notifikasi" <${SMTP_USER}>`;

    const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
        <div style="background-color: #10b981; padding: 24px; color: white; text-align: center;">
            <h2 style="margin: 0; font-size: 24px; font-weight: bold; letter-spacing: 0.5px;">[${appName} Notifikasi]</h2>
        </div>
        <div style="padding: 24px; color: #333; line-height: 1.6; background-color: #ffffff;">
            <h3 style="margin-top: 0; color: #065f46; font-size: 18px; border-bottom: 2px solid #ecfdf5; padding-bottom: 10px;">${title}</h3>
            <div style="margin-top: 15px;">
                ${bodyHtml}
            </div>
        </div>
        <div style="background-color: #f9fafb; padding: 15px; text-align: center; font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb;">
            &copy; ${new Date().getFullYear()} SMK Bhakti Nusantara 666. All rights reserved.
        </div>
    </div>
    `;

    const info = await transporter.sendMail({
      from: fromAddress,
      to,
      subject,
      html
    });
    console.log(`[SMTP] Email notification sent successfully to ${to}: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error(`[SMTP] Failed to send email notification to ${to}: ${error.message}`);
  }
}

module.exports = {
  sendNotification
};

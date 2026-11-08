import nodemailer from "nodemailer";
import { CharacterBio } from "./generate-bio";
import { generateCharacterPdf } from "./pdf-generator";

export interface MailConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromName: string;
}

export function getMailTransporter() {
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) {
    return null; // Return null if SMTP credentials not configured
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

export async function sendCharacterMail(char: CharacterBio, portalUrl: string): Promise<{ success: boolean; error?: string }> {
  const transporter = getMailTransporter();
  if (!transporter) {
    return {
      success: false,
      error: "SMTP not configured in environment variables (SMTP_USER / SMTP_PASS).",
    };
  }

  try {
    const pdfDoc = generateCharacterPdf(char);
    const pdfBuffer = Buffer.from(pdfDoc.output("arraybuffer"));

    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { background-color: #07080B; color: #F2EEE6; font-family: Arial, sans-serif; padding: 20px; }
        .card { background-color: #0E1015; border: 1px solid #D8B45A; padding: 24px; border-radius: 8px; max-width: 600px; margin: 0 auto; }
        .badge { background-color: ${char.roleColor}; color: #07080B; font-weight: bold; padding: 4px 12px; border-radius: 4px; display: inline-block; }
        .button { background-color: #D8B45A; color: #07080B; font-weight: bold; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; margin-top: 16px; }
        .footer { font-size: 12px; color: #6B7280; margin-top: 24px; text-align: center; }
      </style>
    </head>
    <body>
      <div class="card">
        <h2>THE SYNDICATE ACCORD</h2>
        <p>Greetings, <strong>${char.fullName}</strong>!</p>
        <p>Your character dossier for the upcoming week-long gala has been generated.</p>

        <p><span class="badge">${char.roleName.toUpperCase()}</span> • Badge #${char.badgeCode}</p>

        <h3>${char.title}</h3>
        <p style="font-style: italic; color: #B9BCC6;">"${char.tagline}"</p>

        <p>${char.originStory.slice(0, 250)}...</p>

        <p>Your official character sheet is attached as a high-resolution PDF to this email.</p>

        <a href="${portalUrl}/portal/${char.badgeCode}" class="button">Access Your Game Portal Profile</a>

        <div class="footer">
          Issued by The Syndicate Accord Game Wardens • Bring your PIN to check-in on Day 0.
        </div>
      </div>
    </body>
    </html>
    `;

    await transporter.sendMail({
      from: `"${process.env.SMTP_FROM_NAME || 'Syndicate Accord'}" <${process.env.SMTP_USER}>`,
      to: char.email,
      subject: `[Syndicate Accord] Your Character Dossier & Badge #${char.badgeCode}`,
      html: htmlContent,
      attachments: [
        {
          filename: `Syndicate_Character_${char.badgeCode}.pdf`,
          content: pdfBuffer,
          contentType: "application/pdf",
        },
      ],
    });

    return { success: true };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { success: false, error: errorMsg };
  }
}

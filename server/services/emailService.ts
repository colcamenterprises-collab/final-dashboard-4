import { gmailService } from "./gmailService";

export const sendEmail = async (to: string, subject: string, content: string): Promise<boolean> => {
  try {
    const sent = await gmailService.sendEmail({
      from: '"Smash Brothers Burgers" <colcamenterprises@gmail.com>',
      to,
      subject,
      html: content,
    });

    if (sent) {
      console.log("✅ Email sent via Gmail");
      return true;
    } else {
      console.warn("⚠️ Gmail API did not confirm email was sent.");
      return false;
    }
  } catch (error) {
    console.error("❌ Gmail API error:", error);
    return false;
  }
};

export const sendEmailWithAttachment = async (
  to: string, 
  subject: string, 
  content: string, 
  attachments: Array<{filename: string, content: string, encoding: string}>
): Promise<boolean> => {
  try {
    const sent = await gmailService.sendEmail({
      from: '"Smash Brothers Burgers" <colcamenterprises@gmail.com>',
      to,
      subject,
      html: content,
      attachments,
    });

    if (sent) {
      console.log("✅ Email with attachment sent via Gmail");
      return true;
    } else {
      console.warn("⚠️ Gmail API did not confirm email with attachment was sent.");
      return false;
    }
  } catch (error) {
    console.error("❌ Gmail API error sending attachment:", error);
    return false;
  }
};

import * as MailComposer from "expo-mail-composer";
import { printToFileAsync } from "expo-print";

export async function generatePDFWithEmail(content: string, userEmail: string) {
  try {
    // Generate PDF
    const { uri } = await printToFileAsync({
      html: content,
      base64: false,
    });

    // Check if email is available on device
    const isMailAvailable = await MailComposer.isAvailableAsync();

    if (!isMailAvailable) {
      throw new Error("Email is not available on this device");
    }

    // Send email
    const emailResult = await MailComposer.composeAsync({
      recipients: [userEmail],
      subject: `Your Data Privacy Report - ${new Date().toLocaleDateString()}`,
      body: `
Hi there,

Please find your requested data privacy report attached to this email.

This report contains:
• All personal data we have about you
• How we use your data
• Your privacy rights
• Contact information for any questions

If you have any questions about your data or this report, please don't hesitate to contact us.

Best regards,
The PhunParty Team
      `,
      attachments: [uri],
    });

    if (emailResult.status === MailComposer.MailComposerStatus.SENT) {
      return { success: true, method: "email", uri };
    } else if (emailResult.status === MailComposer.MailComposerStatus.SAVED) {
      return { success: true, method: "draft", uri };
    } else {
      return { success: false, method: "cancelled", uri };
    }
  } catch (error) {
    throw error;
  }
}

// The file generated will inform users of the data that the app holds about them and what that data is used for
export const generateDataPrivacyPDF = async (
  userData: any,
  options?: {
    sendEmail?: boolean;
  }
) => {
  const content = `
    <html>
      <head>
        <meta charset="utf-8" />
        <title>PhunParty Data Privacy Report</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
            line-height: 1.6;
          }
          h1 {
            color: #333;
            border-bottom: 2px solid #4CAF50;
            padding-bottom: 10px;
          }
          h2 {
            color: #444;
            margin-top: 25px;
            margin-bottom: 15px;
          }
          p {
            color: #666;
            margin-bottom: 8px;
          }
          ul {
            color: #666;
            padding-left: 20px;
          }
          li {
            margin-bottom: 5px;
          }
          strong {
            color: #333;
          }
          small {
            color: #999;
            font-style: italic;
          }
        </style>
      </head>
      <body>
        <h1>Data Privacy Report</h1>
        <p>This document outlines the data we hold about you and how it is used.</p>
        <h2>Your Data</h2>
        <p>${userData.player_name ? `Name: ${userData.player_name}` : ""}</p>
        <p>${userData.player_email ? `Email: ${userData.player_email}` : ""}</p>
        <p>${
          userData.player_mobile ? `Mobile: ${userData.player_mobile}` : ""
        }</p>
        <p>${userData.player_id ? `Player ID: ${userData.player_id}` : ""}</p>
        <p>${
          userData.profile_photo_url
            ? `Profile Photo: Yes`
            : "Profile Photo: No"
        }</p>
        <h2>How We Use Your Data</h2>
        <ul>
          <li><strong>Name:</strong> Used to identify you in games and on your profile</li>
          <li><strong>Email:</strong> Used for account verification, password resets, and important notifications</li>
          <li><strong>Mobile:</strong> Used for account security and optional SMS notifications</li>
          <li><strong>Profile Photo:</strong> Displayed on your profile and in games for identification if permitted by you. Your photos are securely stored and not shared without your consent.</li>
          <li><strong>Game Data:</strong> Used to track your game statistics and progress</li>
          <li><strong>Password:</strong> Your password is hashed and stored securely. Your password is not accessible to anyone, including us.</li>
          <li><strong>Login Tokens:</strong> Used to maintain your logged-in session securely as it is saved directly on your device.</li>
        </ul>
        <hr>
        <h2>Data Retention</h2>
        <p>We retain your personal data for as long as your account is active. You can request deletion of your account and all associated data at any time through the app settings.</p>
        
        <h2>Your Rights</h2>
        <ul>
          <li>Right to access your personal data</li>
          <li>Right to rectify inaccurate data</li>
          <li>Right to erase your data</li>
          <li>Right to restrict processing</li>
          <li>Right to data portability</li>
        </ul>
        <h2>Contact Information</h2>
        <p>If you have any questions about your data or this privacy report, please contact us through the app or visit our <a href="https://terms-and-privacy.nexusgit.info/websites/phun-party/privacy">privacy policy</a>.</p>
        
        <p><small>Generated on: ${new Date().toLocaleDateString()}</small></p>
        </body>
    </html>
  `;

  // Send email if user has email and sendEmail option is enabled
  if (options?.sendEmail && userData.player_email) {
    return await generatePDFWithEmail(content, userData.player_email);
  } else {
    throw new Error("Email is required for data export");
  }
};

import { google } from "googleapis";

const CONN_ID = "conn_google-mail_01KKQYC5ZK0BWADJWDAWCZDHM0";

function getUncachableGmailClient() {
  const credentialsJson = process.env[`CONNECTION_${CONN_ID}_CREDENTIALS`] || "{}";
  let credentials: any;
  try {
    credentials = JSON.parse(credentialsJson);
  } catch {
    throw new Error("Gmail credentials not configured");
  }

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({
    access_token: credentials.access_token,
    refresh_token: credentials.refresh_token,
    expiry_date: credentials.expiry_date,
  });

  return google.gmail({ version: "v1", auth: oauth2Client });
}

function sanitizeHeader(value: string): string {
  return value.replace(/[\r\n]/g, " ").trim();
}

export async function sendGmailEmail(to: string, subject: string, body: string): Promise<void> {
  const gmail = getUncachableGmailClient();

  const safeTo = sanitizeHeader(to);
  const safeSubject = sanitizeHeader(subject);

  const raw = Buffer.from(
    `To: ${safeTo}\r\n` +
    `Subject: ${safeSubject}\r\n` +
    `Content-Type: text/plain; charset=utf-8\r\n\r\n` +
    body
  ).toString("base64url");

  await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw },
  });
}

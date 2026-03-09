type MailConfig = {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  fromAddress: string;
};

export function getMailConfig(): MailConfig {
  const tenantId = process.env.AZURE_MAIL_TENANT_ID;
  const clientId = process.env.AZURE_MAIL_CLIENT_ID;
  const clientSecret = process.env.AZURE_MAIL_CLIENT_SECRET;
  const fromAddress = process.env.AZURE_MAIL_FROM;

  if (!tenantId || !clientId || !clientSecret || !fromAddress) {
    throw new Error("Azure mail settings are not fully configured");
  }

  return {
    tenantId,
    clientId,
    clientSecret,
    fromAddress,
  };
}

async function getGraphAccessToken(config: MailConfig): Promise<string> {
  const tokenUrl = `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`;
  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: "client_credentials",
      scope: "https://graph.microsoft.com/.default",
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Failed to acquire Graph token: ${response.status} ${errorBody}`);
  }

  const data = await response.json() as { access_token?: string };
  if (!data.access_token) {
    throw new Error("Graph token response did not include an access token");
  }

  return data.access_token;
}

async function sendMail(message: {
  to: string;
  subject: string;
  html: string;
}) {
  const config = getMailConfig();
  const accessToken = await getGraphAccessToken(config);
  const sendMailUrl = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(config.fromAddress)}/sendMail`;

  const response = await fetch(sendMailUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: {
        subject: message.subject,
        body: {
          contentType: "HTML",
          content: message.html,
        },
        toRecipients: [
          {
            emailAddress: {
              address: message.to,
            },
          },
        ],
      },
      saveToSentItems: true,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Failed to send mail with Graph: ${response.status} ${errorBody}`);
  }

  return {
    provider: "microsoft-graph",
    from: config.fromAddress,
    to: message.to,
    subject: message.subject,
  };
}

export async function sendTemporaryPasswordEmail(to: string, username: string, temporaryPassword: string) {
  const subject = "Your Major Golf temporary password";
  const html = [
    `<p>Hello ${username},</p>`,
    "<p>An administrator reset your password for Major Golf.</p>",
    `<p>Your temporary password is <strong>${temporaryPassword}</strong>.</p>`,
    "<p>Use this password to sign in.</p>",
  ].join("");

  return sendMail({
    to,
    subject,
    html,
  });
}

export async function sendPasswordResetLinkEmail(to: string, username: string, resetUrl: string) {
  const subject = "Reset your Major Golf password";
  const html = [
    `<p>Hello ${username},</p>`,
    "<p>We received a request to reset your Major Golf password.</p>",
    `<p><a href="${resetUrl}">Reset your password</a></p>`,
    "<p>This link expires in 1 hour. If you did not request this, you can ignore this email.</p>",
  ].join("");

  return sendMail({
    to,
    subject,
    html,
  });
}

export async function sendAdminTestEmail(to: string) {
  const subject = "Major Golf mail test";
  const html = [
    "<p>This is a test email from Major Golf.</p>",
    `<p>Sent at ${new Date().toISOString()}.</p>`,
  ].join("");

  return sendMail({
    to,
    subject,
    html,
  });
}

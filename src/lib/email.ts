type EmailMessage = {
  to: string;
  subject: string;
  text: string;
};

export async function sendTransactionalEmail(message: EmailMessage) {
  const apiKey = process.env.EMAIL_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    throw new Error("Transactional email is not configured.");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ...message, from }),
  });

  if (!response.ok) {
    throw new Error(`Transactional email delivery failed (${response.status}).`);
  }
}

const nodemailer = require("nodemailer");
const { gmailAppPassword, gmailUser, mailFrom } = require("../config/env");

let transporter;

function getTransporter() {
  if (transporter) return transporter;
  if (!gmailUser || !gmailAppPassword || !mailFrom) {
    const error = new Error("Gmail email service is not configured.");
    error.statusCode = 503;
    throw error;
  }

  transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: gmailUser,
      pass: gmailAppPassword,
    },
  });
  return transporter;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function sendVerificationEmail({ to, name, code, expiresInMinutes }) {
  await getTransporter().sendMail({
    from: mailFrom,
    to,
    subject: "Verify your LuxeBag account",
    text: [
      `Hello ${name || "there"},`,
      "",
      `Your LuxeBag verification code is: ${code}`,
      `This code expires in ${expiresInMinutes} minutes.`,
      "",
      "If you did not create this account, ignore this email.",
    ].join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto">
        <h2>Verify your LuxeBag account</h2>
        <p>Hello ${escapeHtml(name || "there")},</p>
        <p>Enter this code in the LuxeBag app:</p>
        <div style="font-size:32px;font-weight:700;letter-spacing:8px;padding:20px 0">
          ${escapeHtml(code)}
        </div>
        <p>This code expires in ${Number(expiresInMinutes)} minutes.</p>
        <p>If you did not create this account, ignore this email.</p>
      </div>
    `,
  });
}

module.exports = { sendVerificationEmail };

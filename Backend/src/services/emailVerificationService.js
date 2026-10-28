const crypto = require("crypto");
const EmailVerification = require("../models/EmailVerification");
const {
  emailCodeTtlMinutes,
  emailVerificationSecret,
} = require("../config/env");
const { sendVerificationEmail } = require("./mailer");

const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;

function requireSecret() {
  if (!emailVerificationSecret) {
    const error = new Error("EMAIL_VERIFICATION_SECRET is not configured.");
    error.statusCode = 503;
    throw error;
  }
}

function hashCode(userId, code) {
  requireSecret();
  return crypto
    .createHmac("sha256", emailVerificationSecret)
    .update(`${String(userId)}:${String(code)}`)
    .digest("hex");
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left), "hex");
  const b = Buffer.from(String(right), "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function issueAndSendVerificationCode(
  user,
  { enforceCooldown = true } = {},
) {
  const existing = await EmailVerification.findOne({ userId: user._id });
  if (
    enforceCooldown &&
    existing?.lastSentAt &&
    Date.now() - existing.lastSentAt.getTime() < RESEND_COOLDOWN_MS
  ) {
    const error = new Error(
      "Please wait one minute before requesting another code.",
    );
    error.statusCode = 429;
    error.code = "verification_cooldown";
    throw error;
  }

  const code = String(crypto.randomInt(100000, 1000000));
  const now = new Date();
  const expiresAt = new Date(now.getTime() + emailCodeTtlMinutes * 60 * 1000);

  await EmailVerification.findOneAndUpdate(
    { userId: user._id },
    {
      $set: {
        codeHash: hashCode(user._id, code),
        attempts: 0,
        lastSentAt: now,
        expiresAt,
      },
    },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
  );

  await sendVerificationEmail({
    to: user.email,
    name: user.name,
    code,
    expiresInMinutes: emailCodeTtlMinutes,
  });
}

async function verifyCode(user, rawCode) {
  const code = String(rawCode || "").trim();
  if (!/^\d{6}$/.test(code)) {
    return { ok: false, code: "invalid_verification_code" };
  }

  const record = await EmailVerification.findOne({ userId: user._id });
  if (!record || record.expiresAt.getTime() <= Date.now()) {
    if (record) await EmailVerification.deleteOne({ _id: record._id });
    return { ok: false, code: "verification_expired" };
  }

  if (record.attempts >= MAX_ATTEMPTS) {
    await EmailVerification.deleteOne({ _id: record._id });
    return { ok: false, code: "verification_locked" };
  }

  const matches = safeEqual(record.codeHash, hashCode(user._id, code));
  if (!matches) {
    record.attempts += 1;
    await record.save();
    return { ok: false, code: "invalid_verification_code" };
  }

  await EmailVerification.deleteOne({ _id: record._id });
  return { ok: true };
}

module.exports = {
  issueAndSendVerificationCode,
  verifyCode,
};

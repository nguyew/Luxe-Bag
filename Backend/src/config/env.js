const path = require("path");
const dotenv = require("dotenv");

// Load .env no matter where `node` is started from. Backend/.env is the
// documented location; Backend/src/.env is also supported as a fallback.
// dotenv never overrides a variable that is already set, so the first file wins.
[
  path.resolve(__dirname, "../../.env"),
  path.resolve(__dirname, "../.env"),
].forEach((envPath) => dotenv.config({ path: envPath, quiet: true }));

const port = Number.parseInt(process.env.PORT || "5000", 10);
const nodeEnv = process.env.NODE_ENV || "development";
const positiveInteger = (rawValue, fallback, minimum) => {
  const value = Number.parseInt(rawValue || String(fallback), 10);
  return Number.isFinite(value) ? Math.max(value, minimum) : fallback;
};
const paymentTimeoutMinutes = positiveInteger(process.env.PAYMENT_TIMEOUT_MINUTES, 30, 5);
const paymentCleanupIntervalMinutes = positiveInteger(
  process.env.PAYMENT_CLEANUP_INTERVAL_MINUTES,
  5,
  1,
);
const emailVerificationEnabled =
  String(process.env.EMAIL_VERIFICATION_ENABLED || "true").toLowerCase() ===
  "true";

if (Number.isNaN(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be a valid TCP port between 1 and 65535");
}

module.exports = {
  allowedOrigins: (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
  b2ApplicationKey: process.env.B2_APPLICATION_KEY || "",
  b2ApplicationKeyId: process.env.B2_APPLICATION_KEY_ID || "",
  b2BucketName: process.env.B2_BUCKET_NAME || "",
  b2Endpoint: process.env.B2_ENDPOINT || "",
  b2PublicUrl: (process.env.B2_PUBLIC_URL || "").replace(/\/+$/, ""),
  geminiApiKey: process.env.GEMINI_API_KEY || "",
  geminiModel: process.env.GEMINI_MODEL || "gemini-3.8-flash",
  // Tried in order when the main model is overloaded or unavailable.
  geminiFallbackModels: (
    process.env.GEMINI_FALLBACK_MODELS ||
    "gemini-3.7-flash,gemini-3.5-flash-lite,gemini-3.1-flash-lite"
  )
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  jwtSecret:
    process.env.JWT_SECRET ||
    (nodeEnv === "production" ? "" : "development-only-change-me"),
  mongoUri: process.env.MONGODB_URI || "",
  nodeEnv,
  paymentCleanupIntervalMinutes,
  paymentTimeoutMinutes,
  port,
  stripeCurrency: (process.env.STRIPE_CURRENCY || "vnd").toLowerCase(),
  stripeSecretKey: process.env.STRIPE_SECRET_KEY || "",
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || "",

  emailCodeTtlMinutes: Math.max(
    Number.parseInt(process.env.EMAIL_CODE_TTL_MINUTES || "10", 10),
    5,
  ),
  emailVerificationEnabled,
  emailVerificationSecret: process.env.EMAIL_VERIFICATION_SECRET || "",
  gmailAppPassword: process.env.GMAIL_APP_PASSWORD || "",
  gmailUser: process.env.GMAIL_USER || "",
  mailFrom: process.env.MAIL_FROM || process.env.GMAIL_USER || "",
};

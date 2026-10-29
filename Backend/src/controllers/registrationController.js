const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const {
  emailVerificationEnabled,
  jwtExpiresIn,
  jwtSecret,
} = require("../config/env");
const { publicUser } = require("../utils/user");
const {
  issueAndSendVerificationCode,
  verifyCode,
} = require("../services/emailVerificationService");

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function issueToken(user) {
  return jwt.sign({ sub: user._id.toString(), role: user.role }, jwtSecret, {
    expiresIn: jwtExpiresIn,
  });
}

function validateRegistration({ name, email, password }) {
  const errors = [];
  if (
    typeof name !== "string" ||
    name.trim().length < 2 ||
    name.trim().length > 100
  ) {
    errors.push("Name must be between 2 and 100 characters.");
  }
  if (typeof email !== "string" || !emailPattern.test(email.trim())) {
    errors.push("A valid email is required.");
  }
  if (typeof password !== "string" || password.length < 8) {
    errors.push("Password must be at least 8 characters.");
  }
  return errors;
}

async function register(req, res) {
  const { name, email, password } = req.body || {};
  const errors = validateRegistration({ name, email, password });
  if (errors.length) {
    return res.status(400).json({
      error: "Validation failed.",
      code: "invalid_input",
      details: errors,
    });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const existing = await User.findOne({ email: normalizedEmail });
  if (existing) {
    return res.status(409).json({
      error: existing.emailVerifiedAt
        ? "An account with that email already exists."
        : "This email is registered but not verified. Request a new code.",
      code: existing.emailVerifiedAt ? "email_taken" : "email_not_verified",
    });
  }

  const user = await User.create({
    name: name.trim(),
    email: normalizedEmail,
    passwordHash: await bcrypt.hash(password, 12),
    emailVerifiedAt: emailVerificationEnabled ? null : new Date(),
  });

  if (!emailVerificationEnabled) {
    return res.status(201).json({
      token: issueToken(user),
      user: publicUser(user),
    });
  }

  try {
    await issueAndSendVerificationCode(user, { enforceCooldown: false });
  } catch (error) {
    // Tránh để lại tài khoản không thể hoàn tất khi lần gửi đầu tiên thất bại.
    await User.deleteOne({ _id: user._id });
    throw error;
  }

  return res.status(201).json({
    verificationRequired: true,
    email: normalizedEmail,
  });
}

async function verifyEmail(req, res) {
  const email = String(req.body?.email || "")
    .trim()
    .toLowerCase();
  const code = String(req.body?.code || "").trim();
  const user = await User.findOne({ email });

  if (!user) {
    return res
      .status(400)
      .json({
        error: "Invalid email or code.",
        code: "invalid_verification_code",
      });
  }
  if (user.emailVerifiedAt) {
    // Tuyệt đối không cấp JWT chỉ dựa trên email. Nếu đã xác minh, user phải đăng nhập bằng mật khẩu.
    return res.status(409).json({
      error: "This account is already verified. Please sign in.",
      code: "email_already_verified",
    });
  }

  const result = await verifyCode(user, code);
  if (!result.ok) {
    const messages = {
      invalid_verification_code: "The verification code is incorrect.",
      verification_expired:
        "The verification code has expired. Request a new code.",
      verification_locked: "Too many incorrect attempts. Request a new code.",
    };
    return res
      .status(400)
      .json({ error: messages[result.code], code: result.code });
  }

  user.emailVerifiedAt = new Date();
  await user.save();
  return res.json({ token: issueToken(user), user: publicUser(user) });
}

async function resendVerification(req, res) {
  const email = String(req.body?.email || "")
    .trim()
    .toLowerCase();
  const user = await User.findOne({ email });

  // Trả cùng một thông báo để không làm lộ email nào đã đăng ký.
  if (!user || user.emailVerifiedAt) {
    return res.json({
      message: "If the account needs verification, a new code has been sent.",
    });
  }

  await issueAndSendVerificationCode(user);
  return res.json({ message: "A new verification code has been sent." });
}

module.exports = { register, resendVerification, verifyEmail };

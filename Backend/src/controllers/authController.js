const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const crypto = require("crypto");
const { deleteObject, uploadObject } = require("../services/b2Storage");
const {
  emailVerificationEnabled,
  jwtExpiresIn,
  jwtSecret,
} = require("../config/env");
const { publicUser } = require("../utils/user");

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const issueToken = (user) =>
  jwt.sign({ sub: user._id.toString(), role: user.role }, jwtSecret, {
    expiresIn: jwtExpiresIn,
  });

const validateCredentials = ({ name, email, password }, isRegistration) => {
  const errors = [];
  if (isRegistration && (typeof name !== "string" || name.trim().length < 2)) {
    errors.push("Name must be at least 2 characters.");
  }
  if (typeof email !== "string" || !emailPattern.test(email.trim())) {
    errors.push("A valid email is required.");
  }
  if (typeof password !== "string" || password.length < 8) {
    errors.push("Password must be at least 8 characters.");
  }
  return errors;
};

const register = async (req, res) => {
  const { name, email, password } = req.body || {};
  const errors = validateCredentials({ name, email, password }, true);
  if (errors.length) {
    return res
      .status(400)
      .json({ error: "Validation failed.", details: errors });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) {
    return res
      .status(409)
      .json({ error: "An account with that email already exists." });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({
    name: name.trim(),
    email: normalizedEmail,
    passwordHash,
  });

  return res
    .status(201)
    .json({ token: issueToken(user), user: publicUser(user) });
};

const login = async (req, res) => {
  const { email, password } = req.body || {};
  const errors = validateCredentials({ email, password }, false);
  if (errors.length) {
    return res
      .status(400)
      .json({ error: "Validation failed.", details: errors });
  }

  const user = await User.findOne({ email: email.trim().toLowerCase() }).select(
    "+passwordHash",
  );
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ error: "Invalid email or password." });
  }
  if (user.status !== "active") {
    return res.status(403).json({ error: "This account is disabled." });
  }

  // Seeded demo accounts are pre-approved for classroom/demo use.
  // Keep email verification enabled for all real accounts.
  const demoAccountEmails = new Set([
    "admin@luxebag.com",
    "customer@luxebag.com",
  ]);
  const isDemoAccount = demoAccountEmails.has(user.email);

  if (emailVerificationEnabled && !user.emailVerifiedAt && !isDemoAccount) {
    return res.status(403).json({
      error: "Please verify your email before signing in.",
      code: "email_not_verified",
    });
  }

  return res.json({ token: issueToken(user), user: publicUser(user) });
};

const getCurrentUser = (req, res) => res.json({ user: publicUser(req.user) });

const allowedAvatarTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

const updateAvatar = async (req, res) => {
  const contentType = String(req.headers["content-type"] || "").toLowerCase();
  if (!allowedAvatarTypes.has(contentType)) {
    return res
      .status(400)
      .json({ error: "Only JPEG, PNG, and WebP images are allowed." });
  }
  if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
    return res.status(400).json({ error: "An image body is required." });
  }
  if (req.body.length > 5 * 1024 * 1024) {
    return res
      .status(413)
      .json({ error: "Profile photos must be 5 MB or smaller." });
  }

  const extension =
    contentType === "image/jpeg" ? "jpg" : contentType.split("/")[1];
  const key = `avatars/${req.user._id.toString()}/${crypto.randomUUID()}.${extension}`;
  const avatarUrl = await uploadObject({ key, body: req.body, contentType });
  const previousKey = req.user.avatarKey;

  try {
    req.user.avatarUrl = avatarUrl;
    req.user.avatarKey = key;
    await req.user.save();
  } catch (error) {
    try {
      await deleteObject(key);
    } catch {
      /* cleanup is best effort */
    }
    throw error;
  }

  if (previousKey && previousKey !== key) {
    try {
      await deleteObject(previousKey);
    } catch (error) {
      // A stale old object is preferable to failing a successful profile update.
      console.warn("Could not delete previous profile avatar:", error.message);
    }
  }
  return res.json({ user: publicUser(req.user) });
};

const deleteAvatar = async (req, res) => {
  const previousKey = req.user.avatarKey;
  req.user.avatarUrl = "";
  req.user.avatarKey = "";
  await req.user.save();
  if (previousKey) {
    try {
      await deleteObject(previousKey);
    } catch (error) {
      console.warn("Could not delete profile avatar object:", error.message);
    }
  }
  return res.json({ user: publicUser(req.user) });
};

const updateCurrentUser = async (req, res) => {
  const { name, phone, addresses } = req.body || {};
  const updates = {};

  if (name !== undefined) {
    if (
      typeof name !== "string" ||
      name.trim().length < 2 ||
      name.trim().length > 100
    ) {
      return res
        .status(400)
        .json({
          error: "Name must be between 2 and 100 characters.",
          code: "invalid_input",
        });
    }
    updates.name = name.trim();
  }

  if (phone !== undefined) {
    if (typeof phone !== "string") {
      return res
        .status(400)
        .json({ error: "Phone must be a string.", code: "invalid_input" });
    }
    updates.phone = phone.trim();
  }

  if (addresses !== undefined) {
    if (!Array.isArray(addresses) || addresses.length > 10) {
      return res
        .status(400)
        .json({
          error: "Addresses must be an array containing at most 10 entries.",
          code: "invalid_input",
        });
    }
    const validAddresses = addresses.every(
      (address) =>
        address &&
        typeof address === "object" &&
        typeof address.id === "string" &&
        address.id.trim() &&
        typeof address.fullName === "string" &&
        address.fullName.trim() &&
        typeof address.phone === "string" &&
        address.phone.trim() &&
        typeof address.line1 === "string" &&
        address.line1.trim() &&
        typeof address.city === "string" &&
        address.city.trim(),
    );
    if (!validAddresses) {
      return res
        .status(400)
        .json({
          error:
            "Each address must include id, fullName, phone, line1, and city.",
          code: "invalid_input",
        });
    }
    const normalized = addresses.map((address) => ({
      id: address.id.trim(),
      label:
        String(address.label || "Home")
          .trim()
          .slice(0, 20) || "Home",
      fullName: address.fullName.trim(),
      phone: address.phone.trim(),
      line1: address.line1.trim(),
      city: address.city.trim(),
      isDefault: address.isDefault === true,
    }));
    if (normalized.length) {
      const defaultIndex = normalized.findIndex((address) => address.isDefault);
      const keepDefault = defaultIndex >= 0 ? defaultIndex : 0;
      normalized.forEach((address, index) => {
        address.isDefault = index === keepDefault;
      });
    }
    updates.addresses = normalized;
  }

  if (!Object.keys(updates).length) {
    return res
      .status(400)
      .json({
        error: "At least one editable field is required.",
        code: "invalid_input",
      });
  }

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { $set: updates },
    {
      new: true,
      runValidators: true,
    },
  );
  if (!user) return res.status(404).json({ error: "User not found." });
  return res.json({ user: publicUser(user) });
};

module.exports = {
  getCurrentUser,
  updateCurrentUser,
  updateAvatar,
  deleteAvatar,
  login,
  register,
};

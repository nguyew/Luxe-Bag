const express = require("express");
const { rateLimit } = require("express-rate-limit");
const asyncHandler = require("../middleware/asyncHandler");
const authenticate = require("../middleware/authenticate");
const {
  getCurrentUser,
  updateCurrentUser,
  updateAvatar,
  deleteAvatar,
  login,
} = require("../controllers/authController");
const {
  register,
  resendVerification,
  verifyEmail,
} = require("../controllers/registrationController");

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    error: "Too many authentication attempts. Please try again later.",
    code: "rate_limited",
  },
});

const resendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    error: "Too many verification requests. Please try again later.",
    code: "rate_limited",
  },
});

router.post("/register", authLimiter, asyncHandler(register));
router.post("/verify-email", authLimiter, asyncHandler(verifyEmail));
router.post(
  "/resend-verification",
  resendLimiter,
  asyncHandler(resendVerification),
);
router.post("/login", authLimiter, asyncHandler(login));

router
  .route("/me")
  .get(authenticate, getCurrentUser)
  .patch(authenticate, asyncHandler(updateCurrentUser));

router.put(
  "/me/avatar",
  authenticate,
  express.raw({
    type: ["image/jpeg", "image/png", "image/webp"],
    limit: "5mb",
  }),
  asyncHandler(updateAvatar),
);
router.delete("/me/avatar", authenticate, asyncHandler(deleteAvatar));

module.exports = router;

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

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     tags: [Authentication]
 *     summary: Register a customer account
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRequest'
 *     responses:
 *       201:
 *         description: Account created; a session token is returned when email verification is disabled
 *       400: { description: Invalid registration data }
 *       409: { description: Email is already registered }
 */
router.post("/register", authLimiter, asyncHandler(register));

/**
 * @swagger
 * /api/auth/verify-email:
 *   post:
 *     tags: [Authentication]
 *     summary: Verify a customer email address
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, code]
 *             properties:
 *               email: { type: string, format: email }
 *               code: { type: string, minLength: 6, maxLength: 6, example: '123456' }
 *     responses:
 *       200:
 *         description: Email verified and session token issued
 *       400: { description: Invalid or expired verification code }
 *       409: { description: Email is already verified }
 */
router.post("/verify-email", authLimiter, asyncHandler(verifyEmail));

/**
 * @swagger
 * /api/auth/resend-verification:
 *   post:
 *     tags: [Authentication]
 *     summary: Resend an email verification code
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, format: email }
 *     responses:
 *       200: { description: Verification request processed }
 *       429: { description: Too many verification requests }
 */
router.post(
  "/resend-verification",
  resendLimiter,
  asyncHandler(resendVerification),
);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     tags: [Authentication]
 *     summary: Sign in
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200: { description: Session token and public user returned }
 *       400: { description: Invalid credentials format }
 *       401: { description: Invalid email or password }
 *       403: { description: Account is disabled or email is not verified }
 */
router.post("/login", authLimiter, asyncHandler(login));

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     tags: [Authentication]
 *     summary: Get the authenticated user's profile
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Current user's public profile
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user: { $ref: '#/components/schemas/User' }
 *       401: { description: Authentication required }
 *   patch:
 *     tags: [Authentication]
 *     summary: Update the authenticated user's profile
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string, minLength: 2, maxLength: 100 }
 *               phone: { type: string }
 *               addresses:
 *                 type: array
 *                 maxItems: 10
 *                 items:
 *                   allOf:
 *                     - $ref: '#/components/schemas/Address'
 *                     - type: object
 *                       required: [id]
 *                       properties:
 *                         id: { type: string }
 *                         label: { type: string }
 *                         isDefault: { type: boolean }
 *             minProperties: 1
 *     responses:
 *       200: { description: Updated public user profile }
 *       400: { description: Invalid profile data }
 *       401: { description: Authentication required }
 */
router
  .route("/me")
  .get(authenticate, getCurrentUser)
  .patch(authenticate, asyncHandler(updateCurrentUser));

/**
 * @swagger
 * /api/auth/me/avatar:
 *   put:
 *     tags: [Authentication]
 *     summary: Upload the authenticated user's avatar
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         image/jpeg: { schema: { type: string, format: binary } }
 *         image/png: { schema: { type: string, format: binary } }
 *         image/webp: { schema: { type: string, format: binary } }
 *     responses:
 *       200: { description: Updated public user profile }
 *       400: { description: Invalid or missing image }
 *       401: { description: Authentication required }
 *       413: { description: Image is too large }
 *   delete:
 *     tags: [Authentication]
 *     summary: Delete the authenticated user's avatar
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Updated public user profile }
 *       401: { description: Authentication required }
 */
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

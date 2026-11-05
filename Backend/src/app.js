const {
  connectDatabase,
} = require('./config/db');

const {
  mongoUri,
} = require('./config/env');
const cors = require('cors');
const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const passport = require('./config/passport');
const swaggerUi = require('swagger-ui-express');
const { allowedOrigins, nodeEnv } = require('./config/env');
const asyncHandler = require('./middleware/asyncHandler');
const { stripeWebhook } = require('./controllers/paymentController');
const swaggerDocument = require('./config/swagger');
const adminRoutes = require('./routes/adminRoutes');
const authRoutes = require('./routes/authRoutes');
const healthRoutes = require('./routes/healthRoutes');
const productRoutes = require('./routes/productRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const orderRoutes = require('./routes/orderRoutes');
const couponRoutes = require('./routes/couponRoutes');
const cartRoutes = require('./routes/cartRoutes');
const favoriteRoutes = require('./routes/favoriteRoutes');
const aiRoutes = require('./routes/aiRoutes');
const catalogRoutes = require('./routes/catalogRoutes');
const promotionRoutes = require('./routes/promotionRoutes');
const { errorHandler, notFound } = require('./middleware/errorHandler');

const app = express();

app.disable('x-powered-by');
app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin) || (nodeEnv !== 'production' && !allowedOrigins.length)) {
      return callback(null, true);
    }
    const error = new Error('Origin is not allowed by CORS.');
    error.statusCode = 403;
    return callback(error);
  },
}));
app.use(async (req, res, next) => {
  try {
    await connectDatabase(mongoUri);
    next();
  } catch (error) {
    next(error);
  }
});

// Stripe requires the exact raw request body to verify the webhook signature.
// This endpoint must stay before express.json().
/**
 * @swagger
 * /api/payments/stripe/webhook:
 *   post:
 *     tags: [Payments]
 *     summary: Receive signed Stripe payment and refund events
 *     responses:
 *       200: { description: Event accepted }
 *       400: { description: Invalid webhook signature }
 */
app.post(
  '/api/payments/stripe/webhook',
  express.raw({ type: 'application/json', limit: '1mb' }),
  asyncHandler(stripeWebhook)
);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(nodeEnv === 'production' ? 'combined' : 'dev'));
app.use(passport.initialize());

app.get('/', (req, res) => {
  res.json({ name: 'LuxeBag API', status: 'ok' });
});
app.use(
  '/api-docs',
  swaggerUi.serve,
  swaggerUi.setup(swaggerDocument, {
    swaggerOptions: {
      operationsSorter: 'alpha',
    },
  })
);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/products/:productId/reviews', reviewRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/catalog', catalogRoutes);
app.use('/api/promotions', promotionRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;

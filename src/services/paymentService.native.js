/**
 * Thanh toán thẻ bằng Stripe PaymentSheet.
 *
 * Luồng: Backend tạo PaymentIntent khi đặt đơn (POST /api/orders, paymentMethod "card")
 * và trả về clientSecret. Ở đây mình khởi tạo và mở PaymentSheet bằng clientSecret đó.
 *
 * Quan trọng: kết quả của PaymentSheet chỉ cho biết khách đã hoàn tất thao tác trên máy.
 * Đơn chỉ được coi là "paid" khi webhook Stripe của Backend xác nhận; app luôn tải lại
 * GET /api/orders/{id} để lấy trạng thái thật.
 */
// Publishable key (pk_test_... / pk_live_...) – khóa công khai, an toàn để nằm trong app.
const PUBLISHABLE_KEY = (process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || '').trim();
const MERCHANT_NAME = 'LuxeBag';
const RETURN_URL = 'luxebag://stripe-redirect';

export class PaymentError extends Error {
  constructor(code, message) {
    super(message || code);
    this.name = 'PaymentError';
    this.code = code;
  }
}

/** App đã được cấu hình khóa Stripe chưa? */
export const isStripeConfigured = () => PUBLISHABLE_KEY.length > 0;

/** Thông báo thân thiện cho khách. */
export function describePaymentError(error) {
  switch (error?.code) {
    case 'not_configured':
      return 'Card payments are not set up in this app yet. Please choose cash on delivery.';
    case 'unsupported':
      return 'Card payments are not supported on this device. Please choose cash on delivery.';
    default:
      return error?.message || 'The payment could not be completed. Please try again.';
  }
}

let initialized = false;

// Nạp module native khi thật sự cần, để bản không có Stripe vẫn khởi động được.
function loadStripe() {
  try {
    return require('@stripe/stripe-react-native');
  } catch {
    throw new PaymentError('unsupported');
  }
}

/**
 * Mở PaymentSheet cho một PaymentIntent.
 * Trả về { status: 'succeeded' } khi khách hoàn tất, hoặc { status: 'canceled' } khi khách đóng sheet.
 * Ném PaymentError khi thanh toán thất bại hoặc Stripe chưa sẵn sàng.
 */
export async function presentCardPayment({ clientSecret, name, email }) {
  if (!clientSecret) throw new PaymentError('failed', 'Missing payment details from the server.');
  if (!isStripeConfigured()) throw new PaymentError('not_configured');

  const stripe = loadStripe();

  if (!initialized) {
    await stripe.initStripe({ publishableKey: PUBLISHABLE_KEY });
    initialized = true;
  }

  const prepared = await stripe.initPaymentSheet({
    paymentIntentClientSecret: clientSecret,
    merchantDisplayName: MERCHANT_NAME,
    returnURL: RETURN_URL,
    allowsDelayedPaymentMethods: false,
    defaultBillingDetails: {
      ...(name ? { name } : {}),
      ...(email ? { email } : {}),
    },
  });
  if (prepared?.error) {
    throw new PaymentError('failed', prepared.error.message);
  }

  const result = await stripe.presentPaymentSheet();
  if (!result?.error) return { status: 'succeeded' };
  if (result.error.code === 'Canceled') return { status: 'canceled' };
  throw new PaymentError('failed', result.error.message);
}
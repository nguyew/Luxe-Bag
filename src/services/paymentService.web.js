import { loadStripe } from '@stripe/stripe-js';

const PUBLISHABLE_KEY = (process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || '').trim();
export const stripePromise = PUBLISHABLE_KEY ? loadStripe(PUBLISHABLE_KEY) : null;
let cardElement = null;

export class PaymentError extends Error {
  constructor(code, message) {
    super(message || code);
    this.name = 'PaymentError';
    this.code = code;
  }
}

export const isStripeConfigured = () => PUBLISHABLE_KEY.length > 0;

export function registerCardElement(element) {
  cardElement = element;
}

export function describePaymentError(error) {
  switch (error?.code) {
    case 'not_configured':
      return 'Card payments are not set up in this app yet. Please choose cash on delivery.';
    case 'unsupported':
      return 'Card payments are not supported in this browser. Please choose cash on delivery.';
    default:
      return error?.message || 'The payment could not be completed. Please try again.';
  }
}

export async function presentCardPayment({ clientSecret, name, email }) {
  if (!clientSecret) throw new PaymentError('failed', 'Missing payment details from the server.');
  if (!isStripeConfigured()) throw new PaymentError('not_configured');
  if (!cardElement) throw new PaymentError('failed', 'Please enter your card details.');

  const stripe = await stripePromise;
  if (!stripe) throw new PaymentError('unsupported');

  const result = await stripe.confirmCardPayment(clientSecret, {
    payment_method: {
      card: cardElement,
      billing_details: {
        ...(name ? { name } : {}),
        ...(email ? { email } : {}),
      },
    },
  });
  if (!result.error) return { status: 'succeeded' };
  if (result.error.code === 'payment_intent_authentication_failure') {
    throw new PaymentError('failed', result.error.message);
  }
  if (result.error.type === 'card_error' && result.error.code === 'canceled') {
    return { status: 'canceled' };
  }
  throw new PaymentError('failed', result.error.message);
}

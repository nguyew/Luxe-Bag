import React, { useEffect } from 'react';
import { CardElement, Elements } from '@stripe/react-stripe-js';
import { registerCardElement, stripePromise } from '../services/paymentService';

function CardField() {
  useEffect(() => () => registerCardElement(null), []);

  return (
    <CardElement
      onReady={registerCardElement}
      options={{
        style: {
          base: {
            color: '#1A1A1A',
            fontFamily: 'Arial, sans-serif',
            fontSize: '16px',
            '::placeholder': { color: '#9A948D' },
          },
          invalid: { color: '#B3261E' },
        },
      }}
    />
  );
}

export default function CardPaymentFields() {
  if (!stripePromise) return null;

  return (
    <Elements stripe={stripePromise}>
      <CardField />
    </Elements>
  );
}

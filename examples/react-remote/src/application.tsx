import { defineReactApp, useHostServices } from '@fronts/react';

import './styles.css';

export interface CheckoutProps {
  readonly cartId: string;
}

export interface CheckoutServices {
  readonly navigation: { go(path: string): void };
  readonly telemetry: { emit(name: string, data?: unknown): void };
}

function Checkout({ cartId }: CheckoutProps) {
  const services = useHostServices<CheckoutServices>();
  return (
    <article className="checkout-card">
      <p className="eyebrow">React · Module Federation</p>
      <h2>Cart {cartId}</h2>
      <p>This React tree is owned and updated by the remote application.</p>
      <button
        onClick={() => {
          services.telemetry.emit('checkout.opened', { cartId });
          services.navigation.go(`/checkout/${cartId}`);
        }}
        type="button"
      >
        Open checkout
      </button>
    </article>
  );
}

export default defineReactApp<CheckoutProps, CheckoutServices>({
  capabilities: ['navigation', 'telemetry'],
  name: 'react-checkout',
  root: Checkout,
});

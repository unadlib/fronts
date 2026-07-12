# @fronts/react

React producer and host adapters for the Fronts 2.0 application protocol.

```sh
pnpm add @fronts/core @fronts/react react react-dom
```

## Producer

```tsx
import { defineReactApp, useHostServices } from '@fronts/react';

interface Props {
  readonly cartId: string;
}

interface Services {
  readonly telemetry: { emit(name: string, data?: unknown): void };
}

function Checkout({ cartId }: Props) {
  const services = useHostServices<Services>();
  return (
    <button onClick={() => services.telemetry.emit('checkout.open', { cartId })}>
      Cart {cartId}
    </button>
  );
}

export default defineReactApp<Props, Services>({
  name: 'checkout',
  capabilities: ['telemetry'],
  root: Checkout,
});
```

`defineReactApp()` owns the React root, commit-based readiness, prop updates, context, error
boundary, optional Strict Mode, and unmount. Expose the returned application as a Module
Federation module or load it through another Fronts loader.

## React host

```tsx
import { RemoteApp } from '@fronts/react';

<RemoteApp
  host={host}
  app={{ name: 'checkout', expose: './application' }}
  appProps={{ cartId: 'C-42' }}
  loading={<p>Loading…</p>}
  fallback={(error) => <p>{error.message}</p>}
/>;
```

The package also exports `useRemoteApp()` for headless integration and hooks for application
identity, abort signal, and scoped host services.

This adapter is for applications participating in the Fronts host ABI. If an MF-only React
architecture only needs framework/router integration, evaluate the official
`@module-federation/bridge-react` package first.

Fronts is currently alpha. Protocol and API changes may occur before 2.0 stable.

MIT

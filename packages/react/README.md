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
boundary, optional Strict Mode, and unmount. A render error rejects the current lifecycle operation
and shows the configured fallback; a later update remounts the boundary so a valid render can
recover. Expose the returned application as a Module Federation module or load it through another
Fronts loader.

## React host

```tsx
import { RemoteApp } from '@fronts/react';

<RemoteApp
  host={host}
  app={{ name: 'checkout', expose: './application' }}
  appProps={{ cartId: 'C-42' }}
  loading={<p>Loading…</p>}
  fallback={({ error, retry }) => (
    <p>
      {error.message} <button onClick={retry}>Retry</button>
    </p>
  )}
/>;
```

The package also exports `useRemoteApp()` for headless integration and hooks for application
identity, abort signal, and scoped host services.

`retry()` abandons the failed attempt and mounts again with a new operation identity; it never
resumes a partially failed mount.

The `container` option accepts either a static container request or an async resolver that can
derive the request from the resolved deployment before Fronts selects its loader.

`appProps`, `container`, and `resolve` are compared by value, so re-creating them inline on every
render neither updates nor remounts the application. Pass `arePropsEqual` when props need a
different equality contract.

This adapter is for applications participating in the Fronts host ABI. If an MF-only React
architecture only needs framework/router integration, evaluate the official
`@module-federation/bridge-react` package first.

Fronts is currently alpha. Protocol and API changes may occur before 2.0 stable.

MIT

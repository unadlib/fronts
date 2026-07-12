import { useState } from 'react';

import { RemoteApp } from '@fronts/react';

import { host } from './runtime.js';

const shadowContainer = { mode: 'open', type: 'shadow' } as const;
const iframeContainer = {
  className: 'isolated-frame',
  sandbox: ['allow-same-origin', 'allow-scripts'],
  src: 'http://127.0.0.1:4103',
  targetOrigin: 'http://127.0.0.1:4103',
  title: 'Isolated checkout application',
  type: 'iframe',
} as const;

function Loading() {
  return <p className="status">Resolving, loading and waiting for readiness…</p>;
}

function Failure(error: Error) {
  return <p className="status error">{error.message}</p>;
}

export function App() {
  const [revision, setRevision] = useState(1);

  return (
    <main className="shell">
      <header className="hero">
        <p className="eyebrow">Fronts 2.0 vertical slice</p>
        <h1>One application runtime, three execution models</h1>
        <p>
          The shell resolves deployment policy; Module Federation loads code; Fronts owns lifecycle,
          container and service boundaries.
        </p>
        <button onClick={() => setRevision((value) => value + 1)} type="button">
          Update all props · revision {revision}
        </button>
      </header>

      <section className="grid" aria-label="Remote applications">
        <article className="slot">
          <h2>React remote · DOM</h2>
          <RemoteApp
            app={{ channel: 'stable', name: 'react-checkout' }}
            appProps={{ cartId: `cart-${revision}` }}
            fallback={Failure}
            host={host}
            loading={<Loading />}
            traceId="react-checkout-example"
          />
        </article>

        <article className="slot">
          <h2>Vue 3 remote · Shadow DOM</h2>
          <RemoteApp
            app={{ name: 'vue-account' }}
            appProps={{ accountId: `account-${revision}` }}
            container={shadowContainer}
            fallback={Failure}
            host={host}
            loading={<Loading />}
            traceId="vue-account-example"
          />
        </article>

        <article className="slot">
          <h2>React remote · isolated iframe</h2>
          <RemoteApp
            app={{ name: 'isolated-checkout' }}
            appProps={{ cartId: `isolated-${revision}` }}
            container={iframeContainer}
            fallback={Failure}
            host={host}
            loading={<Loading />}
            traceId="iframe-checkout-example"
          />
        </article>
      </section>
    </main>
  );
}

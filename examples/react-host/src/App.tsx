import { useState } from 'react';

import type { ContainerRequestResolver } from '@fronts/core';
import type { IframeContainerRequest } from '@fronts/core/iframe';
import { RemoteApp, type RemoteFailure } from '@fronts/react';

import { host, type ExampleSource } from './runtime.js';

const shadowContainer = { mode: 'open', type: 'shadow' } as const;
const iframeContainer: ContainerRequestResolver<ExampleSource, IframeContainerRequest> = ({
  resolved,
}) => {
  const frame = resolved.metadata?.frame;
  const src = typeof frame === 'object' && frame !== null ? Reflect.get(frame, 'src') : undefined;
  const targetOrigin =
    typeof frame === 'object' && frame !== null ? Reflect.get(frame, 'targetOrigin') : undefined;
  if (typeof src !== 'string' || typeof targetOrigin !== 'string') {
    throw new Error('The isolated deployment did not provide valid iframe metadata.');
  }
  return {
    className: 'isolated-frame',
    sandbox: ['allow-same-origin', 'allow-scripts'],
    src,
    targetOrigin,
    title: 'Isolated checkout application',
    type: 'iframe',
  };
};

function Loading() {
  return <p className="status">Resolving, loading and waiting for readiness…</p>;
}

function Failure({ error, retry }: RemoteFailure) {
  return (
    <p className="status error">
      {error.message}{' '}
      <button onClick={retry} type="button">
        Retry
      </button>
    </p>
  );
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

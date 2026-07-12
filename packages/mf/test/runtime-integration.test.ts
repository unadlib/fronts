// @vitest-environment node
/// <reference types="node" />

import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

import { createInstance } from '@module-federation/runtime';
import { afterEach, describe, expect, it } from 'vitest';

import {
  createFrontsHost,
  createStaticResolver,
  type ContainerAdapter,
  type ContainerRequest,
} from '@fronts/core';

import { createModuleFederationAdapter, createModuleFederationSource } from '../src/index.js';

interface MemoryContainerRequest extends ContainerRequest {
  readonly type: 'memory';
}

const servers = new Set<ReturnType<typeof createServer>>();

afterEach(async () => {
  await Promise.all(
    [...servers].map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => (error === undefined ? resolve() : reject(error)));
        }),
    ),
  );
  servers.clear();
});

describe('official Module Federation runtime integration', () => {
  it('resolves, loads, validates, mounts, updates and unmounts a remote Fronts app', async () => {
    const remoteEntry = await readFile(
      new URL('./fixtures/remoteEntry.cjs', import.meta.url),
      'utf8',
    );
    const server = createServer((request, response) => {
      if (request.url === '/remoteEntry.cjs') {
        response.writeHead(200, { 'content-type': 'text/javascript' });
        response.end(remoteEntry);
        return;
      }
      response.writeHead(404).end();
    });
    servers.add(server);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address() as AddressInfo;
    const remoteName = `fronts_runtime_fixture_${address.port}`;
    const source = createModuleFederationSource({
      entry: `http://127.0.0.1:${address.port}/remoteEntry.cjs`,
      name: remoteName,
      type: 'global',
    });
    const federation = createInstance({
      name: `fronts_test_host_${address.port}`,
      remotes: [],
    });
    const loader = createModuleFederationAdapter({ instance: federation });
    const resolver = createStaticResolver([
      {
        match: { name: 'runtime-fixture' },
        resolve: { source, version: '2.0.0' },
      },
    ]);
    const memoryElement = { nodeType: 1, parentNode: null } as unknown as Element;
    const memoryContainer: ContainerAdapter<MemoryContainerRequest> = {
      type: 'memory',
      prepare: () => ({
        dispose: () => undefined,
        element: memoryElement,
        target: memoryElement,
        type: 'memory',
      }),
    };
    const host = createFrontsHost({
      containers: [memoryContainer],
      hostId: 'mf-runtime-integration',
      loader,
      resolver,
    });

    try {
      const instance = await host.mount<Record<string, never>, MemoryContainerRequest>({
        container: { type: 'memory' },
        instanceId: 'runtime-fixture',
        props: {},
        ref: { expose: './application', name: 'runtime-fixture' },
        target: memoryElement,
      });

      expect(instance).toMatchObject({
        identity: {
          instanceId: 'runtime-fixture',
          name: 'runtime-fixture',
          version: '2.0.0',
        },
        state: 'ready',
      });
      await instance.update({});
      await instance.unmount();
      expect(host.audit().idle).toBe(true);
    } finally {
      await host.dispose();
    }
  });
});

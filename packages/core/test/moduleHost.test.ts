import { describe, expect, expectTypeOf, it, vi } from 'vitest';

import {
  createModuleHost,
  defineApp,
  frontsErrorCodes,
  type AppModuleMap,
  type AppModuleSource,
  type FrontsError,
  type FrontsHost,
  type HostComposition,
  type ModuleContracts,
} from '../src/index.js';

interface NoticeProps {
  readonly revision: number;
}

interface Services {
  readonly telemetry: { emit(name: string, data?: unknown): void };
}

function createNoticeModule() {
  const events: string[] = [];
  const module = {
    default: defineApp<NoticeProps, Services>({
      capabilities: ['telemetry'],
      name: 'notice',
      mount({ props, services, target }) {
        const element = document.createElement('p');
        element.textContent = `revision ${props.revision}`;
        target.append(element);
        services.telemetry.emit('notice.mounted');
        events.push('mount');
        return {
          update(next) {
            element.textContent = `revision ${next.revision}`;
            events.push('update');
          },
          unmount() {
            element.remove();
            events.push('unmount');
          },
        };
      },
    }),
  };
  return { events, module };
}

function createServices(): { readonly emitted: string[]; readonly services: Services } {
  const emitted: string[] = [];
  return {
    emitted,
    services: {
      telemetry: {
        emit(name) {
          emitted.push(name);
        },
      },
    },
  };
}

function configurationCode(create: () => unknown): string {
  try {
    create();
  } catch (error) {
    return (error as FrontsError).code;
  }
  throw new Error('Expected a configuration error.');
}

describe('createModuleHost', () => {
  it('infers application contracts from the modules themselves', () => {
    const { module } = createNoticeModule();
    const composition = createModuleHost({
      apps: { notice: () => Promise.resolve(module) },
      name: 'shell',
    });

    expectTypeOf(composition.applications.notice.name).toEqualTypeOf<'notice'>();
    expectTypeOf<
      ModuleContracts<{ readonly notice: () => Promise<typeof module> }>['notice']
    >().toEqualTypeOf<NoticeProps>();
    expect(composition.applications).toEqual({
      notice: { expose: './application', name: 'notice' },
    });
    expect(Object.isFrozen(composition)).toBe(true);
    expect(Object.isFrozen(composition.applications)).toBe(true);
  });

  it('produces a composition the framework bindings already accept', () => {
    const { module } = createNoticeModule();
    const composition = createModuleHost<
      { readonly notice: () => Promise<typeof module> },
      Services
    >({
      apps: { notice: () => Promise.resolve(module) },
      name: 'shell',
      services: createServices().services,
    });

    // Assignability is the real contract: this is exactly what createReactBindings() accepts.
    const bound: HostComposition<{ readonly notice: NoticeProps }, AppModuleSource, Services> =
      composition;
    expect(bound.host).toBe(composition.host);
    expectTypeOf(composition.host).toEqualTypeOf<FrontsHost<AppModuleSource, Services>>();
  });

  it('runs the full lifecycle through a module loader', async () => {
    const { events, module } = createNoticeModule();
    const { emitted, services } = createServices();
    const target = document.createElement('div');
    const composition = createModuleHost({
      apps: { notice: () => Promise.resolve(module) },
      name: 'shell',
      services,
    });

    const application = await composition.host.mount<NoticeProps>({
      props: { revision: 1 },
      ref: { name: 'notice' },
      target,
    });
    expect(target.textContent).toBe('revision 1');
    expect(emitted).toEqual(['notice.mounted']);

    await application.update({ revision: 2 });
    expect(target.textContent).toBe('revision 2');

    await application.unmount();
    expect(target.textContent).toBe('');
    expect(events).toEqual(['mount', 'update', 'unmount']);
    composition.host.assertIdle();
    await composition.host.dispose();
  });

  it('carries declared expose, version, and metadata into the resolved deployment', async () => {
    const { module } = createNoticeModule();
    const composition = createModuleHost({
      apps: {
        notice: {
          expose: './notice-application',
          load: () => module,
          metadata: { isolation: 'dom' },
          version: '2.0.0',
        },
      },
      name: 'shell',
      services: createServices().services,
    });

    expect(composition.applications.notice).toEqual({
      expose: './notice-application',
      name: 'notice',
    });

    const resolved = await composition.host.resolve(composition.applications.notice);
    expect(resolved).toEqual({
      metadata: { isolation: 'dom' },
      ref: { expose: './notice-application', name: 'notice' },
      source: { module: 'notice' },
      version: '2.0.0',
    });
    expect(Object.isFrozen(resolved.metadata)).toBe(true);

    // The catalog reference is the contract. A bare name still normalizes to the default expose,
    // so a non-default expose is reachable only through the catalog, exactly as for createMfHost().
    await expect(composition.host.resolve({ name: 'notice' })).rejects.toMatchObject({
      code: frontsErrorCodes.resolutionFailed,
    });
    await composition.host.dispose();
  });

  it('snapshots metadata so later caller mutation cannot reach resolution', async () => {
    const { module } = createNoticeModule();
    const metadata: Record<string, unknown> = { isolation: 'dom' };
    const composition = createModuleHost({
      apps: { notice: { load: () => module, metadata } },
      name: 'shell',
    });

    metadata.isolation = 'iframe';
    const resolved = await composition.host.resolve({ name: 'notice' });
    expect(resolved.metadata).toEqual({ isolation: 'dom' });
    await composition.host.dispose();
  });

  it('warms a module through preload without mounting it', async () => {
    const { events, module } = createNoticeModule();
    const load = vi.fn(() => Promise.resolve(module));
    const composition = createModuleHost({ apps: { notice: load }, name: 'shell' });

    const resolved = await composition.host.preload({ name: 'notice' });
    expect(resolved.source).toEqual({ module: 'notice' });
    expect(load).toHaveBeenCalledTimes(1);
    expect(events).toEqual([]);
    composition.host.assertIdle();
    await composition.host.dispose();
  });

  it('honors cancellation while a module loader is pending', async () => {
    const entered: string[] = [];
    const composition = createModuleHost({
      apps: {
        notice: () => {
          entered.push('notice');
          return new Promise<never>(() => undefined);
        },
      },
      name: 'shell',
    });

    const operations = [
      composition.host.load({ name: 'notice' }),
      composition.host.preload({ name: 'notice' }),
    ];
    await vi.waitFor(() => expect(entered).toHaveLength(2));
    const failures = operations.map(async (operation) => {
      await expect(operation).rejects.toMatchObject({ code: frontsErrorCodes.aborted });
    });

    await composition.host.dispose();
    await Promise.all(failures);
  });

  it('reports a load failure when a module loader rejects', async () => {
    const composition = createModuleHost({
      apps: {
        notice: () => {
          throw new Error('chunk unavailable');
        },
      },
      name: 'shell',
    });

    await expect(
      composition.host.mount({
        props: {},
        ref: { name: 'notice' },
        target: document.createElement('div'),
      }),
    ).rejects.toMatchObject({
      cause: expect.objectContaining({ message: 'chunk unavailable' }),
      code: frontsErrorCodes.loadFailed,
      phase: 'load',
    });
    composition.host.assertIdle();
    await composition.host.dispose();
  });

  it('defaults the host identity to the composition name', async () => {
    const { module } = createNoticeModule();
    const composition = createModuleHost({
      apps: { notice: () => module },
      name: 'shell',
    });

    expect(composition.host.audit().hostId).toBe('shell');
    await composition.host.dispose();
  });

  it('rejects invalid module configuration before creating a host', () => {
    const { module } = createNoticeModule();
    const load = () => module;

    expect(
      configurationCode(() => createModuleHost({ apps: { ' notice': load }, name: 'shell' })),
    ).toBe(frontsErrorCodes.resolutionFailed);
    expect(
      configurationCode(() =>
        createModuleHost({ apps: { notice: 'nope' } as unknown as AppModuleMap, name: 'shell' }),
      ),
    ).toBe(frontsErrorCodes.resolutionFailed);
    expect(
      configurationCode(() =>
        createModuleHost({
          apps: { notice: { load: 'nope' } } as unknown as AppModuleMap,
          name: 'shell',
        }),
      ),
    ).toBe(frontsErrorCodes.resolutionFailed);
    expect(
      configurationCode(() =>
        createModuleHost({ apps: { notice: { load, version: ' 2.0.0' } }, name: 'shell' }),
      ),
    ).toBe(frontsErrorCodes.resolutionFailed);
    expect(
      configurationCode(() =>
        createModuleHost({
          apps: { notice: { load, metadata: 'nope' } } as unknown as AppModuleMap,
          name: 'shell',
        }),
      ),
    ).toBe(frontsErrorCodes.resolutionFailed);
    expect(
      configurationCode(() =>
        createModuleHost({
          apps: { notice: { expose: 1 } } as unknown as AppModuleMap,
          name: 'shell',
        }),
      ),
    ).toBe(frontsErrorCodes.resolutionFailed);
    expect(
      configurationCode(() =>
        createModuleHost({ apps: undefined as unknown as AppModuleMap, name: 'shell' }),
      ),
    ).toBe(frontsErrorCodes.resolutionFailed);
  });

  it('ignores inherited module deployment fields', () => {
    const { module } = createNoticeModule();
    const inherited = Object.create({ version: '9.9.9' }) as { load: () => typeof module };
    inherited.load = () => module;

    expect(
      configurationCode(() => createModuleHost({ apps: { notice: inherited }, name: 'shell' })),
    ).toBe(frontsErrorCodes.resolutionFailed);
  });

  it('rejects an unresolvable application name', async () => {
    const { module } = createNoticeModule();
    const composition = createModuleHost({ apps: { notice: () => module }, name: 'shell' });

    await expect(composition.host.resolve({ name: 'missing' })).rejects.toMatchObject({
      code: frontsErrorCodes.resolutionFailed,
    });
    await composition.host.dispose();
  });
});

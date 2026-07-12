import { defineApp, type FrontsApp, type MountTarget } from '../app/index.js';
import { FrontsError, frontsErrorCodes, throwIfAborted } from '../errors.js';
import type {
  AdaptLegacyFrontsAppOptions,
  LegacyFrontsModule,
  LegacyRender,
  LegacyUnmount,
} from './types.js';

interface LegacyTarget {
  readonly element: HTMLElement;
  readonly owned: boolean;
}

function prepareTarget(target: MountTarget): LegacyTarget {
  const view = target.ownerDocument.defaultView;
  if (view !== null && target instanceof view.HTMLElement) {
    return { element: target, owned: false };
  }

  const element = target.ownerDocument.createElement('div');
  element.dataset.frontsLegacyTarget = '';
  target.append(element);
  return { element, owned: true };
}

function assertLegacyRender<Props>(value: unknown): asserts value is LegacyRender<Props> {
  if (typeof value !== 'function') {
    throw new FrontsError(
      frontsErrorCodes.invalidApp,
      'A Fronts 0.x application must expose a default legacy render function.',
      { phase: 'load' },
    );
  }
}

export function adaptLegacyFrontsApp<Props = unknown, Services extends object = object>(
  render: LegacyRender<Props>,
  options: AdaptLegacyFrontsAppOptions<Services> = {},
): FrontsApp<Props, Services> {
  assertLegacyRender<Props>(render);
  const updateMode = options.updateMode ?? 'remount';

  return defineApp<Props, Services>({
    ...(options.name === undefined ? {} : { name: options.name }),
    ...(options.capabilities === undefined ? {} : { capabilities: options.capabilities }),
    mount(context) {
      throwIfAborted(context.signal, 'mount');
      const target = prepareTarget(context.target);
      let cleanup: LegacyUnmount | undefined;
      let disposed = false;

      const renderProps = (props: Readonly<Props>): void => {
        throwIfAborted(context.signal, 'mount');
        const result = render(target.element, props);
        if (result !== undefined && typeof result !== 'function') {
          throw new FrontsError(
            frontsErrorCodes.invalidApp,
            'A Fronts 0.x render function must return an unmount function or undefined.',
            { phase: 'mount' },
          );
        }
        cleanup = typeof result === 'function' ? result : undefined;
      };

      const clear = async (): Promise<void> => {
        const unmount = cleanup;
        cleanup = undefined;
        await unmount?.();
        target.element.replaceChildren();
      };

      try {
        renderProps(context.props);
      } catch (error) {
        target.element.replaceChildren();
        if (target.owned) {
          target.element.remove();
        }
        throw error;
      }

      return {
        ready: Promise.resolve(),
        async update(props) {
          if (disposed) {
            throw new FrontsError(
              frontsErrorCodes.invalidState,
              `Legacy application "${context.identity.name}" has been unmounted.`,
              { phase: 'update' },
            );
          }
          if (updateMode === 'reject') {
            throw new FrontsError(
              frontsErrorCodes.lifecycleFailed,
              `Legacy application "${context.identity.name}" does not support update().`,
              { phase: 'update' },
            );
          }
          await clear();
          renderProps(props);
        },
        async unmount() {
          if (disposed) {
            return;
          }
          disposed = true;
          try {
            await clear();
          } finally {
            if (target.owned) {
              target.element.remove();
            }
          }
        },
      };
    },
  });
}

export function adaptLegacyFrontsModule<Props = unknown, Services extends object = object>(
  loaded: LegacyFrontsModule<Props> | unknown,
  options: AdaptLegacyFrontsAppOptions<Services> = {},
): FrontsApp<Props, Services> {
  const render =
    typeof loaded === 'object' && loaded !== null && 'default' in loaded
      ? loaded.default
      : undefined;
  assertLegacyRender<Props>(render);
  return adaptLegacyFrontsApp(render, options);
}

import { inject, type InjectionKey } from 'vue';

import type { ApplicationIdentity } from '@fronts/core';

export interface FrontsVueContextValue<Services extends object = object> {
  readonly identity: ApplicationIdentity;
  readonly services: Readonly<Services>;
  readonly signal: AbortSignal;
}

export const FrontsVueContextKey = Symbol.for(
  '@fronts/vue3/context',
) as InjectionKey<FrontsVueContextValue>;

export function useFrontsContext<
  Services extends object = object,
>(): FrontsVueContextValue<Services> {
  const context = inject(FrontsVueContextKey, null);
  if (context === null) {
    throw new Error(
      'Fronts Vue composables must be used inside an application defined by defineVueApp().',
    );
  }
  return context as FrontsVueContextValue<Services>;
}

export function useHostServices<Services extends object = object>(): Readonly<Services> {
  return useFrontsContext<Services>().services;
}

export function useApplicationIdentity(): ApplicationIdentity {
  return useFrontsContext().identity;
}

export function useApplicationAbortSignal(): AbortSignal {
  return useFrontsContext().signal;
}

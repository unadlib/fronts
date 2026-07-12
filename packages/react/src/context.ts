import { createContext, useContext } from 'react';

import type { ApplicationIdentity } from '@fronts/core';

export interface FrontsReactContextValue<Services extends object = object> {
  readonly identity: ApplicationIdentity;
  readonly services: Readonly<Services>;
  readonly signal: AbortSignal;
}

export const FrontsReactContext = createContext<FrontsReactContextValue | null>(null);

export function useFrontsContext<
  Services extends object = object,
>(): FrontsReactContextValue<Services> {
  const context = useContext(FrontsReactContext);
  if (context === null) {
    throw new Error(
      'Fronts React hooks must be used inside an application defined by defineReactApp().',
    );
  }
  return context as FrontsReactContextValue<Services>;
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

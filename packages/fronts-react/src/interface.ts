import { FunctionComponent, ReactElement } from 'react';

export type AppWrapper<T> = FunctionComponent<
  {
    fallback?: ReactElement<any, any> | null;
  } & T
>;

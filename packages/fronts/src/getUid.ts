export const getUid = (name: string) =>
  `fronts-${name}-${Math.random().toString(36).slice(2, -1)}`;

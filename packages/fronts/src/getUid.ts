export const getUid = (name: string) =>
  `${name}-${Math.random().toString(36).slice(2, -1)}`;

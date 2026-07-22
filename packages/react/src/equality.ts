type Comparator = (previous: unknown, next: unknown) => boolean;

function compareOwnKeys(previous: unknown, next: unknown, compare: Comparator): boolean {
  if (Object.is(previous, next)) {
    return true;
  }
  if (
    typeof previous !== 'object' ||
    typeof next !== 'object' ||
    previous === null ||
    next === null ||
    Object.getPrototypeOf(previous) !== Object.getPrototypeOf(next)
  ) {
    return false;
  }

  const previousKeys = Reflect.ownKeys(previous);
  if (previousKeys.length !== Reflect.ownKeys(next).length) {
    return false;
  }

  return previousKeys.every(
    (key) =>
      Object.prototype.hasOwnProperty.call(next, key) &&
      compare(Reflect.get(previous, key), Reflect.get(next, key)),
  );
}

/**
 * Shallow structural comparison used to decide whether a render carries genuinely new input.
 *
 * React re-creates prop objects on every render, so reference identity cannot distinguish "the
 * caller changed this value" from "the caller re-rendered". Own keys are compared with `Object.is`,
 * matching the equality contract callers already expect from `React.memo`.
 */
export function shallowEqual(previous: unknown, next: unknown): boolean {
  return compareOwnKeys(previous, next, Object.is);
}

/**
 * Shallow comparison whose own-key values are themselves compared shallowly.
 *
 * Mount inputs such as a container request or a resolution policy carry one nested record
 * (`attributes`, `metadata`), so a single level of shallow comparison would still treat an inline
 * literal as a new value on every render. Functions compare by reference at every depth.
 */
export function nestedShallowEqual(previous: unknown, next: unknown): boolean {
  return compareOwnKeys(previous, next, shallowEqual);
}

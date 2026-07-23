# Documentation example checker isolation fixture

These paired cases ensure an ambient fixture belongs only to the example that requests it.

<!-- typecheck: services -->

```ts
telemetry.emit('fixture.available');
```

<!-- typecheck: expect-error -->

```ts
telemetry.emit('fixture.must-not-leak');
```

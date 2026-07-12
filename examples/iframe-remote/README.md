# Iframe runtime agent

Runs on `http://127.0.0.1:4103`. It creates its own official Module Federation
runtime instance and accepts only the explicit parent origin
`http://127.0.0.1:4100`. The host sends lifecycle calls and scoped services over
the Fronts iframe RPC protocol.

---
type: operations
title: Fronts Security Policy
description: Vulnerability scope, private reporting requirements, disclosure handling, and security release gates for Fronts.
owner: unadlib/fronts maintainers
status: proposed
tags: [security, vulnerabilities, disclosure]
---

# Security policy

## Reporting a vulnerability

Do not publish vulnerability details in a GitHub issue, discussion, pull request, social post, or
other public channel.

The intended intake channel is GitHub Private Vulnerability Reporting:

1. open the repository's **Security** tab;
2. choose **Report a vulnerability**;
3. submit the impact, reproduction, affected versions, and suggested mitigation privately.

Private Vulnerability Reporting is currently disabled for `unadlib/fronts`. Until a maintainer
enables it, the repository has no verified private technical intake channel. A reporter may open a
public issue containing only “Private security contact requested” and no vulnerability details,
proof of concept, affected URL, secret, or exploit information. Wait for a maintainer to establish a
private channel before sharing technical content.

Enabling GitHub Private Vulnerability Reporting and validating this workflow are release blockers
for the first public Fronts 2.0 package.

## What to include privately

Provide enough information to reproduce and assess the issue without including unrelated user or
tenant data:

- affected Fronts package, version/commit, entry point, and runtime mode;
- Host, producer, browser, framework, MF runtime, and producer plugin versions where relevant;
- security boundary crossed and realistic impact;
- minimal reproduction or proof of concept;
- exact steps, required privileges, and whether user interaction is needed;
- Fronts error code/phase and redacted lifecycle or MF trace;
- whether DOM, iframe origin, capability grant, identity, shared dependency, or package artifact is
  involved;
- any known workaround or remediation idea;
- disclosure constraints or a proposed coordinated-disclosure date.

Never send live credentials, auth tokens, cookies, private keys, production personal data, or
unredacted tenant metadata. Replace them with synthetic values.

## In-scope security boundaries

Reports are in scope when Fronts violates one of its documented security or trust boundaries,
including:

- accepting a forged or unsupported `FrontsApp` or iframe protocol object;
- capability exposure outside the application's declared and Host-authorized service scope;
- use of child-supplied identity or tenant data as trusted authorization context;
- access to a revoked service facade after abort or unmount;
- iframe connection acceptance from a disallowed origin or unexpected parent window;
- wildcard or mismatched iframe target origin accepted by the built-in container;
- escaping the configured iframe capability grant through malformed RPC messages or method names;
- cross-instance lifecycle, service, identity, container, or message-channel confusion;
- unsafe remote/source mutation or registration reuse that crosses a resolved deployment boundary;
- package contents, exports, provenance, or release automation that allow an unintended artifact to
  be distributed as an official Fronts package;
- cleanup behavior that leaves a privileged channel, provider, or application active after the Host
  reports successful unmount.

Security architecture and non-goals are defined in
[Isolation and security](docs/isolation-and-security.md). Production iframe requirements are in
[Iframe deployment](docs/iframe-deployment.md).

## Out of scope

The following are not Fronts vulnerabilities by themselves:

- a vulnerability solely in React, Vue, Module Federation, a bundler, browser, or producer plugin
  when Fronts neither introduces nor bypasses the affected boundary;
- application business logic, server authorization, or service-method validation outside the
  Fronts runtime;
- a deployment that intentionally disables documented CSP, origin, sandbox, TLS, or capability
  requirements;
- a malicious application using an ambient browser permission or service the Host intentionally
  granted;
- denial of service requiring an application already trusted to run arbitrary parent-realm code;
- unsupported deep imports, runtime environments, browser engines, or producer combinations;
- findings that require disclosure of secrets or access to systems the researcher is not authorized
  to test.

An upstream issue may still be reported privately when Fronts can add a meaningful defense, safer
default, detection, or documentation. The report should explain the Fronts-specific impact.

## Supported versions

Fronts 2.0 has not yet been published. Security reports against the current `master` implementation
are welcome, but there is no shipped 2.0 release to patch today.

| Version line             | Security status                                                                              |
| ------------------------ | -------------------------------------------------------------------------------------------- |
| Current unreleased 2.0   | Reports accepted; fixes land on `master`.                                                    |
| Published 2.0 prerelease | None yet. After publication, only the newest `next` prerelease is intended to receive fixes. |
| Stable 2.x               | None yet. A stable maintenance window must be accepted before `latest`.                      |
| Earlier package lines    | Unsupported by this repository policy.                                                       |

The [support policy](docs/support-policy.md) owns runtime and compatibility boundaries. This table
must be updated as part of every release-line or maintenance-policy change.

## Researcher expectations

Researchers must:

- test only systems and data they own or are authorized to assess;
- minimize access, collection, and retention of data;
- stop when a test could affect availability, other users, or production integrity;
- avoid social engineering, physical attacks, credential stuffing, destructive tests, and
  unbounded denial of service;
- keep the report private until the maintainers and reporter coordinate disclosure;
- give maintainers a reasonable opportunity to reproduce, remediate, and publish an advisory.

This policy does not grant access to third-party systems or make a legal safe-harbor promise. Obtain
independent authorization when needed.

## Maintainer response process

Maintainers handling a private report SHOULD:

1. acknowledge it in the private advisory and assign an owner;
2. reproduce against a supported or release-candidate configuration;
3. identify the violated trust boundary and affected package/version range;
4. assess confidentiality, integrity, availability, required privileges, and exploitability;
5. add a regression test that fails before the fix whenever safe and practical;
6. prepare the fix in the private advisory fork or another access-controlled branch;
7. verify package tarballs, lifecycle cleanup, relevant browser E2E, and rollback;
8. coordinate release timing, advisory text, credit, and CVE request when appropriate;
9. publish fixed packages and the advisory together, then update supported-version information;
10. review whether architecture, threat-model, runbook, or deployment guidance must change.

No numeric acknowledgement or remediation SLA is currently committed during prerelease. Maintainers
must define and accept response ownership before the first stable release.

## Disclosure and release

- Do not discuss an unpatched report in public commits or issues.
- Security fixes SHOULD avoid revealing an exploit before fixed artifacts are available.
- A release MUST include a Changeset and clear affected/fixed version information.
- Package provenance and the protected release workflow remain required for emergency releases.
- When a vulnerability affects an upstream project, coordinate with that project's private process
  before public attribution.
- After disclosure, record durable architectural lessons without retaining exploit secrets in normal
  repository documentation.

## Human review required

NEEDS_REVIEW before first publication:

- enable GitHub Private Vulnerability Reporting;
- submit a harmless private test report and confirm maintainers can receive/respond;
- assign the security-response owner and backup;
- decide acknowledgement and remediation targets;
- accept the supported-version and coordinated-disclosure policy;
- confirm whether a separate private security email is required.

## Verification

- Repository setting check:
  `curl https://api.github.com/repos/unadlib/fronts/private-vulnerability-reporting` must return
  `{"enabled":true}` before publication.
- `pnpm exec vitest run packages/core/test/iframe.test.ts packages/core/test/services.test.ts`
  verifies the highest-risk origin, RPC, capability, revocation, and cleanup boundaries.
- `pnpm check` verifies public packages, types, runtime contracts, and required coverage.
- `pnpm test:e2e:preview` verifies built artifacts and cross-origin iframe behavior in Chromium.
- Human review is required for report intake, disclosure timing, severity, affected versions, and
  deployment-specific security headers.

## Related documentation

- [Isolation and security](docs/isolation-and-security.md)
- [Iframe deployment](docs/iframe-deployment.md)
- [Support policy](docs/support-policy.md)
- [Releasing](docs/releasing.md)

# Citations

- [GitHub: configure private vulnerability reporting](https://docs.github.com/en/code-security/how-tos/report-and-fix-vulnerabilities/configure-vulnerability-reporting/configure-for-a-repository)
- [GitHub: privately report a vulnerability](https://docs.github.com/en/code-security/how-tos/report-and-fix-vulnerabilities/report-privately)

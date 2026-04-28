# Security policy

## Reporting a vulnerability

If you believe you have found a security vulnerability in this SDK or in the
Haruspex API, please email **security@haruspex.guru** with the details.

Do **not** open a public GitHub issue for security bugs. We will acknowledge
your report within 2 business days and aim to provide a remediation timeline
within 7 days.

## Scope

In scope:

- This repository (`Haruspex-guru/haruspex-sdk`) and its published packages
  (`@haruspex/sdk`, `haruspex-sdk` on PyPI, `@haruspex/mcp-server`).
- Authentication, request signing, or transport behavior in the SDKs.
- The OpenAPI spec, if it documents an unsafe pattern.

Out of scope:

- The Haruspex API itself — report API-side vulnerabilities to the same
  address but mention that they affect the server.
- Third-party dependencies — please report to the upstream project first.

## Disclosure

We follow a coordinated-disclosure model: once a fix is available we publish
an advisory and credit the reporter (unless they request otherwise).

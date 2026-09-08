# Security Policy

## Secrets
Never commit `.env`, SMTP credentials, JWT secrets, API keys or database credentials. `server/.env` contains names and safe examples only. If a secret has ever been committed or distributed in an archive, removing the file is not sufficient: revoke/rotate the credential at its provider.

## Reporting
Security reports should include affected endpoint/component, reproducible steps, impact and minimal proof. Avoid accessing data that is not required to demonstrate the issue.

## Supported version
Security fixes target the current production branch. Old deployments should be upgraded rather than independently patched.

## Baseline controls
Access tokens are short-lived, refresh tokens rotate and are revocable, and refresh-token replay revokes the full token family. Uploads are decoded/re-encoded, private identity documents are never statically served, security headers are enabled, authentication and abuse-sensitive endpoints are rate limited, and logs must not contain credentials/tokens.


## Disclosure contact
Before public launch, the project owner must publish and actively monitor a private security-reporting address or ticket channel for getsocs.com. Do not invent or document an unmonitored mailbox merely to satisfy this policy.

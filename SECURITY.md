# Security Policy

## Supported Versions

We always recommend using the latest version of ARGUS to ensure you receive all security updates. The following versions are currently supported:

| Version | Supported          |
|---------|--------------------|
| v0.1.x  | ✅ Active support  |
| < 0.1   | ❌ Not supported   |

## Reporting a Vulnerability

If you believe you have found a security vulnerability in ARGUS, please let us know right away. We take all security reports seriously and will acknowledge receipt within 48 hours.

**Do not report vulnerabilities using public GitHub issues.** Instead, email **security@signoz.io** with a detailed account of the issue.

### What to include

- Type of vulnerability
- Steps to reproduce
- Affected versions
- Any potential impact or exploit scenario
- Your contact information for follow-up

### What to expect

1. **Acknowledgment**: We'll confirm receipt within 48 hours
2. **Assessment**: We'll triage and categorize the severity
3. **Fix**: We'll develop and test a fix
4. **Release**: We'll ship a patch and credit you (if desired)
5. **Disclosure**: We'll coordinate public disclosure timing

## Scope

Security issues in the following components are in scope:

- ARGUS Go backend (`pkg/query-service/argus/`)
- ARGUS Python SDK (`argus-sdk/`)
- ARGUS CLI (`cmd/argus-cli/`)
- ARGUS React dashboard (`frontend/`)
- Deployment configurations (`deploy/`, `demo/`)

## Out of Scope

- Upstream dependencies (report to their respective maintainers)
- Theoretical attacks without practical exploit
- Social engineering attacks
- Denial of service without rate limiting

## Thanks

Thank you for helping keep ARGUS and our users safe. 🙇

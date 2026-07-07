# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - 2026-07-07

### Added
- **Company-Specific Rules**: Added support for `.archguardrules` file to inject custom architectural guidelines.
- **ChatOps (Interactive Bot)**: Added support for `issue_comment` trigger. Tag `@archguard-ai` to ask architectural questions.
- **Architecture Drift Detection**: Enhanced core AI checklist to explicitly detect cross-layer dependency leaks.
- **Technical Debt Dashboard**: Added `GET /dashboard/:owner/:repo` endpoint and KV tracking for blocked flaws.

## [1.0.0] - 2026-07-06

### Added
- **Zero-Trust OIDC Integration**: Eliminated the need for user API keys when using the Free Cloudflare Gateway.
- **Asynchronous Queue Processing**: Implemented Cloudflare Queues and worker keep-alive to prevent GitHub Action timeouts.
- **Bring Your Own Key (BYOK) Mode**: Added Option 2 allowing users to use their own OpenAI/DeepSeek keys, completely bypassing the gateway.
- **Automated E2E Test Suite**: Mock Server implementation for automated CI/CD testing of both Gateway and BYOK modes.
- **Application-Level Rate Limiting**: Added KV-based rate limiting (50 PRs/day per repo) to prevent abuse on the public gateway.

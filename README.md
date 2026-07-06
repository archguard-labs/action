# ArchGuard AI

An open-source, enterprise-grade AI Architect Agent for GitHub Actions that automatically audits Pull Requests for clean architecture boundaries, infrastructure decoupling, and critical security flaws before code hits production.

---

## Why ArchGuard AI?

Most automated code reviewers catch syntax errors, linting issues, or formatting style drifts. ArchGuard AI acts as a virtual Senior Software Architect embedded in your CI/CD pipeline, enforcing architectural standards and catching deep design flaws that traditional linters completely miss.

### Key Audit Pillars:
* Architectural Decoupling: Detects infrastructure leakage (e.g., when Controllers, Use Cases, or Domain layers directly invoke Mongoose models, Sequelize definitions, Redis clients, or Axios handlers without a clean abstraction/repository layer).
* Stateless and Enterprise Security: Spots critical architectural vulnerabilities like Mass Assignment (dumping unvalidated client req.body directly into database creation, especially fields like role or permissions), hardcoded secrets, and missing global error handlers.
* 1-Touch Smart Fixes: Generates real-time structural refactoring code blocks directly using GitHub's native markdown suggestion format. You can apply the architectural fix with a single click.

---

## Architecture Overview
ArchGuard AI is designed with an Enterprise-grade Serverless Edge Architecture to ensure zero-maintenance, infinite scalability, and top-tier security. The project is split into two components:
* Client Side (GitHub Action Runner): [archguard-labs/action](https://github.com/archguard-labs/action)
* Server Side (Edge Gateway): [archguard-labs/gateway](https://github.com/archguard-labs/gateway)

```
+------------------------+
|  GitHub Action Runner  | (archguard ai)
+-----------+------------+
            |
            | 1. Signed HTTPS POST Request
            |    (HMAC Payload Verification)
            v
+------------------------+
|   Cloudflare Workers   | (archguard - gateway)
|        Gateway         |
+-----------+------------+
            |
            | 2. Push Background Task (<50ms)
            |    (Async Queue Pipeline)
            v
+------------------------+
|   Cloudflare Queues    | (Message Broker)
+-----------+------------+
            |
            | 3. Pull Task & Trigger Inference
            v
+------------------------+
|  AI Core Engine Pool   | (Llama 3.x / Mistral)
+-----------+------------+
            |
            | 4. POST Review Callback
            |    (Asymmetric Webhook)
            v
+------------------------+
|   GitHub PR Comment    | (Automated Architectural Review)
+------------------------+

```

* Zero-Data Retention Policy: Your source code is analyzed at the edge on serverless infrastructure. No data is cached, stored, or used for model training, satisfying strict banking and fintech security requirements.
* Fault-Tolerant Pipeline: Built with an asynchronous queue network and a dynamic AI model fallback matrix to ensure 100% availability and prevent GitHub runner execution timeouts.

---

## Quick Start (30 Seconds Integration)

To integrate ArchGuard AI into your repository, create a workflow file at `.github/workflows/archguard.yml` with the following configuration:

```yaml
name: ArchGuard AI Architectural Review

on:
  pull_request:
    types: [opened, synchronize]

jobs:
  archguard-review:
    runs-on: ubuntu-latest
    permissions:
      pull-requests: write # Required for ArchGuard to publish PR comments
      contents: read
    steps:
      - name: Run ArchGuard AI Auditor
        uses: archguard-labs/action@main  # Replace @main with @v1.x tags for stable production environments
        with:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Inputs Configuration

| Input Parameter | Description | Required | Default |
| :--- | :--- | :--- | :--- |
| `GITHUB_TOKEN` | Automatically generated repository token to authorize ArchGuard to post structural review comments onto your Pull Requests. | **Yes** | N/A |
| `AGENT_AI_KEY` | (Optional) A custom API key if you want to route the processing payload to your private enterprise AI endpoint instead of our free serverless edge tier. | No | N/A|

## Product Roadmap

You can track our live progress and sprint items directly on our public [Trello Board](https://trello.com/b/QH0sQ7EJ/archguard-ai).

---

## Contributing and Support

Contributions are what make the open-source community such an amazing place to learn, inspire, and create. Any contributions you make are greatly appreciated.

Feel free to fork the repository, open an issue, or submit a Pull Request.

*Maintained by Pau Dang — "Don't let the framework own you. Choose your architecture, build your standards."*

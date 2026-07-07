# ArchGuard AI

An open-source, enterprise-grade AI Architect Agent for GitHub Actions that automatically audits Pull Requests for clean architecture boundaries, infrastructure decoupling, and critical security flaws before code hits production.

---

## Why ArchGuard AI?

Most automated code reviewers catch syntax errors, linting issues, or formatting style drifts. ArchGuard AI acts as a virtual Senior Software Architect embedded in your CI/CD pipeline, enforcing architectural standards and catching deep design flaws that traditional linters completely miss.

### Key Audit Pillars:
* Architectural Decoupling: Detects infrastructure leakage (e.g., when Controllers, Use Cases, or Domain layers directly invoke Mongoose models, Sequelize definitions, Redis clients, or Axios handlers without a clean abstraction/repository layer).
* Stateless and Enterprise Security: Spots critical architectural vulnerabilities like Mass Assignment (dumping unvalidated client req.body directly into database creation, especially fields like role or permissions), hardcoded secrets, and missing global error handlers.
* 1-Touch Smart Fixes: Generates real-time structural refactoring code blocks directly using GitHub's native markdown suggestion format. You can apply the architectural fix with a single click.
* Company-Specific Rules (Custom Context Injection): Automatically detects and enforces your team's unique guidelines by reading a `.archguardrules` file from your repository root.
* ChatOps (Interactive Bot): Tag `@archguard-ai` in a PR comment to ask architectural questions or instruct it to re-review specific files.
* Technical Debt Dashboard: View real-time architectural analytics for your repository via the Cloudflare KV Dashboard endpoint.

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
            | 1. OIDC Authenticated Request
            |    (Zero-Trust JWT Verification)
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

* **Zero-Trust OIDC Authentication**: We use GitHub OpenID Connect (OIDC) to establish a secure, cryptographic identity. No API keys or secrets are required or stored.
* **Zero-Data Retention Policy**: Your source code is analyzed at the edge on stateless serverless infrastructure. No data is cached, stored, logged, or used for model training, satisfying strict banking and fintech security requirements.
* **Fault-Tolerant Pipeline**: Built with an asynchronous queue network and a dynamic AI model fallback matrix to ensure 100% availability and prevent GitHub runner execution timeouts.

---



## Quick Start (30 Seconds Integration)

ArchGuard AI offers two flexible ways to run: **Free Serverless Gateway** (Default) or **Bring Your Own Key (BYOK)**.

### Option 1: Free Serverless Gateway (Default)
To integrate ArchGuard AI into your repository using our free edge AI gateway, create a workflow file at `.github/workflows/archguard.yml` with the following configuration:

```yaml
name: ArchGuard AI Architectural Review

on:
  pull_request:
    types: [opened, synchronize]
  issue_comment:
    types: [created]

jobs:
  archguard-review:
    runs-on: ubuntu-latest
    permissions:
      pull-requests: write # Required for ArchGuard to publish PR comments
      contents: read       # Required to read the PR diff
      id-token: write      # Required for Zero-Trust OIDC Authentication
    steps:
      - name: Run ArchGuard AI Auditor
        uses: archguard-labs/action@main  # Replace @main with @v1.x tags for stable production environments
        with:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          # CUSTOM_PROMPT: "Optional: Reject any PR that uses Vue Mixins or hardcodes SQL queries."
```

### Option 2: Bring Your Own Key (BYOK)
If you prefer complete data privacy or want to use your own LLM limits, you can route the AI processing directly to your own provider (e.g. OpenAI, DeepSeek, or any custom endpoint), completely bypassing our free gateway.

```yaml
name: ArchGuard AI Architectural Review

on:
  pull_request:
    types: [opened, synchronize]
  issue_comment:
    types: [created]

jobs:
  archguard-review:
    runs-on: ubuntu-latest
    permissions:
      pull-requests: write
      contents: read
    steps:
      - name: Run ArchGuard AI Auditor
        uses: archguard-labs/action@main
        with:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          AGENT_AI_KEY: ${{ secrets.OPENAI_API_KEY }} # Triggers BYOK mode
          AI_PROVIDER_URL: "https://api.openai.com/v1/chat/completions" # Optional (Defaults to OpenAI)
          AI_MODEL: "gpt-4o" # Optional (Defaults to gpt-4o)
          # CUSTOM_PROMPT: "Optional: Reject any PR that uses Vue Mixins or hardcodes SQL queries."
```

## How to Use (Features Guide)

Once integrated, ArchGuard AI works automatically in the background. Here is how you can leverage its full power:

### 1. Automated Architecture Review
Simply open a Pull Request. ArchGuard will automatically fetch the Git Diff and audit the code. If it finds architectural flaws (like Tight Coupling or Mass Assignment), it will leave a detailed PR comment with a **1-click suggestion block** to fix the issue.

### 2. Company-Specific Rules
You don't need to configure anything in the workflow file to use custom rules. 
Just create a file named `.archguardrules` at the root of your repository:
```text
1. All models must be in the src/domain folder.
2. Caching logic must use the generic CacheService, never Redis directly.
```
ArchGuard will automatically detect this file and aggressively enforce these rules alongside its core architecture checks.

### 3. ChatOps (Interactive AI Bot)
If you disagree with a review or need more context, you can chat directly with ArchGuard AI. 
Simply reply to the Pull Request and tag the bot:
> `@archguard-ai Can you explain why this is considered tight coupling?`

*Note: You must have `issue_comment: types: [created]` in your workflow triggers for ChatOps to work.*

### 4. Technical Debt Dashboard
ArchGuard Gateway tracks the number of PRs reviewed and the architectural flaws blocked for your repository in real-time.
You can view your repository's Technical Debt Dashboard by visiting:
`https://archguard-gateway.archguard-labs.workers.dev/dashboard/YOUR_ORG/YOUR_REPO`

---

## Inputs Configuration

| Input Parameter | Description | Required | Default |
| :--- | :--- | :--- | :--- |
| `GITHUB_TOKEN` | Automatically generated repository token to authorize ArchGuard to post structural review comments onto your Pull Requests. | **Yes** | `${{ github.token }}` |
| `AGENT_AI_KEY` | (Optional) Your custom API key. If provided, the action switches to BYOK mode and completely bypasses the free serverless gateway. | No | N/A |
| `AI_PROVIDER_URL` | (Optional) The custom AI API endpoint to call. Only used if `AGENT_AI_KEY` is set. | No | `https://api.openai.com/v1/chat/completions` |
| `AI_MODEL` | (Optional) The specific LLM to use for your provider. Only used if `AGENT_AI_KEY` is set. | No | `gpt-4o` |
| `CUSTOM_PROMPT` | (Optional) Inject your own company-specific architectural rules or coding standards directly into the AI's Brain (System Prompt). | No | N/A |

## Product Roadmap

You can track our live progress and sprint items directly on our public [Trello Board](https://trello.com/b/QH0sQ7EJ/archguard-ai).

---

## Contributing and Support

Contributions are what make the open-source community such an amazing place to learn, inspire, and create. Any contributions you make are greatly appreciated.

Feel free to fork the repository, open an issue, or submit a Pull Request.

*Maintained by Pau Dang — "Don't let the framework own you. Choose your architecture, build your standards."*

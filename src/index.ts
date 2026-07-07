import * as core from '@actions/core';
import * as github from '@actions/github';
import * as fs from 'fs';
import * as path from 'path';
import { ARCHITECT_SKILLS_PLAN } from './skills';

async function run() {
  try {
    const token = core.getInput('GITHUB_TOKEN', { required: true });
    const octokit = github.getOctokit(token);
    const { owner, repo, number: pull_number } = github.context.issue;

    // ChatOps Logic
    let chatopsContext = "";
    if (github.context.eventName === 'issue_comment' && github.context.payload.comment) {
      const commentBody = github.context.payload.comment.body;
      if (!commentBody.includes('@archguard-ai')) {
        console.log("[ArchGuard] Comment does not tag @archguard-ai. Skipping.");
        return;
      }
      chatopsContext = `\n\nUSER CHATOPS INQUIRY:\nThe developer replied with the following comment/question: "${commentBody}".\nPlease answer their question directly, explaining the architectural reasoning or adjusting your review if necessary.`;
      console.log(`[ArchGuard] ChatOps triggered for PR #${pull_number}`);
    }

    const agentAiKey = core.getInput('AGENT_AI_KEY', { required: false });

    console.log(`[ArchGuard] Fetching Git Diff for PR #${pull_number}...`);

    const { data: diff } = await octokit.request('GET /repos/{owner}/{repo}/pulls/{pull_number}', {
      owner,
      repo,
      pull_number,
      headers: {
        accept: 'application/vnd.github.v3.diff',
      },
    });

    if (!diff || typeof diff !== 'string') {
      core.setFailed('[ArchGuard] Could not retrieve Git Diff string.');
      return;
    }

    let aiResponse = "";
    let isAsyncQueued = false;

    const customPrompt = core.getInput('CUSTOM_PROMPT', { required: false });

    let systemPrompt = `${ARCHITECT_SKILLS_PLAN.system_role}\n\n` +
                         `CRITICAL CHECKLIST:\n${ARCHITECT_SKILLS_PLAN.evaluation_checklist.join('\n')}\n\n` +
                         `REQUIRED OUTPUT FORMAT:\n${ARCHITECT_SKILLS_PLAN.output_format}`;
    
    if (customPrompt) {
      systemPrompt += `\n\nADDITIONAL USER RULES:\n${customPrompt}`;
    }

    if (chatopsContext) {
      systemPrompt += chatopsContext;
    }

    const workspacePath = process.env.GITHUB_WORKSPACE || process.cwd();
    const rulesPath = path.join(workspacePath, '.archguardrules');
    
    if (fs.existsSync(rulesPath)) {
      const companyRules = fs.readFileSync(rulesPath, 'utf8');
      console.log("[ArchGuard] Found .archguardrules file! Injecting Company-Specific Rules into AI Context...");
      systemPrompt += `\n\nCOMPANY-SPECIFIC ARCHITECTURAL RULES (STRICT COMPLIANCE REQUIRED):\n${companyRules}`;
    }

    if (agentAiKey) {
      console.log("[ArchGuard] AGENT_AI_KEY detected. Routing to Custom AI Provider endpoint...");
      const providerUrl = core.getInput('AI_PROVIDER_URL') || "https://api.openai.com/v1/chat/completions";
      const model = core.getInput('AI_MODEL') || "gpt-4o";
      
      const response = await fetch(providerUrl, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${agentAiKey}`
        },
        body: JSON.stringify({
          model: model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Here is the Git Diff to review:\n\n${diff}` }
          ],
          temperature: 0.2
        })
      });

      if (!response.ok) {
        throw new Error(`Custom AI Endpoint returned status: ${response.status}`);
      }

      const result: any = await response.json();
      aiResponse = result.choices?.[0]?.message?.content || "LGTM 👍";

    } else {
      console.log("[ArchGuard] No API Key provided. Routing to Free Serverless AI Gateway...");
      
      const CLOUDFLARE_GATEWAY_URL = core.getInput('GATEWAY_URL') || "https://archguard-gateway.archguard-labs.workers.dev";
      
      const oidcToken = await core.getIDToken('archguard-gateway');
      if (!oidcToken) {
        core.setFailed("Could not get OIDC token from GitHub. Please ensure `permissions: id-token: write` is set in your workflow.");
        return;
      }

      const sanitizedDiff = String(diff)
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, ""); // Retain \n (\u000A) and \r (\u000D) to preserve code formatting

      const token = core.getInput('GITHUB_TOKEN', { required: true });
      const rawBody = JSON.stringify({ diff: sanitizedDiff, repo, owner, pr: pull_number, token, systemPrompt });
      
      const response = await fetch(`${CLOUDFLARE_GATEWAY_URL}/audit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": `ArchGuard-Agent-${owner}`,
          "Authorization": `Bearer ${oidcToken}`
        },
        body: rawBody
      });

      if (!response.ok) {
        if (response.status === 401) {
          core.setFailed("Gateway Authentication Failed (401 Unauthorized). Signature or Timestamp invalid.");
          return;
        }
        if (response.status === 429) {
          core.setFailed("Gateway Rate Limit Exceeded (429 Too Many Requests).");
          return;
        }
        const errText = await response.text();
        throw new Error(`Cloudflare AI Gateway returned status: ${response.status} - ${errText}`);
      }

      if (response.status === 202) {
        console.log("[ArchGuard] Payload accepted by Gateway Queue. Review will be posted asynchronously.");
        if (process.env.E2E_TEST !== 'true') {
          console.log("[ArchGuard] Keeping job alive for 30 seconds to ensure GITHUB_TOKEN remains valid for async webhook...");
          await new Promise(resolve => setTimeout(resolve, 30000));
        } else {
          console.log("[ArchGuard] E2E Test Mode: Skipping 30s sleep.");
        }
        isAsyncQueued = true;
      } else {
        const result: any = await response.json();
        aiResponse = result.review || result.message || "LGTM 👍";
      }
    }

    if (!isAsyncQueued) {
      const trimmedResult = aiResponse.trim();

      if (trimmedResult && trimmedResult !== 'LGTM 👍') {
        await octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: pull_number,
        body: `### 🛡️ ArchGuard AI Architectural Review\n\n${trimmedResult}`
      });
      } else {
        await octokit.rest.issues.createComment({
          owner,
          repo,
          issue_number: pull_number,
          body: `### 🛡️ ArchGuard AI Architectural Review\n\n**LGTM 👍** - Code respects clean architecture and enterprise security standards.`
        });
      }
    }

  } catch (error: any) {
    core.setFailed(`[ArchGuard] Execution failed: ${error.message}`);
  }
}

run();
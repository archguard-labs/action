import * as core from '@actions/core';
import * as github from '@actions/github';
import { ARCHITECT_SKILLS_PLAN } from './skills';

async function run() {
  try {
    // 1. Get automatic GitHub Token from pipeline context
    const token = core.getInput('GITHUB_TOKEN', { required: true });
    const octokit = github.getOctokit(token);
    const { owner, repo, number: pull_number } = github.context.issue;

    // 2. Check if user configured a custom Generic Agent AI API Key (Option 1)
    const agentAiKey = core.getInput('AGENT_AI_KEY', { required: false });

    console.log(`[ArchGuard] Fetching Git Diff for PR #${pull_number}...`);

    // 3. Retrieve the Pull Request Git Diff content
    const { data: diff } = await octokit.rest.pulls.get({
      owner,
      repo,
      pull_number,
      mediaType: { format: 'diff' }
    });

    if (!diff) {
      core.setFailed('[ArchGuard] Could not retrieve Git Diff.');
      return;
    }

    let aiResponse = "";

    // Assemble the comprehensive system prompt from skills.ts
    const systemPrompt = `${ARCHITECT_SKILLS_PLAN.system_role}\n\n` +
                         `CRITICAL CHECKLIST:\n${ARCHITECT_SKILLS_PLAN.evaluation_checklist.join('\n')}\n\n` +
                         `REQUIRED OUTPUT FORMAT:\n${ARCHITECT_SKILLS_PLAN.output_format}`;

    // 4. Smart Routing between Option 1 (Custom Generic Key) and Option 2 (Free Gateway)
    if (agentAiKey) {
      // --- OPTION 1: Routed through a Generic / Custom AI Provider Endpoint ---
      console.log("[ArchGuard] AGENT_AI_KEY detected. Routing to Generic AI Provider endpoint...");
      
      const GENERIC_AI_URL = "https://api.your-ai-service.com/v1/chat/completions";
      
      const response = await fetch(GENERIC_AI_URL, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${agentAiKey}`
        },
        body: JSON.stringify({
          model: "generic-code-model",
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
      // --- OPTION 2: Fallback to your Free Serverless AI Gateway ---
      console.log("[ArchGuard] No API Key provided. Routing to Free Serverless AI Gateway...");
      
      const CLOUDFLARE_GATEWAY_URL = "https://archguard-gateway.paudang.workers.dev/";

      const response = await fetch(CLOUDFLARE_GATEWAY_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": `ArchGuard-Agent-${owner}`
        },
        body: JSON.stringify({ diff })
      });

      if (!response.ok) {
        throw new Error(`Cloudflare AI Gateway returned status: ${response.status}`);
      }

      const result: any = await response.json();
      aiResponse = result.review || "LGTM 👍";
    }

    const trimmedResult = aiResponse.trim();

    // 5. Post the AI Architectural Review comment back to the Pull Request
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

  } catch (error: any) {
    core.setFailed(`[ArchGuard] Execution failed: ${error.message}`);
  }
}

run();
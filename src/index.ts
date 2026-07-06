import * as core from '@actions/core';
import * as github from '@actions/github';
import * as crypto from 'crypto';
import { ARCHITECT_SKILLS_PLAN } from './skills';

async function run() {
  try {
    const token = core.getInput('GITHUB_TOKEN', { required: true });
    const octokit = github.getOctokit(token);
    const { owner, repo, number: pull_number } = github.context.issue;

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

    const systemPrompt = `${ARCHITECT_SKILLS_PLAN.system_role}\n\n` +
                         `CRITICAL CHECKLIST:\n${ARCHITECT_SKILLS_PLAN.evaluation_checklist.join('\n')}\n\n` +
                         `REQUIRED OUTPUT FORMAT:\n${ARCHITECT_SKILLS_PLAN.output_format}`;

    if (agentAiKey) {
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
      console.log("[ArchGuard] No API Key provided. Routing to Free Serverless AI Gateway...");
      
      const CLOUDFLARE_GATEWAY_URL = core.getInput('GATEWAY_URL') || "https://archguard-gateway.archguard-labs.workers.dev";
      const ARCHGUARD_MASTER_KEY = process.env.ARCHGUARD_MASTER_KEY;

      if (!ARCHGUARD_MASTER_KEY) {
        core.setFailed("Missing ARCHGUARD_MASTER_KEY in environment variables.");
        return;
      }

      // SỬA LỖI TẠI ĐÂY: Làm sạch các ký tự điều khiển ẩn (Control Characters) làm hỏng chuỗi JSON 
      const sanitizedDiff = String(diff)
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, ""); // Giữ lại \n (\u000A) và \r (\u000D) để giữ định dạng dòng code

      const rawBody = JSON.stringify({ diff: sanitizedDiff, repo, pr: pull_number });
      const unixTimestamp = Math.floor(Date.now() / 1000).toString();
      const signingText = rawBody + repo + unixTimestamp;
      
      const signature = crypto.createHmac('sha256', ARCHGUARD_MASTER_KEY)
                              .update(signingText)
                              .digest('hex');

      const response = await fetch(`${CLOUDFLARE_GATEWAY_URL}/audit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": `ArchGuard-Agent-${owner}`,
          "X-ArchGuard-Signature": signature,
          "X-ArchGuard-Timestamp": unixTimestamp
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

      const result: any = await response.json();
      aiResponse = result.review || result.message || "LGTM 👍";
    }

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

  } catch (error: any) {
    core.setFailed(`[ArchGuard] Execution failed: ${error.message}`);
  }
}

run();
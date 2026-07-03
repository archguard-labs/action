import * as core from '@actions/core';
import * as github from '@actions/github';
import { ARCHITECT_SKILLS_PLAN } from './skills';

async function run() {
  try {
    const token = core.getInput('GITHUB_TOKEN', { required: true });
    const octokit = github.getOctokit(token);
    const { owner, repo, number: pull_number } = github.context.issue;

    const agentAiKey = core.getInput('AGENT_AI_KEY', { required: false });

    console.log(`[ArchGuard] Fetching Git Diff for PR #${pull_number}...`);

    // SỬA LỖI TẠI ĐÂY: Gọi API request trực tiếp để ép GitHub trả về kiểu text/plain dữ liệu Diff thuần túy
    const { data: diff } = await octokit.request('GET /repos/{owner}/{repo}/pulls/{pull_number}', {
      owner,
      repo,
      pull_number,
      headers: {
        accept: 'application/vnd.github.v3.diff', // Ép định dạng trả về là chuỗi Diff văn bản
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
      
      // Bỏ dấu gạch chéo cuối cùng để đồng bộ URL endpoint
      const CLOUDFLARE_GATEWAY_URL = "https://archguard-gateway.paudang.workers.dev";

      const response = await fetch(CLOUDFLARE_GATEWAY_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": `ArchGuard-Agent-${owner}`
        },
        body: JSON.stringify({ diff }) // Giờ đây diff đã là chuỗi ký tự String thuần chuẩn đét!
      });

      if (!response.ok) {
        // Thử đọc chi tiết lỗi từ Cloudflare trả về để dễ debug
        const errText = await response.text();
        throw new Error(`Cloudflare AI Gateway returned status: ${response.status} - ${errText}`);
      }

      const result: any = await response.json();
      aiResponse = result.review || "LGTM 👍";
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
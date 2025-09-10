import fs from 'fs';
import path from 'path';
import { Octokit } from '@octokit/rest';
import OpenAI from 'openai';

const GH_REPO = process.env.GITHUB_REPOSITORY!;
const [owner, repo] = GH_REPO.split('/');
const prNumber = Number(process.env.PR_NUMBER);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN! });

function read(p: string) { return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : ''; }

(async () => {
  // pull key artifacts
  const junit = read('playwright-report/junit.xml');
  const summaryHtml = read('playwright-report/index.html');

  // Get PR diff information
  const files = await octokit.pulls.listFiles({ owner, repo, pull_number: prNumber });
  const diffSummary = files.data.slice(0, 30).map((f: any) => ({
    filename: f.filename, 
    status: f.status, 
    patch: (f.patch || '').slice(0, 4000)
  }));

  const prompt = `
You are a senior QA + DX reviewer.
Using the Playwright JUnit, PR diff, and (if needed) HTML summary, write a brief PR review with:
- A numbered list of concrete issues and suggested fixes (file/function hints if possible).
- Tag each item as [blocking], [should], or [nit].
- Call out a11y fails, obvious flaky tests, broken links, console errors, and performance warnings.
- Reference specific files and lines from the PR diff when suggesting fixes.
- Pay attention to a11y counts in console logs to prioritize critical/serious issues.

PR changed files (truncated): ${JSON.stringify(diffSummary).slice(0, 120000)}

JUnit XML (truncate if huge):
${junit.slice(0, 120000)}
(HTML omitted if too big)
  `;

  const resp = await openai.chat.completions.create({
    model: 'gpt-5',
    temperature: 0.2,
    messages: [{ role: 'user', content: prompt }]
  });

  const body = resp.choices[0].message?.content ?? 'AI review could not be generated.';
  await octokit.issues.createComment({ owner, repo, issue_number: prNumber, body });
})();

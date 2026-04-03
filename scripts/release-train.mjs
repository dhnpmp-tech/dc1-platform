#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

const DEFAULT_GATES = ["npm ci --include=dev", "npm run build"];

function fail(message) {
  console.error(message);
  process.exit(1);
}

function run(command, { cwd, allowFailure = false, env } = {}) {
  const result = spawnSync(command, {
    cwd,
    env: { ...process.env, ...env },
    shell: true,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 50,
  });

  const output = `${result.stdout || ""}${result.stderr || ""}`;
  if (result.status !== 0 && !allowFailure) {
    const error = new Error(`Command failed: ${command}`);
    error.output = output;
    error.status = result.status;
    throw error;
  }

  return {
    status: result.status ?? 1,
    output,
  };
}

function parseArgs(argv) {
  const options = {
    base: "origin/main",
    outputDir: "docs/reports/release-train",
    manifest: null,
    branches: [],
    defaultGates: [],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }
    if (arg === "--manifest") {
      options.manifest = next;
      index += 1;
      continue;
    }
    if (arg === "--base") {
      options.base = next;
      index += 1;
      continue;
    }
    if (arg === "--output-dir") {
      options.outputDir = next;
      index += 1;
      continue;
    }
    if (arg === "--branch") {
      options.branches.push({ branch: next });
      index += 1;
      continue;
    }
    if (arg === "--branches") {
      options.branches.push(
        ...next
          .split(",")
          .map((branch) => branch.trim())
          .filter(Boolean)
          .map((branch) => ({ branch }))
      );
      index += 1;
      continue;
    }
    if (arg === "--gate") {
      options.defaultGates.push(next);
      index += 1;
      continue;
    }
    fail(`Unknown argument: ${arg}`);
  }

  return options;
}

function printHelp() {
  console.log(`Usage: npm run release:train -- [options]

Options:
  --manifest <path>     JSON manifest with base, defaultGates, and candidates
  --branch <ref>        Candidate branch/ref to test (repeatable)
  --branches <a,b,c>    Comma-separated candidate refs
  --gate <command>      Extra default gate command (repeatable)
  --base <ref>          Base ref to rebase onto (default: origin/main)
  --output-dir <path>   Directory for markdown/json reports and gate logs

Manifest shape:
{
  "base": "origin/main",
  "defaultGates": ["npm ci --include=dev", "npm run build"],
  "candidates": [
    {
      "branch": "origin/agent/backend-dev/dcp-510-provider-approval-queue",
      "issue": "DCP-516",
      "label": "OpenRouter eligibility fix",
      "notes": "Queued for release via DCP-520",
      "gates": [
        "npm --prefix backend run test:openrouter:compliance",
        "npm --prefix backend run test:openrouter:failover-proof"
      ]
    }
  ]
}`);
}

function sanitize(value) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
}

function timestampId(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, "-");
}

function git(repoRoot, args, allowFailure = false) {
  return run(`git ${args}`, { cwd: repoRoot, allowFailure });
}

async function loadManifest(repoRoot, manifestPath) {
  if (!manifestPath) {
    return {};
  }

  const absolutePath = path.resolve(repoRoot, manifestPath);
  const raw = await fs.readFile(absolutePath, "utf8");
  return JSON.parse(raw);
}

function mergeCandidates(manifestCandidates, cliCandidates) {
  const merged = [];
  if (Array.isArray(manifestCandidates)) {
    merged.push(...manifestCandidates);
  }
  if (Array.isArray(cliCandidates)) {
    merged.push(...cliCandidates);
  }
  return merged;
}

function branchIncludedInBase(repoRoot, branchRef, baseRef) {
  const result = git(
    repoRoot,
    `merge-base --is-ancestor ${shellEscape(branchRef)} ${shellEscape(baseRef)}`,
    true
  );
  return result.status === 0;
}

function shellEscape(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function revParse(repoRoot, ref) {
  return git(repoRoot, `rev-parse ${shellEscape(ref)}`).output.trim();
}

function revListCounts(repoRoot, baseRef, branchRef) {
  const [behind = "0", ahead = "0"] = git(
    repoRoot,
    `rev-list --left-right --count ${shellEscape(baseRef)}...${shellEscape(branchRef)}`
  )
    .output.trim()
    .split(/\s+/);

  return {
    behind: Number.parseInt(behind, 10),
    ahead: Number.parseInt(ahead, 10),
  };
}

function diffFiles(repoRoot, baseRef, branchRef) {
  const output = git(
    repoRoot,
    `diff --name-only ${shellEscape(baseRef)}...${shellEscape(branchRef)}`
  ).output;
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

async function ensureDir(target) {
  await fs.mkdir(target, { recursive: true });
}

async function writeFile(target, content) {
  await ensureDir(path.dirname(target));
  await fs.writeFile(target, content, "utf8");
}

async function evaluateCandidate({
  repoRoot,
  baseRef,
  outputDir,
  runId,
  candidate,
  defaultGates,
}) {
  const branchRef = candidate.branch;
  const safeName = sanitize(branchRef);
  const logsDir = path.join(outputDir, "logs", runId, safeName);
  await ensureDir(logsDir);

  const summary = {
    branch: branchRef,
    issue: candidate.issue || null,
    label: candidate.label || null,
    notes: candidate.notes || null,
    status: "pending",
    durationSeconds: 0,
    aheadBehind: null,
    changedFiles: [],
    branchSha: null,
    gates: [],
    logDir: path.relative(repoRoot, logsDir),
  };

  const startedAt = Date.now();
  const branchLookup = git(repoRoot, `rev-parse --verify ${shellEscape(branchRef)}`, true);

  if (branchLookup.status !== 0) {
    summary.status = "missing";
    summary.failure = `Missing ref: ${branchRef}`;
    summary.durationSeconds = Math.round((Date.now() - startedAt) / 1000);
    return summary;
  }

  summary.branchSha = branchLookup.output.trim();
  summary.aheadBehind = revListCounts(repoRoot, baseRef, branchRef);
  summary.changedFiles = diffFiles(repoRoot, baseRef, branchRef);

  if (branchIncludedInBase(repoRoot, branchRef, baseRef)) {
    summary.status = "stale";
    summary.failure = `Branch tip is already reachable from ${baseRef}`;
    summary.durationSeconds = Math.round((Date.now() - startedAt) / 1000);
    return summary;
  }

  const worktreeRoot = path.join(repoRoot, ".worktrees", "release-train");
  const worktreePath = path.join(worktreeRoot, `${safeName}-${runId}`);
  const tempBranch = `release-train/${safeName}-${runId}`;

  await ensureDir(worktreeRoot);
  git(
    repoRoot,
    `worktree add -b ${shellEscape(tempBranch)} ${shellEscape(worktreePath)} ${shellEscape(branchRef)}`
  );

  try {
    const rebaseResult = run(`git rebase ${shellEscape(baseRef)}`, {
      cwd: worktreePath,
      allowFailure: true,
    });

    const rebaseLog = path.join(logsDir, "00-rebase.log");
    await writeFile(rebaseLog, rebaseResult.output);

    if (rebaseResult.status !== 0) {
      run("git rebase --abort", { cwd: worktreePath, allowFailure: true });
      summary.status = "conflict";
      summary.failure = `Rebase onto ${baseRef} failed`;
      summary.rebaseLog = path.relative(repoRoot, rebaseLog);
      summary.durationSeconds = Math.round((Date.now() - startedAt) / 1000);
      return summary;
    }

    const gateCommands = [...defaultGates, ...(candidate.gates || [])];
    for (let index = 0; index < gateCommands.length; index += 1) {
      const gateCommand = gateCommands[index];
      const gateLog = path.join(logsDir, `${String(index + 1).padStart(2, "0")}-${sanitize(gateCommand)}.log`);
      const gateStartedAt = Date.now();
      const gateResult = run(gateCommand, {
        cwd: worktreePath,
        allowFailure: true,
        env: {
          BACKEND_URL: process.env.BACKEND_URL || "http://76.13.179.86:8083",
        },
      });

      await writeFile(gateLog, gateResult.output);

      const gateSummary = {
        command: gateCommand,
        status: gateResult.status === 0 ? "passed" : "failed",
        durationSeconds: Math.round((Date.now() - gateStartedAt) / 1000),
        log: path.relative(repoRoot, gateLog),
      };
      summary.gates.push(gateSummary);

      if (gateResult.status !== 0) {
        summary.status = "failed_gate";
        summary.failure = `Gate failed: ${gateCommand}`;
        summary.durationSeconds = Math.round((Date.now() - startedAt) / 1000);
        return summary;
      }
    }

    summary.status = "passed";
    summary.durationSeconds = Math.round((Date.now() - startedAt) / 1000);
    return summary;
  } finally {
    git(repoRoot, `worktree remove --force ${shellEscape(worktreePath)}`, true);
    git(repoRoot, `branch -D ${shellEscape(tempBranch)}`, true);
  }
}

function buildMarkdown({ baseRef, baseSha, generatedAt, candidates, hardFailureCount }) {
  const lines = [
    "# Release Train Report",
    "",
    `- Generated at: ${generatedAt}`,
    `- Base ref: \`${baseRef}\``,
    `- Base sha: \`${baseSha}\``,
    `- Candidates: ${candidates.length}`,
    `- Hard failures: ${hardFailureCount}`,
    "",
    "## Candidate Results",
    "",
  ];

  for (const candidate of candidates) {
    const headerBits = [candidate.branch];
    if (candidate.issue) headerBits.push(candidate.issue);
    if (candidate.label) headerBits.push(candidate.label);

    lines.push(`### ${headerBits.join(" | ")}`);
    lines.push("");
    lines.push(`- Status: \`${candidate.status}\``);
    lines.push(`- Duration: ${candidate.durationSeconds}s`);
    if (candidate.branchSha) lines.push(`- Branch sha: \`${candidate.branchSha}\``);
    if (candidate.notes) lines.push(`- Notes: ${candidate.notes}`);
    if (candidate.failure) lines.push(`- Failure: ${candidate.failure}`);
    if (candidate.aheadBehind) {
      lines.push(
        `- Ahead/behind vs ${baseRef}: ahead ${candidate.aheadBehind.ahead}, behind ${candidate.aheadBehind.behind}`
      );
    }
    if (candidate.logDir) lines.push(`- Logs: \`${candidate.logDir}\``);
    if (candidate.rebaseLog) lines.push(`- Rebase log: \`${candidate.rebaseLog}\``);
    if (candidate.changedFiles?.length) {
      lines.push(`- Changed files (${candidate.changedFiles.length}):`);
      for (const file of candidate.changedFiles.slice(0, 12)) {
        lines.push(`  - \`${file}\``);
      }
      if (candidate.changedFiles.length > 12) {
        lines.push(`  - ... ${candidate.changedFiles.length - 12} more`);
      }
    }
    if (candidate.gates?.length) {
      lines.push("- Gates:");
      for (const gate of candidate.gates) {
        lines.push(`  - \`${gate.status}\` ${gate.command} (${gate.durationSeconds}s) -> \`${gate.log}\``);
      }
    }
    lines.push("");
  }

  return `${lines.join("\n")}\n`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const repoRoot = run("git rev-parse --show-toplevel").output.trim();
  const manifest = await loadManifest(repoRoot, options.manifest);
  const candidates = mergeCandidates(manifest.candidates, options.branches);
  const baseRef = manifest.base || options.base;
  const defaultGates = [
    ...(Array.isArray(manifest.defaultGates) ? manifest.defaultGates : DEFAULT_GATES),
    ...options.defaultGates,
  ];

  if (!candidates.length) {
    fail("No candidates supplied. Use --branch/--branches or --manifest.");
  }

  git(repoRoot, `fetch origin ${shellEscape(baseRef.replace(/^origin\//, ""))} --prune`, true);

  const baseSha = revParse(repoRoot, baseRef);
  const generatedAt = new Date().toISOString();
  const runId = timestampId(new Date());
  const outputDir = path.resolve(repoRoot, options.outputDir);
  await ensureDir(outputDir);

  const results = [];
  for (const candidate of candidates) {
    // Keep the train moving even when one candidate conflicts or fails gates.
    results.push(
      await evaluateCandidate({
        repoRoot,
        baseRef,
        outputDir,
        runId,
        candidate,
        defaultGates,
      })
    );
  }

  const hardFailureCount = results.filter((candidate) =>
    ["missing", "conflict", "failed_gate"].includes(candidate.status)
  ).length;

  const report = {
    generatedAt,
    baseRef,
    baseSha,
    defaultGates,
    hardFailureCount,
    candidates: results,
  };

  const jsonPath = path.join(outputDir, `${runId}.json`);
  const markdownPath = path.join(outputDir, `${runId}.md`);
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(markdownPath, buildMarkdown({ ...report, candidates: results }));

  console.log(`Release train report written to ${path.relative(repoRoot, markdownPath)}`);
  console.log(`JSON report written to ${path.relative(repoRoot, jsonPath)}`);

  if (hardFailureCount > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error.message);
  if (error.output) {
    console.error(error.output);
  }
  process.exit(1);
});

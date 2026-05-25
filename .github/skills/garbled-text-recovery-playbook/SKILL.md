---
name: garbled-text-recovery-playbook
description: "Fix mojibake/garbled text (乱码) in build logs, terminal output, and app UI. Use when text appears as ???, ï»¿, Θçæ, σ, µ or replacement chars. Includes post-completion auto testing and code-level fixes when any stage is garbled."
argument-hint: "项目路径与复现场景，例如：hero-pk 终端模式中文乱码"
user-invocable: true
---

# Garbled Text Recovery Playbook

## What This Skill Produces
- A complete anti-garbled workflow that runs automatically after implementation.
- Stage-specific fixes (build/runtime/terminal/frontend delivery) with minimal code changes.
- A final verification report proving Chinese text renders correctly.

## Required Inputs
- Project path.
- Startup command for terminal mode and normal web mode.
- At least 2 known Chinese probe phrases that should appear in output (or enable auto discovery).
- Expected verification URLs (for example API endpoint and web page URL).

## Profile Configuration (Recommended for Cross-Project Reuse)
- Use a profile JSON to avoid hard-coding project-specific settings in script source.
- Key fields:
  - `terminalRunCommand`: terminal probe command.
  - `webRunCommand`: long-running web server command for API/frontend probe stage.
  - `apiProbeUrl`: backend/API probe URL.
  - `frontendProbeUrl`: frontend probe URL.
  - `probePhrases`: optional project keywords.
  - `autoDiscoverProbePhrases`: true/false.
  - `minProbeCount`: minimum required phrase count.
  - `webStartupWaitSeconds`: wait time before API/frontend probing.
  - `buildCommand`: build gate command.
  - `javaToolOptions`: JVM encoding flags.
- Precedence rule: script parameter > profile value > built-in default.

## Hard Constraints
- Must validate the full path: terminal output + backend code/runtime path + frontend page rendering.
- Must not modify source text literals/copywriting in application code.
- Allowed fix scope: encoding configuration, build pipeline, runtime environment, startup scripts, response headers, and non-text implementation fixes.
- If source literals are already garbled in repository content (commonly from third-party/imported code), report only; do not repair text literals.

## When To Use
- Terminal shows mojibake like `???`, `Θ`, `σ`, `µ`, or `�`.
- Maven/Gradle logs contain garbled Chinese.
- API/Web pages return garbled Chinese.
- Text was previously normal but becomes garbled after build, clean, or run commands.

## Procedure
1. Reproduce and classify the stage.
- Stage A: Build/compile phase introduces garbling.
- Stage B: Runtime output is garbled (terminal/JVM process).
- Stage C: Backend/API path encodes/returns garbled text.
- Stage D: Frontend page rendering is garbled.

2. Enforce no-copywriting-change rule.
- Do not rewrite or replace Chinese literals in source files as a remediation strategy.
- If literals are already damaged in repository history, report as upstream/third-party content issue and fix only encoding path first.
- For third-party imported code with garbled literals: generate a report entry with file path, symptom snippet, source origin, and impact scope; do not patch literal content.

3. Add a mandatory post-completion test gate.
- Always run a clean build first.
- Run deterministic smoke checks across all channels:
  - terminal output
  - backend/API response payload
  - frontend page rendering
- If any stage still shows garbling, stop and fix before claiming completion.

4. Apply source/build encoding fixes.
- Ensure source files are read/compiled as UTF-8 (without changing text literals).
- In Maven projects, enforce UTF-8 in `pom.xml`:
  - `project.build.sourceEncoding`
  - `project.reporting.outputEncoding`
  - compiler `encoding`
- Rebuild from clean state to remove stale class artifacts.

5. Apply runtime/terminal encoding fixes.
- Set terminal code page to UTF-8 where applicable.
- Set JVM output/file encoding flags.
- For repeatability, add a project script (for example `run-terminal.ps1`) that configures encoding then starts the app.

6. Apply backend/frontend delivery fixes.
- Validate backend response charset/content-type behavior.
- Validate frontend static files and page rendering path under UTF-8.
- Prefer configuration/header fixes over source text edits.

7. Branching logic for stubborn cases.
- If output is still garbled but source is correct: prioritize terminal and JVM encoding chain.
- If class-version errors appear after encoding changes: run `clean` and rebuild to remove mixed artifacts.
- If API is correct but terminal is garbled: treat as terminal rendering issue, not app data corruption.
- If terminal is correct but UI is garbled: inspect response headers/content type and frontend file encoding.
- If repository source literal itself is garbled: stop literal-fix attempts and switch to report-only mode.

8. Verify and report.
- Show exact commands used.
- Show at least one successful output snippet with readable Chinese.
- List all files changed and why each change was necessary.
- Explicitly state that no source copywriting literals were modified.

9. Run mandatory auto gate after completion.
- Execute a clean build.
- Run terminal-mode probe and verify Chinese phrase visibility.
- Run backend/API probe and verify payload readability.
- Run frontend probe and verify rendered text readability.
- If any probe fails, return to Step 4/5/6 and continue fixing.

## Execution Matrix
1. Terminal garbled, API normal, frontend normal.
- Fix terminal code page and JVM stdout/stderr/file encoding chain.
- Add or update startup script for deterministic UTF-8 initialization.

2. Terminal normal, API garbled.
- Fix backend response charset/content type and runtime encoding configuration.
- Recheck serialization path and response headers.

3. API normal, frontend garbled.
- Fix frontend page encoding path and delivery headers.
- Verify static resource encoding and browser rendering path.

4. Build output garbled or inconsistent after environment change.
- Run clean rebuild to remove stale artifacts.
- Re-verify Java/runtime version consistency before retrying probes.

5. Source literal already garbled.
- Switch to report-only mode.
- Do not patch copywriting literals.
- Record origin and impact in report template.

## Verification Checklist
- Clean build succeeds.
- Known Chinese phrases render correctly in required channels:
  - terminal output
  - backend runtime logs and API payload
  - frontend page rendering
- No `???`, `ï»¿`, `Θ`, `σ`, `µ`, `�` in verification outputs.
- Added/updated startup script reproduces correct encoding without manual tweaking.
- Source text literals/copywriting unchanged.

## Required Deliverables
1. Fix summary grouped by stage: build, runtime, terminal, backend, frontend.
2. Auto gate evidence for all channels:
- terminal proof snippet
- API payload proof snippet
- frontend rendered text proof snippet
3. Changed file list with purpose for each file.
4. Explicit statement: source copywriting literals unchanged.
5. If report-only branch triggered, attach completed report file from [report template](./assets/report-template.md).

## Reusable Resources
- Auto gate script reference: [encoding gate script](./scripts/encoding-gate.ps1)
- Report-only template reference: [report template](./assets/report-template.md)
- Profile template reference: [profile template](./assets/profile-template.json)

## Completion Criteria
- The project passes the post-completion test gate automatically.
- If garbling appears at any phase, this skill continues with code/config fixes until the gate passes.
- Final response includes: root cause, fix summary, proof output, and rerun command.

## Suggested Invocation Prompts
- `/garbled-text-recovery-playbook 这是解决乱码的一个skill，在项目完成后自动做测试，任何阶段出现乱码都要修复`
- `/garbled-text-recovery-playbook hero-pk 终端模式中文乱码，要求自动回归验证`
- `/garbled-text-recovery-playbook 构建日志和控制台都有乱码，给出稳定的一键启动方案`

## Script Usage Examples
1. With profile (recommended):
- `./.github/skills/garbled-text-recovery-playbook/scripts/encoding-gate.ps1 -ProjectPath <repo> -ProfilePath ./.github/skills/garbled-text-recovery-playbook/assets/profile-template.json`

Note:
- If API/frontend probes are enabled, provide `webRunCommand` so the gate can start/stop a probe server automatically.

2. With explicit probe phrases:
- `./.github/skills/garbled-text-recovery-playbook/scripts/encoding-gate.ps1 -ProjectPath <repo> -TerminalRunCommand "..." -ApiProbeUrl "..." -FrontendProbeUrl "..." -ProbePhrases "词1","词2" -AutoDiscoverProbePhrases $false`

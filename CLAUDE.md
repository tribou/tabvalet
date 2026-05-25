*Global rules, command reference, and index to all project context — the only file AI agents need to open first*

# TabValet Context

Welcome to the **TabValet: Pinned Vertical Tabs** Chrome Extension repository. This extension replicates premium pinned/normal divider, drag-to-pin, and navigated `/` separator reset behaviors (reminiscent of the Arc Browser layout) inside a native Google Chrome side panel.

---

## Command Reference

Use these standard commands to test and manage this extension:

| Command | Action |
| --- | --- |
| `npm test` | Runs the Vitest unit testing suite once. |
| `npm run test:watch` | Starts Vitest in interactive watch mode. |
| `npm run test:e2e` | Runs Playwright headful end-to-end integration tests. |
| `npm run test:e2e:ui` | Starts Playwright test runner UI for interactive debugging. |

---

## CRITICAL Rules

> [!IMPORTANT]
> The following rules are absolute and must be followed by all development agents:

1. **Git commits**: Single-line only using `git commit -m "..."`. No multiline messages, no heredoc, no `Co-Authored-By`. Prefer Conventional Commits style (e.g., `feat: ...`, `fix: ...`, `docs: ...`).
2. **Bash syntax checking**: Use `bashcheck` to validate syntax — never use `bash -n`.
3. **After making any changes, run tests**: Always verify changes by running `npm test` and `npm run test:e2e` before concluding.
4. **Bug fixes require TDD tests**: Any bug fix must be preceded by a failing unit or integration test demonstrating the issue. See [docs/TESTING.md](docs/TESTING.md) for full TDD testing policies.
5. **Creating new skills**: If package or workflow skills are needed, use the `superpowers:writing-skills` skill.
6. **Relative links in Markdown**: Always use relative file paths instead of absolute URLs (like `file:///...`) in all Markdown files inside this repository to ensure cross-machine compatibility.

---

## Detailed Context Index

Explore these specialized documents in the `docs/` folder for in-depth guidance:

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) - *What is this system? — components, data flow, DB schema, external APIs, and directory layout*
- [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) - *How do we write code here? — naming conventions, design principles, error handling, reliability strategy, and planned stack*
- [docs/PRODUCT.md](docs/PRODUCT.md) - *What are we building and why? — user story, requirements, success criteria, and business domain context helpful for understanding why features are built the way they are*
- [docs/SECURITY.md](docs/SECURITY.md) - *How do we keep secrets safe? — environment variables, API key policy, and auth posture*
- [docs/TESTING.md](docs/TESTING.md) - *How do we test and fix bugs? — testing requirements, test running instructions, and bug fix policies.*

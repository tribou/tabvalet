*How do we test and fix bugs? — testing requirements, test running instructions, and bug fix policies.*

# Testing Specification & TDD Policies

This document establishes the testing architecture, command references, and mandatory Test-Driven Development (TDD) policies for resolving bugs and developing features in this repository.

---

## 1. Testing Architecture

The codebase implements a **hybrid testing strategy** that balances fast unit tests with high-fidelity, real-browser integration tests.

### 1.1 Fast Unit Testing (Vitest & JSDOM)
- **Files**: Found under [tests/unit/](../tests/unit) (e.g. `url.test.js`, `tab-manager.test.js`).
- **Engine**: **Vitest** configured to run in a `jsdom` sandbox environment.
- **Chrome Mocking**: Uses `jest-chrome` and custom Vitest stubs loaded in [tests/setup.js](../tests/setup.js). This ensures `chrome.*` API calls do not throw undefined reference errors when running inside a Node.js process.
- **Usage**: Testing pure calculations, URL parsing, mapping transitions, and algorithmic states.

### 1.2 End-to-End Integration Testing (Playwright)
- **Files**: Found under [tests/e2e/](../tests/e2e) (e.g., `sidebar.spec.js`, `fixtures.js`).
- **Engine**: **Playwright** driving a real headful instance of Google Chromium.
- **Extension Loading**: Uses custom page/context fixtures ([tests/e2e/fixtures.js](../tests/e2e/fixtures.js)) that inject the unpacked extension folder using standard Chrome flags (`--disable-extensions-except` and `--load-extension`).
- **Usage**: Verifying full-fidelity sidebar interactions, DOM updates, drag-and-drop actions, service worker background event bindings, and session/local storage synchronizations.

---

## 2. Command Reference

| Command | Action | Environment |
| --- | --- | --- |
| `npm test` | Executes the Vitest unit tests once in the console. | Node.js + JSDOM |
| `npm run test:watch` | Starts the Vitest watcher for instant feedback during coding. | Node.js + JSDOM |
| `npm run test:e2e` | Runs Playwright integration tests. | Chromium Headful |
| `npm run test:e2e:ui` | Starts Playwright interactive dashboard with UI inspector. | Chromium Headful |

---

## 3. Strict TDD (Test-Driven Development) Policies

All development agents and contributors MUST adhere to strict Test-Driven Development when resolving issues or building features:

### 3.1 Bug Fix Workflow
1. **Reproduce first**: Identify the reported bug, locate the responsible logic component, and write a failing test (unit test in `tests/unit/` or integration test in `tests/e2e/`) that replicates the bug exactly.
2. **Verify Failure**: Run the test using `npm test` or `npm run test:e2e` and confirm that it fails as expected.
3. **Write the Fix**: Implement the code modifications in the source files (e.g. `src/logic/`, `background.js`, or `sidepanel.js`) to resolve the issue.
4. **Verify Success**: Re-run the tests. Ensure the newly written test passes successfully.
5. **Regression Check**: Run the entire testing suite (`npm test` and `npm run test:e2e`) to guarantee that your fix did not break any existing behavior.

### 3.2 Feature Development Workflow
1. **Specify Behavior**: Write tests declaring the expected inputs and outputs or UI responses for the new feature before writing any application code.
2. **Green-Field Coding**: Create the feature components to satisfy the tests.
3. **Continuous Testing**: Keep `npm run test:watch` running during implementation to ensure your steps are aligned with specifications.
4. **E2E validation**: Validate complex user flows (such as drag-and-drop) via automated E2E tests inside Playwright before finalizing.

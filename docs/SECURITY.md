*How do we keep secrets safe? — environment variables, API key policy, and auth posture*

# Security Posture

This document details the security model, permission scoping, data privacy boundaries, and secrets policy for the **TabValet: Pinned Vertical Tabs** Chrome Extension.

---

## 1. Zero Cloud Footprint & Data Privacy

The extension operates with a strict offline-first policy:
- **100% Local Execution**: All extension resources (HTML, CSS, JavaScript, icons) are packaged locally. The extension does not connect to external servers, cloud services, databases, or third-party telemetry.
- **No Analytics / Telemetry**: No tracking cookies, diagnostic reports, or usage analytics are collected or transmitted.
- **Strict Domain Boundaries**: No remote scripts, stylesheets, or fonts are loaded at runtime. Everything runs within the secure `chrome-extension://` domain.

---

## 2. Storage Lifecycles & Security

State is saved purely within the Google Chrome profile sandbox:

### 2.1 Pinned Tabs Store (`chrome.storage.local`)
- **Use Case**: Persisting the user's bookmarks (Pinned Tabs).
- **Scope**: Access is strictly limited to this extension. Other extensions, websites, or external processes cannot read or modify this data.
- **Lifecycle**: Stored on disk within the Chrome profile folder. It persists across extension updates, system reboots, and browser restarts until the user unpins the tabs or uninstalls the extension.

### 2.2 Session Store (`chrome.storage.session`)
- **Use Case**: Maintaining mapping dictionaries between open tab IDs and pinned tab IDs.
- **Scope**: Kept strictly in-memory.
- **Lifecycle**: Cleared automatically when the browser is fully closed, preventing stale mappings or obsolete tab IDs from leaking into future sessions.

---

## 3. Minimal Permission Model

The extension enforces a strict principle of least privilege, requesting only the specific Chrome APIs needed to operate:

| Permission | Rationale |
| --- | --- |
| `sidePanel` | Allows the extension to host its custom interface inside Chrome's built-in side panel. |
| `storage` | Required to save pinned tabs locally (`chrome.storage.local`) and caches active mappings (`chrome.storage.session`). |
| `tabs` | Required to read URLs, titles, and favicons of open tabs to synchronize the sidebar, switch tab focus, and listen to navigations. |
| `contextMenus` | Standardizes right-click interactions inside the sidebar interface. |

---

## 4. Secrets & Environment Key Policy

Because this is a static, local browser extension running entirely client-side:
- **No Secrets Allowed**: No API keys, database credentials, passwords, or authentication tokens are stored or permitted anywhere in this repository.
- **No Production Secrets**: Do not introduce environment variables or bundler configurations that inject secret keys into the production build.
- **Third-Party Mocks**: If an external API is introduced in the future, it must be mockable in the local development environment (`tests/setup.js`) to prevent exposing real keys.

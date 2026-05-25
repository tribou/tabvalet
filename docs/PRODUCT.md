*What are we building and why? — user story, requirements, success criteria, and business domain context helpful for understanding why features are built the way they are*

# Product Specification

This document defines the business goals, user stories, specific feature requirements, and success criteria for the **Arc Vertical Tabs Sidebar** Chrome Extension.

---

## 1. Product Vision & Problem Statement

Standard web browsers traditionally display tabs horizontally across the top of the window, leading to squeezing, hidden titles, and clutter when many tabs are open. 

While Google Chrome is closing the visual gap by introducing a native **Chrome Vertical Tabs** feature, native vertical tabs still do not persist like bookmarks. The absolute critical feature gap this extension bridges is Arc's signature hybrid model:
- **Persistent Bookmarks as Tabs**: The sidebar holds persistent pinned bookmarks that act as the tab's anchor.
- **Navigating Away**: Users can navigate away from the "saved"/default bookmark URL within that active tab.
- **Quick Reset & Return**: Users can instantly return to the original default URL by clicking the favicon capsule block, or update the default URL via a context menu.

Our product replicates this premium, highly efficient bookmark-navigation hybrid experience directly inside Chrome's side panel using native APIs.

---

## 2. Target User Persona & User Story

* **Persona**: The focused power user, developer, or researcher who works with multiple persistent tools (e.g. GitHub, Slack, Gmail) while spawning dozens of temporary tabs during daily tasks.

### Core User Story:
> "As a browser power user, I want a persistent vertical tab manager inside Chrome's side panel that separates my standard daily tools from temporary pages, so that I can maintain a clean, organized browsing session without visual clutter."

---

## 3. Product Feature Requirements

To deliver a premium "Arc-like" experience, the extension must implement the following key features exactly as specified:

### 3.1 Two-Tiered Tab Structure
- **Upper List (Pinned Tabs)**: Persistent bookmarks saved inside a local database (`chrome.storage.local`). Pinned tabs remain in the sidebar even if their associated browser tabs are closed. Clicking a pinned tab either focuses its active open tab or opens a new tab.
- **Lower List (Temporary Tabs)**: A vertical listing representing the current window's open tabs 1-to-1. Opening a tab in Chrome adds it to the temporary list; closing a temporary tab in the sidebar closes the browser tab.
- **Section Divider**: A borderless, horizontal divider (`.section-divider`) with `margin: 0` that cleanly demarcates the two sections.

### 3.2 Drag-to-Pin Dropzones & Reordering
- Users can drag temporary tabs above the divider to convert them into pinned tabs.
- Users can drag pinned tabs below the divider to unpin them, turning them into standard temporary tabs.
- The sidebar implements zero-margin drop target zones directly touching the horizontal divider to enable effortless, high-precision drag-and-drop operations.
- Pinned tabs support drag-to-reorder, persisting their positions via a custom sorting order in local storage.

### 3.3 Arc "/" Navigation Separation State
- If an open tab mapped to a pinned tab navigates away from its default URL:
  - A `/` separator is rendered in the sidebar row: `[Favicon] / [Navigated Title]`.
  - The favicon is encapsulated in a full-height, flush-left capsule block styled with hover highlights (`rgba(255, 255, 255, 0.08)`).
  - **Favicon Click (Reset)**: Clicking the favicon capsule instantly navigates the browser tab back to its original pinned default URL, clearing the `/` state.
  - **Text/Title Click**: Clicking the navigated text switches browser focus to the tab *without* resetting its URL.

### 3.4 Visually Polished UI (Obsidian Theme)
- **High-End Dark Mode**: Standardizes on rich glassmorphic HSL dark colors (Obsidian backgrounds `#121214` and `#16161a`).
- **Hover Polish**: Tab close ("x") buttons must be 100% invisible by default, only appearing when the user's cursor hovers directly over the specific tab row.
- **Subtle Transitions**: Actions like hovering, dragging, dropping, and active selections must trigger smooth CSS micro-animations.

---

## 4. Success Criteria

We measure the success of the product through three core pillars:

1. **UX Fidelity**: The visual design feels premium, looks unified, and replicates Arc Browser's sidebar behaviors with pixel accuracy.
2. **Sub-second Responsiveness**: Switching tabs, drag-and-drop reordering, and updating the navigated `/` state must happen instantly (<50ms delay) in response to user actions or browser events.
3. **Session Stability**: Mappings between active tabs and pinned bookmarks must never leak or break. Closing, reloading, or crashing the extension must recover stored configurations gracefully without losing pinned tab arrays.

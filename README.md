# AI Blaster

A Chrome extension that lets you send the same query to ChatGPT, Claude, and Gemini simultaneously.

## Features

- Submit queries to multiple AI providers simultaneously

## Tech Stack

- **React 19** - UI framework for side panel and options page
- **TypeScript** - Type-safe development
- **Vite** - Build tool with CRXJS plugin for Chrome extension bundling
- **Vitest** - Testing framework with Testing Library and Puppeteer for E2E

## Architecture

```
src/
├── background/          # Service worker (Manifest v3)
│   ├── query-orchestrator.ts   # Manages parallel query submission
│   ├── tab-manager.ts          # Tracks provider tabs
│   └── message-handler.ts      # Routes extension messages
├── content-scripts/     # Injected into AI provider websites
│   ├── base-adapter.ts         # Abstract provider interface
│   └── providers/              # ChatGPT, Claude, Gemini adapters
├── sidepanel/           # Main UI for query input and responses
├── options/             # User preferences page
└── shared/              # Types, constants, and utilities
```

**Key patterns:**
- Message-based communication between background service worker and content scripts
- Provider adapter pattern abstracts differences between AI provider UIs
- Query orchestrator handles parallel submissions and response collection

## Installation

```bash
npm install
npm run build
```

Then load the `/dist` folder as an unpacked extension in Chrome.

## Development

```bash
npm run dev      # Start dev server
npm run build    # Production build
npm run test     # Run tests
```

## Requirements

You must be logged into each AI provider's website (ChatGPT, Claude, Gemini) for the extension to work with that provider.

# Web Rendering Strategies From Scratch

A from-first-principles implementation of all four major web rendering strategies (SSG, SSR, CSR, and ISR) built with zero frameworks. This project uses only Node.js's built-in http module to showcase the underlying mechanics of modern web rendering without framework magic.

---

## The Core Question

Every rendering strategy answers one fundamental question: **Where and when does HTML get generated?**

```text
                    WHO generates the HTML?
                           │
              ┌────────────┴────────────┐
              │                         │
           SERVER                    BROWSER
              │                         │
            WHEN?                      CSR
              │
    ┌─────────┴──────────┐
    │                    │
BUILD TIME          REQUEST TIME
    │                    │
   SSG                  SSR
    │
    + STALENESS WINDOW?
    │
   ISR
```

---

## Project Architecture

The core architectural insight is a **shared template layer**. One [templates.js](src/templates.js) file serves all four strategies, but the render functions are invoked at different times and contexts.

```text
rendering-strategies/
├── data/
│   └── posts.json          ← Single source of truth
├── dist/                   ← SSG and ISR write pre-built static files here
│   ├── ssg.html
│   └── isr.html
├── client/
│   └── app.js              ← Client-side script for CSR
└── src/
    ├── server.js           ← HTTP server and router
    ├── build.js            ← SSG manual build script
    ├── templates.js        ← SHARED: HTML templates and post list renderers
    ├── isr-cache.js        ← ISR caching states, timers, and revalidation logic
    └── strategies/
        ├── ssg.js          ← SSG request handler (reads static files)
        ├── ssr.js          ← SSR request handler (renders on demand)
        ├── csr.js          ← CSR request handler (serves empty shell)
        └── isr.js          ← ISR request handler (state machine)
```

---

## The Four Strategies in Detail

### 1. Static Site Generation (SSG)

- **Concept:** Generates HTML once at build time. The server acts as a simple file server.
- **Analogy:** Baking bread the night before opening. Customers get pre-baked bread immediately; no cooking is done at request time.
- **Entry Points:**
  - Build Script: [src/build.js](src/build.js)
  - Request Handler: [src/strategies/ssg.js](src/strategies/ssg.js)
  - Pre-generated Output: [dist/ssg.html](dist/ssg.html)

### 2. Server-Side Rendering (SSR)

- **Concept:** Generates HTML dynamically on the server for every incoming request.
- **Analogy:** Made-to-order dishes. Fresh ingredients, cooked on request. High resource utilization but absolute freshness.
- **Entry Point:**
  - Request Handler: [src/strategies/ssr.js](src/strategies/ssr.js)

### 3. Client-Side Rendering (CSR)

- **Concept:** The server responds with a minimal, blank HTML shell containing a script. The browser downloads the script, fetches data from a JSON API, and constructs the DOM elements dynamically.
- **Analogy:** Sending the recipe and ingredients to the customer's house so they cook it themselves.
- **Entry Points:**
  - Request Handler: [src/strategies/csr.js](src/strategies/csr.js)
  - Client-Side Script: [client/app.js](client/app.js)
  - Data Endpoint: `/api/posts`

### 4. Incremental Static Regeneration (ISR)

- **Concept:** Static files are served instantly, but they carry a validity window. Once expired, the request is served stale while triggering a background (asynchronous, non-blocking) rebuild for the next visitor.
- **Analogy:** Keeping baked goods on the counter. Customers get immediate service. If the item is older than the window, the current customer gets the older item, but it triggers a fresh batch to be made immediately for the next customer.
- **Entry Points:**
  - Request Handler: [src/strategies/isr.js](src/strategies/isr.js)
  - Cache State & Revalidation: [src/isr-cache.js](src/isr-cache.js)
  - Cache Output: [dist/isr.html](dist/isr.html)

---

## The Timestamp Trick

To make the differences between strategies visually obvious, every page includes an **"HTML generated at"** timestamp baked directly into the document:

1. **SSG:** The timestamp stays frozen across refreshes until you manually run the build script.
2. **SSR:** The timestamp changes to the exact millisecond on every refresh.
3. **ISR:** The timestamp stays frozen during the revalidation window (e.g., 10 seconds). Refreshing after expiration serves the stale page once, then the next refresh shows the updated timestamp.
4. **CSR:** Displays two timestamps: when the shell was sent by the server, and when the browser fetched and rendered the client data.

---

## Getting Started

You only need Node.js. No npm install, no dependencies.

```bash
# Build SSG + ISR static files, then start the server
node src/build.js && node src/server.js
```

Or run them separately:

```bash
# Generate the static files
node src/build.js

# Start the server
node src/server.js
```

### 3. Open the browser

Visit the following URLs to compare strategies in action:

- **Home:** http://localhost:3000/
- **SSG:** http://localhost:3000/ssg
- **SSR:** http://localhost:3000/ssr
- **CSR:** http://localhost:3000/csr
- **ISR:** http://localhost:3000/isr

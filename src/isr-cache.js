/**
 * isr-cache.js - ISR cache state and revalidation logic
 *
 * Separated from the handler intentionally. The cache state needs to live
 * outside the request/response cycle - it persists across requests, which
 * means it can't live inside the handler function (that gets a fresh scope
 * on every call). Module-level state is the right place for it in Node.js,
 * since modules are singletons within a process.
 *
 * In production Next.js ISR, this state lives in the build output manifest
 * and is managed by the framework's server infrastructure. We're doing
 * the same thing, just with a plain object instead of a manifest file.
 */

const fs = require("fs");
const path = require("path");
const { htmlShell, renderPostList } = require("./templates");

// config

// How long (in ms) before a cached page is considered stale.
// Set to 10 seconds so the behavior is observable during development.
// In production we'd use something like 60_000 (1 min) or 3_600_000 (1 hour).
const REVALIDATION_WINDOW_MS = 10_000;

const DIST_DIR = path.join(__dirname, "../dist");
const CACHE_PATH = path.join(DIST_DIR, "isr.html");

// cache state

// This object is the ISR "runtime state."
// It tracks whether a cached file exists and when it was last generated.
// Because this module is a singleton, this state persists across all requests
// for the lifetime of the server process.
const cache = {
  // When was the cache file last written? null = never written yet.
  lastGeneratedAt: null,

  // Is a revalidation currently running in the background?
  // This flag prevents multiple simultaneous rebuilds if several requests
  // arrive in quick succession after the window expires.
  isRevalidating: false,
};

// Sync cache state from disk on module load
//
// If the server restarts but dist/isr.html already exists from a previous run,
// we read the file's mtime and treat it as the lastGeneratedAt value.
// Without this, every server restart would trigger a cold start even if the
// cache file is perfectly fresh. In production Next.js, this is handled by
// the build manifest - we approximate it with fs.statSync.
// ---------------------------------------------------------------------------
try {
  const stat = fs.statSync(CACHE_PATH);
  cache.lastGeneratedAt = stat.mtimeMs;
  console.log(
    "  [ISR] Existing cache found, last modified:",
    new Date(cache.lastGeneratedAt).toISOString(),
  );
} catch {
  // No cache file exists yet - cold start state. That's fine.
}

// cache operations

/**
 * Checks whether a valid (non-stale) cache file exists.
 *
 * Two conditions must both be true:
 *   1. We have a lastGeneratedAt timestamp (meaning we've built at least once)
 *   2. The time since that build is within the revalidation window
 *
 * Note: we don't check whether the file actually exists on disk here.
 * That's intentional - if the file was deleted manually, the next
 * read attempt will fail gracefully in the handler.
 */
function isCacheValid() {
  if (!cache.lastGeneratedAt) return false;
  const age = Date.now() - cache.lastGeneratedAt;
  return age < REVALIDATION_WINDOW_MS;
}

/**
 * Returns a human-readable cache status for display on the page.
 * Purely for educational visibility - wouldn't exist in production.
 */

function getCacheStatus() {
  if (!cache.lastGeneratedAt) return "no cache";
  const ageMs = Date.now() - cache.lastGeneratedAt;
  const ageSec = (ageMs / 1000).toFixed(1);

  const valid = isCacheValid();

  return valid
    ? `fresh (${ageSec}s old, window: ${REVALIDATION_WINDOW_MS / 1000}s)`
    : `STALE (${ageSec}s old, window: ${REVALIDATION_WINDOW_MS / 1000}s) - revalidation triggered`;
}

/**
 * Generates a fresh HTML file and writes it to dist/isr.html.
 * This is identical to what build.js does for SSG - same data read,
 * same template calls, same file write.
 *
 * The difference is WHEN it's called:
 *   SSG  → called explicitly by you, before the server starts
 *   ISR  → called automatically by the server, triggered by a stale request,
 *           while the previous response is already on its way to the client
 *
 * @returns {Promise<string>} The generated HTML string
 */
async function generateAndCache(posts) {
  const generatedAt = new Date().toISOString();

  // ISR diagnostics panel - makes the caching behavior visible.
  // Shows when this specific HTML was generated and how long until it goes stale.
  // This panel is baked INTO the static file, so it tells you when the file
  // was last regenerated - not when it was served.
  const isrPanel = `
    <div style="
      background: #1e293b;
      border: 1px solid #f59e0b44;
      border-radius: 8px;
      padding: 0.75rem 1rem;
      margin-bottom: 1.5rem;
      font-size: 0.82rem;
      color: #64748b;
    ">
      <span style="color:#f59e0b; font-weight:600;">Cache generated</span>
      at ${generatedAt}
      &nbsp;·&nbsp;
      Revalidation window: <span style="color:#e2e8f0;">${REVALIDATION_WINDOW_MS / 1000}s</span>
      &nbsp;·&nbsp;
      This panel is <em>frozen in the static file</em> - it won't change until the next revalidation.
    </div>
  `;

  const html = htmlShell({
    title: "Blog Posts - ISR",
    body: isrPanel + renderPostList(posts),
    strategy: "ISR",
    generatedAt,
  });

  if (!fs.existsSync(DIST_DIR)) {
    fs.mkdirSync(DIST_DIR, {
      recursive: true,
    });
  }

  // Write to disk - this overwrites the previous cached file
  fs.writeFileSync(CACHE_PATH, html, "utf-8");

  // Update in-memory state
  cache.lastGeneratedAt = Date.now();

  return html;
}

/**
 * Triggers a background revalidation.
 *
 * "Background" means: this function is called AFTER res.end() has fired.
 * The user's response is already sent. We then do the rebuild work
 * asynchronously. The result goes to disk for the NEXT request.
 *
 * This is the core ISR mechanic. If you called this BEFORE res.end(),
 * you'd be blocking the response on the regeneration - that's SSR behavior.
 * The ordering matters enormously.
 */

async function revalidateInBackground(posts) {
  if (cache.isRevalidating) {
    console.log("  [ISR] Revalidation already in progress, skipping.");
    return;
  }

  cache.isRevalidating = true;
  console.log("  [ISR] Background revalidation started...");

  try {
    await generateAndCache(posts);
    console.log(
      "  [ISR] Background revalidation complete. Cache refreshed at",
      new Date().toISOString(),
    );
  } catch (err) {
    console.error("  [ISR] Revalidation failed:", err.message);
  } finally {
    cache.isRevalidating = false;
  }
}

/**
 * Reads the current cached file from disk.
 * Returns the HTML string, or null if no cache file exists yet.
 */
function readCache() {
  try {
    return fs.readFileSync(CACHE_PATH, "utf-8");
  } catch {
    return null;
  }
}

module.exports = {
  isCacheValid,
  getCacheStatus,
  generateAndCache,
  revalidateInBackground,
  readCache,
  REVALIDATION_WINDOW_MS,

  get isRevalidating() {
    return cache.isRevalidating;
  },

  get lastGeneratedAt() {
    return cache.lastGeneratedAt;
  },

  set lastGeneratedAt(val) {
    cache.lastGeneratedAt = val;
  },
};

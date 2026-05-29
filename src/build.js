/**
 * build.js - Build script for SSG and PPR
 *
 * Generates two kinds of output files:
 *
 *   dist/ssg.html       - COMPLETE HTML document (SSG)
 *   dist/ppr-shell.html - COMPLETE HTML document with static layout & resolver (PPR)
 *
 * The difference between those two output types is the central architectural
 * distinction between SSG and PPR:
 *
 *   SSG shell  → complete document, served as-is, connection closes immediately
 *   PPR shell  → complete document, streamed first, connection stays open
 *                while dynamic data fetches in parallel. The stream finishes
 *                by appending a dynamic chunk (an inline script that swaps the
 *                placeholder content) after the closing tags.
 *
 * Both are pre-built from the same data source at the same build time.
 * Both are served from disk at request time with no per-request rendering.
 * Unlike older hacks that used a half-open document, our PPR shell is a complete,
 * valid HTML document that defines the window.__pprResolve contract.
 */

const fs = require("fs");
const path = require("path");
const { htmlShell, renderPostList, buildPPRShell } = require("./templates");

const DATA_PATH = path.join(__dirname, "../data/posts.json");
const DIST_DIR = path.join(__dirname, "../dist");
const SSG_OUT_PATH = path.join(DIST_DIR, "ssg.html");
const PPR_SHELL_PATH = path.join(DIST_DIR, "ppr-shell.html");

function build() {
  console.log("Building...\n");

  if (!fs.existsSync(DIST_DIR)) {
    fs.mkdirSync(DIST_DIR, { recursive: true });
  }

  // Read data once - shared by both SSG and PPR builds.
  // This is the only data read in the entire build process.
  console.log("  [1/4] Reading posts from", DATA_PATH);
  const posts = JSON.parse(fs.readFileSync(DATA_PATH, "utf-8"));
  console.log(`        Found ${posts.length} posts.`);

  const builtAt = new Date().toISOString();

  // SSG build
  // renderPostList() is a pure function - same input, same output, every time.
  // We stamp the exact time the HTML was generated. This timestamp will be
  // FROZEN in the output file until you run the build script again.
  // When you later compare this to SSR (where the timestamp changes on every
  // refresh), the staleness tradeoff of SSG becomes immediately visible.
  console.log("  [2/4] Building SSG page (complete document)...");
  const ssgHtml = htmlShell({
    title: "Blog Posts - SSG",
    body: renderPostList(posts),
    strategy: "SSG",
    generatedAt: builtAt,
  });
  fs.writeFileSync(SSG_OUT_PATH, ssgHtml, "utf-8");
  console.log(`        Written to ${SSG_OUT_PATH} (${ssgHtml.length} chars)`);

  // PPR shell build
  // Produces a COMPLETE, valid HTML document containing the static parts
  // of the page, a placeholder skeleton for the dynamic widget, and a
  // registration script for window.__pprResolve.
  // Can be opened standalone in a browser and render correctly.
  console.log(
    "  [3/4] Building PPR static shell (complete HTML + resolver function)...",
  );
  const pprShell = buildPPRShell(posts, builtAt);
  fs.writeFileSync(PPR_SHELL_PATH, pprShell, "utf-8");
  console.log(
    `        Written to ${PPR_SHELL_PATH} (${pprShell.length} chars)`,
  );

  const ssgEndsCorrectly = ssgHtml.trimEnd().endsWith("</html>");
  const pprIsComplete = pprShell.includes("</html>");
  console.log("\n  [4/4] Verifying outputs:");
  console.log(`        ssg.html ends with </html>:       ${ssgEndsCorrectly}`);
  console.log(`        ppr-shell.html is complete HTML:  ${pprIsComplete}`);

  console.log("\n  Build complete!");
  console.log(`  Built at: ${builtAt}`);
  console.log(`  SSG:      ${SSG_OUT_PATH}`);
  console.log(`  PPR shell: ${PPR_SHELL_PATH}`);
  console.log("\n  Start the server and visit:");
  console.log("    http://localhost:3000/ssg  ← full pre-built page");
  console.log(
    "    http://localhost:3000/ppr  ← pre-built shell + live dynamic chunk\n",
  );
}

build();

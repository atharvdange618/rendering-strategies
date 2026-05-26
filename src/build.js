/**
 * build.js - Static Site Generator
 *
 * This script is the ENTIRE SSG implementation. Run it manually:
 *   node src/build.js
 *
 * What it does:
 *   1. Reads posts.json (your data source)
 *   2. Calls renderPostList() to turn that data into an HTML string
 *   3. Wraps it in the full HTML shell
 *   4. Writes the result to dist/ssg.html
 *
 * After this script finishes, dist/ssg.html is a complete, self-contained
 * HTML file. The server doesn't need Node.js, templates, or data to serve it.
 * It could literally be hosted on a USB stick.
 *
 * KEY INSIGHT: Notice what this script does NOT do.
 * It does not start a server. It does not listen for requests. It has no
 * concept of "when a user visits". It runs, does its work, and exits.
 * That's the defining characteristic of SSG - it's a build-time process,
 * completely decoupled from the request-response cycle.
 *
 * In the real world, this script would be triggered by your CI/CD pipeline
 * (GitHub Actions, Vercel's build step, Netlify's build command) every time
 * you push new code or new content. The output files go to a CDN.
 */

const fs = require("fs");
const path = require("path");
const { htmlShell, renderPostList } = require("./templates");

const DATA_PATH = path.join(__dirname, "../data/posts.json");
const DIST_DIR = path.join(__dirname, "../dist");
const OUT_PATH = path.join(DIST_DIR, "ssg.html");

function build() {
  console.log("Building static site...\n");

  // Step 1: Read the data.
  //
  // This is the ONLY time data is read in the SSG flow. Compare this to SSR,
  // where you'll see the exact same fs.readFileSync call - but inside the
  // request handler, meaning it runs on every single request.
  // Same code, completely different timing. That difference is everything.
  console.log("  [1/3] Reading posts from", DATA_PATH);
  const posts = JSON.parse(fs.readFileSync(DATA_PATH, "utf-8"));
  console.log(`        Found ${posts.length} posts.`);

  // Step 2: Render the HTML.
  //
  // renderPostList() is a pure function - same input, same output, every time.
  // We stamp the exact time the HTML was generated. This timestamp will be
  // FROZEN in the output file until you run the build script again.
  // When you later compare this to SSR (where the timestamp changes on every
  // refresh), the staleness tradeoff of SSG becomes immediately visible.
  const generatedAt = new Date().toISOString();

  console.log("  [2/3] Rendering HTML...");
  const html = htmlShell({
    title: "Blog Posts - SSG",
    body: renderPostList(posts),
    strategy: "SSG",
    generatedAt,
  });
  console.log(`        HTML length: ${html.length} characters.`);

  // Step 3: Write to disk.
  //
  // We ensure the /dist directory exists first. In a larger SSG setup,
  // this is where you'd write dozens or hundreds of files - one per page,
  // one per blog post, one per category, etc. Frameworks like Next.js
  // (with `output: 'export'`) do exactly this during `next build`.
  console.log("  [3/3] Writing to", OUT_PATH);
  if (!fs.existsSync(DIST_DIR)) {
    fs.mkdirSync(DIST_DIR, { recursive: true });
  }
  fs.writeFileSync(OUT_PATH, html, "utf-8");

  console.log("\n  Build complete!");
  console.log(`  Output: ${OUT_PATH}`);
  console.log(`  Generated at: ${generatedAt}`);
  console.log(
    "\n  Start the server (node src/server.js) and visit http://localhost:3000/ssg\n",
  );
}

build();

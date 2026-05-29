/**
 * ppr.js - Partial Pre-Rendering
 *
 * Previous versions had two problems:
 *   v1: Generated the shell per-request (just SSR + streaming, not truly pre-built)
 *   v2: Used an intentionally incomplete HTML document (half-open, no </html>)
 *
 * This version:
 *   - Reads a COMPLETE, valid pre-built HTML document from disk (chunk 1)
 *   - Streams it immediately so the browser starts rendering
 *   - Does async work in parallel
 *   - Streams a small inline <script> after </html> (chunk 2)
 *   - That script fills in the placeholder with real content
 *
 * The trick: browsers execute inline <script> tags that appear AFTER </html>.
 * They parse the entire HTTP response stream progressively, regardless of
 * document structure. This is intentional, spec-compliant browser behavior.
 * React's streaming SSR uses this exact mechanism - it injects <script> tags
 * with $RC() calls (its internal content replacer) after the closing tags.
 *
 * A key detail worth noting: instead of <script src="file.js">
 * (which would fire a NEW HTTP request, separate from the current stream), we use
 * inline <script>code</script> which is read directly from the current stream.
 * One connection, two delivery moments, complete valid HTML.
 */

const fs = require("fs");
const path = require("path");
const { htmlShell, buildPPRDynamicChunk } = require("../templates");

const PPR_SHELL_PATH = path.join(__dirname, "../../dist/ppr-shell.html");

// Simulate async DB call
function fetchTrendingData() {
  return new Promise((resolve) => {
    // Increased delay from 150ms to 2000ms (2 seconds) to make the PPR chunking gap 
    // visually obvious in the browser during demonstrations.
    setTimeout(() => {
      resolve({
        title: "Building an OIDC Provider from Scratch",
        views: 1432,
        trend: "+38% this week",
      });
    }, 2000);
  });
}

module.exports = async function handlePPR(req, res) {
  // Read the pre-built shell from disk.
  // This is the same operation SSG's handler does - no template logic,
  // no data fetching, just a file read. The difference is what happens next.

  let shellHtml;
  try {
    shellHtml = fs.readFileSync(PPR_SHELL_PATH, "utf-8");
  } catch (error) {
    // Shell hasn't been built yet - same pattern as SSG's missing-build error
    const errorHtml = htmlShell({
      title: "PPR - Build Required",
      body: `
        <h1>Build not found</h1>
        <p style="color:#94a3b8; margin-bottom:1.5rem;">
          The PPR static shell doesn't exist yet. Run the build script first.
        </p>
        <pre style="background:#0f172a; border:1px solid #334155; border-radius:8px;
                    padding:1rem; color:#818cf8; font-size:0.9rem;">node src/build.js</pre>`,
      strategy: "PPR",
      generatedAt: new Date().toISOString(),
    });
    res.writeHead(404, {
      "Content-Type": "text/html",
    });
    res.end(errorHtml);
    return;
  }

  res.writeHead(200, {
    "Content-Type": "text/html",
    "Transfer-Encoding": "chunked",
    "X-Accel-Buffering": "no",
    "Cache-Control": "no-cache",
  });

  // CHUNK 1: The complete, pre-built HTML document.
  // This is a valid, self-contained document - it has </body></html>.
  // It contains the skeleton placeholder and a global resolver function
  // that chunk 2's inline script will call.
  // The browser starts rendering this immediately while we do async work.
  res.write(shellHtml);

  // Fetch the dynamic data. This runs WHILE the browser renders the shell.
  // In a real app: DB query or external API call etc.
  const trending = await fetchTrendingData();
  const fetchedAt = new Date().toISOString();

  // CHUNK 2: Stream the dynamic closing chunk.
  // This contains the resolved trending widget, the swap script, and the
  // </body></html> that completes the open document.

  res.end(buildPPRDynamicChunk(trending, fetchedAt));
};

/**
 * ppr.js - Partial Pre-Rendering
 *
 * Previous versions had three problems:
 *   v1: Generated the shell per-request (just SSR + streaming, not truly pre-built)
 *   v2: Stored an incomplete HTML document on disk (no </body></html>)
 *   v3: Streamed the resolver script AFTER </html>. Browsers run it, but the
 *       HTML spec treats content after </html> as a parse error that it
 *       recovers from. The file was valid; the response was not.
 *
 * This version:
 *   - Reads a COMPLETE, valid pre-built HTML document from disk
 *   - Streams everything up to </body> immediately (chunk 1)
 *   - Does async work while the browser renders that
 *   - Streams a small inline <script> that fills the placeholder (chunk 2)
 *   - Closes with the held-back </body></html>
 *
 * The file on disk stays a real document, and so does the response.
 * React does the same: it holds back the closing tags until every Suspense
 * boundary has resolved, and Next.js moves the "</body></html>" suffix to the
 * end of the stream.
 *
 * Chunk 2 is an inline <script>code</script>, not <script src="file.js">.
 * src= would fire a NEW HTTP request; inline code is read from this stream.
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

  // Split the shell at </body>. Everything before it goes out now; the
  // closing tags wait until the dynamic chunk has been written.
  const splitAt = shellHtml.lastIndexOf("</body>");

  // CHUNK 1: The pre-built document, minus its closing tags.
  // It contains the skeleton placeholder and the window.__pprResolve function
  // that chunk 2 calls. The browser starts rendering this immediately.
  res.write(shellHtml.slice(0, splitAt));

  // Fetch the dynamic data. This runs WHILE the browser renders the shell.
  // In a real app: DB query or external API call etc.
  const trending = await fetchTrendingData();
  const fetchedAt = new Date().toISOString();

  // CHUNK 2: The inline resolver script, still inside <body>.
  res.write(buildPPRDynamicChunk(trending, fetchedAt));

  // Close the document.
  res.end(shellHtml.slice(splitAt));
};

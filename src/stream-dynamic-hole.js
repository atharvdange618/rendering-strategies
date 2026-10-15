/**
 * stream-dynamic-hole.js - The two-chunk response shared by PPR and streaming SSR.
 *
 * Both strategies send the exact same bytes in the exact same order:
 *
 *   1. The shell, up to </body>        (chunk 1, sent immediately)
 *   2. An inline resolver <script>     (chunk 2, after the async fetch)
 *   3. The held-back </body></html>
 *
 * The ONLY difference between the two is where shellHtml comes from:
 *
 *   PPR            → read from disk, pre-built at build time
 *   Streaming SSR  → rendered by the handler, on every request
 *
 * Same delivery, different origin for the first chunk.
 */

const { buildPPRDynamicChunk } = require("./templates");
const trendingSource = require("./trending");

async function streamWithDynamicHole(res, shellHtml) {
  res.writeHead(200, {
    "Content-Type": "text/html",
    "Transfer-Encoding": "chunked",
    "X-Accel-Buffering": "no",
    "Cache-Control": "no-cache",
  });

  // Split the shell at </body>. Everything before it goes out now; the
  // closing tags wait until the dynamic chunk has been written.
  const splitAt = shellHtml.lastIndexOf("</body>");

  // CHUNK 1: The shell, minus its closing tags.
  // It contains the skeleton placeholder and the window.__pprResolve function
  // that chunk 2 calls. The browser starts rendering this immediately.
  res.write(shellHtml.slice(0, splitAt));

  // Fetch the dynamic data. This runs WHILE the browser renders the shell.
  // In a real app: DB query or external API call etc.
  // If it fails, the hole still needs filling and the stream still needs
  // closing. Otherwise the skeleton shimmers forever on an open connection.
  let trending = null;
  try {
    trending = await trendingSource.fetchTrendingData();
  } catch (err) {
    console.error("  [stream] Trending fetch failed:", err.message);
  }
  const fetchedAt = new Date().toISOString();

  // CHUNK 2: The inline resolver script, still inside <body>.
  res.write(buildPPRDynamicChunk(trending, fetchedAt));

  // Close the document.
  res.end(shellHtml.slice(splitAt));
}

module.exports = streamWithDynamicHole;

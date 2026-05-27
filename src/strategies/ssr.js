/**
 * ssr.js - Server-Side Rendering handler
 *
 * Compare this file to build.js (the SSG build script) side by side.
 * The rendering logic is almost identical - read data, call renderPostList(),
 * call htmlShell(). The critical difference is WHEN this code runs.
 *
 * In build.js:  runs once, when YOU decide to run it, before any user arrives.
 * Here:         runs on EVERY incoming request, triggered by the user's browser.
 *
 * That single difference in timing is the entire SSG vs SSR tradeoff:
 *
 *   SSG → fast response (file read), stale data possible, no server compute per request
 *   SSR → slightly slower response (compute per request), always fresh data, server under load
 *
 * To feel this contrast directly: run the server, open /ssg and /ssr side by side,
 * then keep refreshing both. The SSG timestamp is frozen. The SSR timestamp
 * updates on every single refresh because this function re-runs each time.
 */

const fs = require("fs");
const path = require("path");
const { htmlShell, renderPostList } = require("../templates");

// We read the data file path but NOT the file itself at module load time.
// In a real SSR app, this would be a database query inside the handler.
// We simulate that by reading the file on each request.
const DATA_PATH = path.join(__dirname, "../../data/posts.json");

module.exports = function handleSSR(req, res) {
  // Read data fresh on every request.
  //
  // For a JSON file this is fast, but imagine this was:
  //   const posts = await db.query("SELECT * FROM posts");
  // That's exactly what SSR does in production - hit the DB, get fresh data,
  // render HTML, send it. Every. Single. Request.
  //
  // This is why SSR servers need to be sized for traffic. If 10,000 users
  // hit your SSG site simultaneously, your server barely notices - it's just
  // reading pre-built files. If 10,000 users hit your SSR server simultaneously,
  // each one triggers a DB query and a render cycle.
  const posts = JSON.parse(fs.readFileSync(DATA_PATH, "utf-8"));

  // Stamp the current time. This is what makes SSR's behavior visible -
  // every response carries the exact moment it was generated.
  // Refresh the page and watch this change. That's SSR.
  const generatedAt = new Date().toISOString();

  // Same template functions as SSG. Exact same call signature.
  // The templates don't know or care whether they're being called from
  // a build script or a request handler. Pure functions are like that.
  const html = htmlShell({
    title: "Blog Posts - SSR",
    body: renderPostList(posts),
    strategy: "SSR",
    generatedAt,
  });

  // Send the freshly-generated HTML directly. No disk involved.
  // The HTML was born in memory and goes straight to the network.
  res.writeHead(200, {
    "Content-Type": "text/html",
    // Unlike SSG, we tell the browser not to cache this response.
    // The whole point of SSR is freshness - caching would defeat that.
    "Cache-Control": "no-cache, no-store, must-revalidate",
  });
  res.end(html);
};

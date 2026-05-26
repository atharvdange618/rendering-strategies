/**
 * ssg.js - Static Site Generation handler
 *
 * This is the server-side half of SSG. And notice how little it does.
 * It doesn't know about posts. It doesn't call any template functions.
 * It doesn't touch posts.json. It just reads a file and sends it.
 *
 * The HTML was already built by src/build.js. This handler's only job
 * is to find that file and stream it to the client.
 *
 * This is why SSG servers can be so fast - and why you can serve SSG
 * output from a CDN with no application server at all. The "server" for
 * a fully static site is just a file system. Netlify Drop, GitHub Pages,
 * S3 + CloudFront - they all work on this exact principle.
 */
const fs = require("fs");
const path = require("path");
const { htmlShell } = require("../templates");

const DIST_PATH = path.join(__dirname, "../../dist/ssg.html");

module.exports = function handleSSG(req, res, posts) {
  // Try to read the pre-built file.
  fs.readFile(DIST_PATH, "utf-8", (err, html) => {
    if (err) {
      // The build hasn't been run yet. Rather than crash, give the developer
      // a clear, actionable error message. Good DX matters even in toy projects.
      const errorBody = `
        <h1>Build not found</h1>
        <p style="color:#94a3b8; margin-bottom:1.5rem;">
          The static file doesn't exist yet. You need to run the build script first.
        </p>
        <pre style="
          background:#0f172a;
          border:1px solid #334155;
          border-radius:8px;
          padding:1rem;
          color:#4ade80;
          font-size:0.9rem;
        ">node src/build.js</pre>
        <p style="color:#64748b; margin-top:1rem; font-size:0.85rem;">
          After the build completes, refresh this page.
        </p>`;

      const errorHtml = htmlShell({
        title: "SSG - Build Required",
        body: errorBody,
        strategy: "SSG",
        generatedAt: new Date().toISOString(),
      });

      res.writeHead(404, { "Content-Type": "text/html" });
      res.end(errorHtml);
      return;
    }

    // File exists - serve it directly.
    // Notice we do NOT set a new generatedAt here. The timestamp embedded
    // in this HTML is the one from when build.js ran. That's the whole point.
    res.writeHead(200, {
      "Content-Type": "text/html",
      // In production, you'd add aggressive cache headers here since the
      // content won't change until the next build. Something like:
      // "Cache-Control": "public, max-age=31536000, immutable"
      // We skip it here so the browser always fetches fresh during development.
      "Cache-Control": "no-cache",
    });
    res.end(html);
  });
};

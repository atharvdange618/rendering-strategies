/**
 * server.js - Main HTTP server
 *
 * Route map:
 *   GET /           → Home page (plain SSR, just for navigation)
 *   GET /ssg        → Static Site Generation  (serves pre-built file from /dist)
 *   GET /ssr        → Server-Side Rendering   (generates HTML per request)
 *   GET /csr        → Client-Side Rendering   (serves empty shell + JS)
 *   GET /isr        → Incremental Static Regen (serves cached file, revalidates async)
 *   GET /ppr        → Partial Pre-Rendering   (serves pre-built shell + dynamic chunk)
 *   GET /api/posts  → JSON API used by the CSR page
 *   GET /client/*   → Static file serving for client-side JS
 */

const http = require("http");
const fs = require("fs");
const path = require("path");

const { htmlShell, renderHomePage } = require("./templates");

const handleSSG = require("./strategies/ssg");
const handleSSR = require("./strategies/ssr");
const handleCSR = require("./strategies/csr");
const handleISR = require("./strategies/isr");
const handlePPR = require("./strategies/ppr");

const PORT = 3000;

const postsPath = path.join(__dirname, "../data/posts.json");
const posts = JSON.parse(fs.readFileSync(postsPath, "utf-8"));

/**
 * A tiny router.
 * Helps keep the `requestListener` readable without pulling in dependencies.
 */

function router(req, res) {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  // Static files for the CSR client script
  if (pathname.startsWith("/client/")) {
    serveStaticFile(res, path.join(__dirname, "../", pathname));
    return;
  }

  switch (pathname) {
    case "/":
      handleHome(req, res);
      break;

    case "/ssg":
      handleSSG(req, res);
      break;

    case "/ssr":
      handleSSR(req, res);
      break;

    case "/csr":
      handleCSR(req, res);
      break;

    case "/isr":
      handleISR(req, res, posts);
      break;

    case "/ppr":
      handlePPR(req, res);
      break;

    case "/api/posts":
      handleApiPosts(req, res, posts);
      break;

    default:
      handle404(req, res);
  }
}

/**
 * Home page - explains what this project is.
 * This page itself is rendered via SSR (generated on each request),
 * but that's incidental - it has no dynamic data so it doesn't matter.
 */
function handleHome(req, res) {
  const html = htmlShell({
    title: "Rendering Strategies",
    body: renderHomePage(),
    strategy: "SSR", // home page is server-rendered, no caching
    generatedAt: new Date().toISOString(),
  });

  res.writeHead(200, { "Content-Type": "text/html" });
  res.end(html);
}

/**
 * JSON API endpoint - used by the CSR page.
 *
 * This is what makes CSR work: instead of HTML, the server returns data.
 * The client fetches this, then builds its own DOM.
 *
 * Notice we add a CORS header. The CSR page is served from the same origin,
 * so it's not strictly needed here - but in real CSR setups, your API and
 * your frontend are often on different origins.
 */
function handleApiPosts(req, res, posts) {
  const payload = JSON.stringify({
    posts,
    generatedAt: new Date().toISOString(),
  });

  res.writeHead(200, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(payload);
}

/**
 * Serves a static file from disk.
 * Used for /client/*.js - the scripts our CSR page needs.
 */
function serveStaticFile(res, filePath) {
  const ext = path.extname(filePath);
  const mimeTypes = {
    ".js": "application/javascript",
    ".html": "text/html",
    ".css": "text/css",
    ".json": "application/json",
  };

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("File not found");
      return;
    }

    res.writeHead(200, { "Content-Type": mimeTypes[ext] || "text/plain" });
    res.end(data);
  });
}

function handle404(req, res) {
  res.writeHead(404, { "Content-Type": "text/html" });
  res.end(`
    <html><body style="font-family:sans-serif; padding:2rem; background:#0f172a; color:#e2e8f0;">
      <h1>404</h1>
      <p>No route for <code>${req.url}</code></p>
      <a href="/" style="color:#60a5fa;">← Home</a>
    </body></html>
  `);
}

const server = http.createServer(router);
server.listen(PORT, () => {
  console.log(`\n  Server running at http://localhost:${PORT}`);
  console.log(`\n  Routes:`);
  console.log(`    /       → Home`);
  console.log(`    /ssg    → Static Site Generation`);
  console.log(`    /ssr    → Server-Side Rendering`);
  console.log(`    /csr    → Client-Side Rendering`);
  console.log(`    /isr    → Incremental Static Regeneration`);
  console.log(`    /ppr    → Partial Pre-Rendering`);
  console.log(`    /api/posts → JSON API (used by CSR)\n`);
});

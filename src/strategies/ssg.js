/**
 * SSG Strategy - Static Site Generation
 * Placeholder - implementation coming next.
 */

const { htmlShell } = require("../templates");

module.exports = function handleSSG(req, res, posts) {
  res.writeHead(200, { "Content-Type": "text/html" });
  res.end(
    htmlShell({
      title: "SSG - Coming Soon",
      body: "<h1>SSG</h1><p>We'll implement this next.</p>",
      strategy: "SSG",
      generatedAt: new Date().toISOString(),
    }),
  );
};

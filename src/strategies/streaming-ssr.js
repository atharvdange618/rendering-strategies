/**
 * streaming-ssr.js - Streaming Server-Side Rendering
 *
 * This is v1 of the PPR handler, kept on purpose as a comparison.
 *
 * It streams exactly like PPR: shell first, dynamic chunk after the async
 * fetch, one response. Open DevTools and the two look the same on the wire.
 *
 * The difference is the first chunk. Here the shell is rendered right now,
 * for this request: posts.json is read and renderPostList() runs every time.
 * Watch the banner timestamp change on every refresh, while /ppr's stays
 * frozen at build time.
 *
 * The file-server test: delete the Node process and serve dist/ from a plain
 * file server. PPR's shell still loads. This page cannot exist at all.
 */

const fs = require("fs");
const path = require("path");
const { buildStreamingSSRShell } = require("../templates");
const streamWithDynamicHole = require("../stream-dynamic-hole");

const DATA_PATH = path.join(__dirname, "../../data/posts.json");

module.exports = async function handleStreamingSSR(req, res) {
  // Per-request render of the "static" part. This is what PPR avoids.
  const posts = JSON.parse(fs.readFileSync(DATA_PATH, "utf-8"));
  const shellHtml = buildStreamingSSRShell(posts, new Date().toISOString());

  await streamWithDynamicHole(res, shellHtml);
};

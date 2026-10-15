/**
 * Tests run sequentially in one file because several of them edit
 * data/posts.json and dist/*.html. Every touched file is restored after.
 */

const { describe, test, before, after, afterEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const http = require("http");
const vm = require("vm");
const { execFileSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const DATA_PATH = path.join(ROOT, "data/posts.json");
const DIST = path.join(ROOT, "dist");
const TOUCHED = [
  DATA_PATH,
  path.join(DIST, "ssg.html"),
  path.join(DIST, "isr.html"),
  path.join(DIST, "ppr-shell.html"),
];

const router = require("../src/server");
const isrCache = require("../src/isr-cache");
const { renderPostList, buildPPRShell, buildPPRDynamicChunk } = require("../src/templates");

let server;
let baseUrl;
const backups = new Map();

function get(pathname) {
  return fetch(baseUrl + pathname, { signal: AbortSignal.timeout(5000) });
}

function readPosts() {
  return JSON.parse(fs.readFileSync(DATA_PATH, "utf-8"));
}

function editFirstTitle() {
  const posts = readPosts();
  posts[0].title = `Edited ${Date.now()}`;
  fs.writeFileSync(DATA_PATH, JSON.stringify(posts, null, 2));
  return posts[0].title;
}

async function waitFor(condition, timeoutMs = 2000) {
  const start = Date.now();
  while (!condition()) {
    if (Date.now() - start > timeoutMs) throw new Error("waitFor timed out");
    await new Promise((r) => setTimeout(r, 10));
  }
}

function makeIsrCacheStale() {
  isrCache.lastGeneratedAt = Date.now() - isrCache.REVALIDATION_WINDOW_MS - 1000;
}

// The dynamic chunk must sit inside <body>, and the response must end as a valid document.
function assertResolverInsideBody(body) {
  const call = body.lastIndexOf("__pprResolve('dynamic-hole'");
  assert.ok(call !== -1, "resolver call missing");
  assert.ok(call < body.lastIndexOf("</body>"), "resolver call is after </body>");
  assert.ok(body.trimEnd().endsWith("</html>"), "response does not end with </html>");
  assert.equal(body.split("</html>").length - 1, 1, "expected exactly one </html>");
}

before(async () => {
  for (const file of TOUCHED) backups.set(file, fs.readFileSync(file));
  server = http.createServer(router);
  await new Promise((r) => server.listen(0, r));
  baseUrl = `http://localhost:${server.address().port}`;
});

after(async () => {
  for (const [file, content] of backups) fs.writeFileSync(file, content);
  server.closeAllConnections();
  await new Promise((r) => server.close(r));
});

afterEach(() => {
  mock.restoreAll();
  fs.writeFileSync(DATA_PATH, backups.get(DATA_PATH));
});

describe("step 1: data is read per request", () => {
  test("/api/posts reflects posts.json edits without a restart", async () => {
    const title = editFirstTitle();
    const { posts } = await (await get("/api/posts")).json();
    assert.equal(posts[0].title, title);
  });

  test("ISR regeneration picks up edited posts.json", async () => {
    const title = editFirstTitle();
    makeIsrCacheStale();

    const stale = await get("/isr");
    assert.equal(stale.headers.get("x-isr-status"), "stale");
    await stale.text();
    await waitFor(() => !isrCache.isRevalidating);

    const fresh = await (await get("/isr")).text();
    assert.ok(fresh.includes(title), "regenerated page is missing the edited title");
  });
});

describe("step 2: ISR revalidation is async", () => {
  test("a request during revalidation sees stale-revalidating", async () => {
    // Slow the disk write down so the revalidation window is wide enough to hit.
    const realWriteFile = fs.promises.writeFile;
    mock.method(fs.promises, "writeFile", async (...args) => {
      await new Promise((r) => setTimeout(r, 100));
      return realWriteFile(...args);
    });
    makeIsrCacheStale();

    const first = await get("/isr");
    await first.text();
    const second = await get("/isr");
    await second.text();

    assert.equal(first.headers.get("x-isr-status"), "stale");
    assert.equal(second.headers.get("x-isr-status"), "stale-revalidating");
    await waitFor(() => !isrCache.isRevalidating);
  });

  test("a request mid-write never sees a truncated cache file", async () => {
    // writeFile truncates before it writes. Freeze it in that state.
    const realWriteFile = fs.promises.writeFile;
    mock.method(fs.promises, "writeFile", async (file, ...rest) => {
      await realWriteFile(file, "");
      await new Promise((r) => setTimeout(r, 100));
      return realWriteFile(file, ...rest);
    });
    makeIsrCacheStale();

    await (await get("/isr")).text();
    const during = await get("/isr");
    const body = await during.text();

    assert.notEqual(during.headers.get("x-isr-status"), "cold-start");
    assert.ok(body.includes("</html>"), "served a truncated page");
    await waitFor(() => !isrCache.isRevalidating);
  });
});

describe("step 3: build generates the ISR cache", () => {
  test("node src/build.js writes dist/isr.html", () => {
    const isrPath = path.join(DIST, "isr.html");
    fs.unlinkSync(isrPath);
    execFileSync(process.execPath, [path.join(ROOT, "src/build.js")], { stdio: "ignore" });
    assert.ok(fs.existsSync(isrPath), "build did not create dist/isr.html");
  });
});

describe("step 4: PPR shell reuses the shared template", () => {
  test("shell contains exactly what renderPostList() returns", () => {
    const posts = readPosts();
    const shell = buildPPRShell(posts, new Date().toISOString());
    assert.ok(shell.includes(renderPostList(posts)));
  });
});

describe("step 5: PPR stream is valid HTML", () => {
  test("/ppr puts the resolver before </body> and ends with </html>", async () => {
    const body = await (await get("/ppr")).text();
    assertResolverInsideBody(body);
  });
});

describe("step 6: PPR dynamic hole has an error path", () => {
  test("a failed fetch fills a fallback and closes the stream", async () => {
    const trending = require("../src/trending");
    mock.method(trending, "fetchTrendingData", () => Promise.reject(new Error("db down")));

    const res = await get("/ppr");
    const body = await res.text();

    assert.equal(res.status, 200);
    assert.ok(body.includes("trending-error"), "fallback markup missing");
    assertResolverInsideBody(body);
  });
});

describe("step 7: dynamic chunk escaping", () => {
  test("backticks and backslashes survive into the resolved HTML", () => {
    const title = "a`b\\c";
    const chunk = buildPPRDynamicChunk({ title, views: 1, trend: "x" }, "t");
    const script = chunk.replace(/<\/?script>/g, "");

    let resolved;
    vm.runInNewContext(script, {
      window: { __pprResolve: (_id, html) => (resolved = html) },
      document: { getElementById: () => null },
    });

    assert.ok(resolved.includes(title), `got: ${resolved}`);
  });
});

describe("step 8: streaming SSR route", () => {
  test("/streaming-ssr renders the post list per request and streams the hole", async () => {
    const trending = require("../src/trending");
    mock.method(trending, "fetchTrendingData", async () => ({
      title: "Mocked",
      views: 1,
      trend: "+1%",
    }));

    const res = await get("/streaming-ssr");
    const body = await res.text();

    assert.equal(res.status, 200);
    assert.ok(body.includes(renderPostList(readPosts())));
    assertResolverInsideBody(body);
  });
});

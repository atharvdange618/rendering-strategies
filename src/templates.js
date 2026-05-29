/**
 * templates.js - Shared HTML generation logic
 *
 * EVERY rendering strategy (SSG, SSR, CSR, ISR, PPR) uses
 * the SAME template functions. What differs is WHEN and WHERE they get called:
 *
 *   SSG  → called once at build time, output saved to disk
 *   SSR  → called on every incoming request, output sent directly
 *   ISR  → called in the background after a cache expires, output saved to disk
 *   CSR  → NOT called here at all - the browser does its own rendering
 *           (we expose a JSON API endpoint, the client builds its own HTML)
 *   PPR  → static shell pre-built (like SSG) and streamed instantly, dynamic chunk
 *           streamed at request time to resolve dynamic placeholders
 *
 */

/**
 * Wraps any page content in a full HTML document shell.
 *
 * The `meta` object carries extra context each strategy wants to surface -
 * specifically, when the HTML was generated and by which strategy.
 *
 * @param {object} options
 * @param {string} options.title       - Page <title>
 * @param {string} options.body        - Inner HTML content
 * @param {string} options.strategy    - Which rendering strategy produced this page
 * @param {string} options.generatedAt - ISO timestamp of when this HTML was generated
 * @param {string} [options.extraHead] - Optional extra tags for <head> (scripts, etc.)
 */

function htmlShell({ title, body, strategy, generatedAt, extraHead = "" }) {
  const strategyColors = {
    SSG: "#4ade80",
    SSR: "#60a5fa",
    ISR: "#f59e0b",
    CSR: "#c084fc",
    PPR: "#818cf8",
  };

  const badgeColor = strategyColors[strategy] || "#94a3b8";

  // Helper to dynamically apply active styling to navigation tabs
  const getActiveClass = (path) => {
    // Check if we are on the Home page
    if (title === "Rendering Strategies") {
      return path === "/" ? ' class="active"' : "";
    }
    // Otherwise, match based on rendering strategy
    if (strategy === "SSG" && path === "/ssg") return ' class="active"';
    if (strategy === "SSR" && path === "/ssr") return ' class="active"';
    if (strategy === "CSR" && path === "/csr") return ' class="active"';
    if (strategy === "ISR" && path === "/isr") return ' class="active"';
    if (strategy === "PPR" && path === "/ppr") return ' class="active"';
    return "";
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  ${extraHead}
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #0f172a;
      color: #e2e8f0;
      min-height: 100vh;
      padding: 2rem;
    }

    .strategy-banner {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 8px;
      padding: 0.5rem 1rem;
      margin-bottom: 2rem;
      font-size: 0.85rem;
    }

    .strategy-badge {
      background: ${badgeColor};
      color: #0f172a;
      font-weight: 700;
      font-size: 0.75rem;
      padding: 0.15rem 0.5rem;
      border-radius: 4px;
      letter-spacing: 0.05em;
    }

    .generated-at {
      color: #64748b;
      font-size: 0.8rem;
    }

    .container {
      max-width: 800px;
      margin: 0 auto;
    }

    h1 {
      font-size: 2rem;
      font-weight: 700;
      margin-bottom: 0.5rem;
      color: #f1f5f9;
    }

    .subtitle {
      color: #64748b;
      margin-bottom: 2.5rem;
    }

    .post-list {
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .post-card {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 12px;
      padding: 1.5rem;
      transition: border-color 0.15s;
    }

    .post-card:hover { border-color: ${badgeColor}; }

    .post-title {
      font-size: 1.1rem;
      font-weight: 600;
      color: #f1f5f9;
      margin-bottom: 0.4rem;
    }

    .post-excerpt {
      color: #94a3b8;
      font-size: 0.9rem;
      line-height: 1.6;
      margin-bottom: 0.75rem;
    }

    .post-meta {
      display: flex;
      align-items: center;
      gap: 1rem;
      font-size: 0.8rem;
      color: #94a3b8;
    }

    .tag {
      background: #0f172a;
      border: 1px solid #334155;
      border-radius: 4px;
      padding: 0.1rem 0.4rem;
      font-size: 0.75rem;
      color: #64748b;
    }

    .nav {
      display: flex;
      gap: 0.75rem;
      margin-bottom: 3rem;
      flex-wrap: wrap;
    }

    .nav a {
      color: #64748b;
      text-decoration: none;
      font-size: 0.85rem;
      padding: 0.3rem 0.75rem;
      border: 1px solid #334155;
      border-radius: 6px;
      transition: all 0.15s;
    }

    .nav a:hover { color: #e2e8f0; border-color: #64748b; }
    .nav a.active { color: ${badgeColor}; border-color: ${badgeColor}; }
  </style>
</head>
<body>
  <div class="container">
    <nav class="nav">
      <a href="/"${getActiveClass("/")}>Home</a>
      <a href="/ssg"${getActiveClass("/ssg")}>SSG</a>
      <a href="/ssr"${getActiveClass("/ssr")}>SSR</a>
      <a href="/csr"${getActiveClass("/csr")}>CSR</a>
      <a href="/isr"${getActiveClass("/isr")}>ISR</a>
      <a href="/ppr"${getActiveClass("/ppr")}>PPR</a>
    </nav>

    <div class="strategy-banner">
      <span class="strategy-badge">${strategy}</span>
      <span>Rendered via <strong>${getStrategyFullName(strategy)}</strong></span>
      <span class="generated-at">· HTML generated at ${generatedAt}</span>
    </div>

    ${body}
  </div>
</body>
</html>`;
}

/**
 * Renders the list of blog posts as HTML.
 *
 * @param {Array} posts - Array of post objects from posts.json
 * @returns {string} HTML string for the post list
 */

function renderPostList(posts) {
  if (!posts || posts.length === 0) {
    return `<p style="color: #64748b;">No posts found.</p>`;
  }

  const items = posts
    .map((post) => {
      const tags = (post.tags || [])
        .map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`)
        .join(" ");

      return `
      <li class="post-card">
        <div class="post-title">${escapeHtml(post.title)}</div>
        <div class="post-excerpt">${escapeHtml(post.excerpt)}</div>
        <div class="post-meta">
          <span>${escapeHtml(post.author)}</span>
          <span>${escapeHtml(post.date)}</span>
          <span>${tags}</span>
        </div>
      </li>`;
    })
    .join("\n");

  return `
    <h1>Blog Posts</h1>
    <p class="subtitle">${posts.length} articles on JavaScript, architecture, and building things.</p>
    <ul class="post-list">
      ${items}
    </ul>`;
}

/**
 * Renders the home/landing page that links to all four strategies.
 */

function renderHomePage() {
  const strategies = [
    {
      name: "SSG",
      path: "/ssg",
      color: "#4ade80",
      title: "Static Site Generation",
      description:
        "HTML is generated ONCE at build time. Run `node src/build.js` to regenerate. The timestamp on the page won't change until you rebuild.",
    },
    {
      name: "SSR",
      path: "/ssr",
      color: "#60a5fa",
      title: "Server-Side Rendering",
      description:
        "HTML is generated fresh on EVERY request. Refresh the page repeatedly - the timestamp updates each time.",
    },
    {
      name: "CSR",
      path: "/csr",
      color: "#c084fc",
      title: "Client-Side Rendering",
      description:
        "Server sends a near-empty HTML shell. JavaScript runs in your browser, fetches the data, and builds the DOM. View source - you'll see almost no content.",
    },
    {
      name: "ISR",
      path: "/isr",
      color: "#f59e0b",
      title: "Incremental Static Regeneration",
      description:
        "Serves a cached static file. After 10 seconds of staleness, the NEXT request triggers a background rebuild. You get the stale page instantly; the page after you gets the fresh one.",
    },
    {
      name: "PPR",
      path: "/ppr",
      color: "#818cf8",
      title: "Partial Pre-Rendering",
      description:
        "Static shell served instantly from disk. Dynamic hole filled at request time. Both arrive in ONE HTTP response via chunked transfer - no extra network round-trips.",
    },
  ];

  const cards = strategies
    .map(
      (s) => `
    <a href="${s.path}" style="
      display: block;
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 12px;
      padding: 1.5rem;
      text-decoration: none;
      color: inherit;
      transition: border-color 0.15s;
    " onmouseover="this.style.borderColor='${s.color}'"
       onmouseout="this.style.borderColor='#334155'">
      <div style="display:flex; align-items:center; gap:0.75rem; margin-bottom:0.75rem;">
        <span style="
          background: ${s.color};
          color: #0f172a;
          font-weight: 700;
          font-size: 0.8rem;
          padding: 0.2rem 0.6rem;
          border-radius: 4px;
          letter-spacing: 0.05em;
        ">${s.name}</span>
        <span style="font-weight:600; color:#f1f5f9;">${s.title}</span>
      </div>
      <p style="color:#94a3b8; font-size:0.9rem; line-height:1.6;">${s.description}</p>
    </a>`,
    )
    .join("\n");

  return `
    <h1 style="margin-bottom:0.5rem;">Rendering Strategies</h1>
    <p class="subtitle" style="margin-bottom:2.5rem;">
      A from-first-principles exploration of SSG, SSR, CSR, and ISR - built with zero frameworks.
    </p>
    <div style="display:grid; gap:1rem;">
      ${cards}
    </div>`;
}

/**
 * Escapes HTML special characters to prevent XSS.
 *
 * @param {string} str
 * @returns {string}
 */

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getStrategyFullName(strategy) {
  const names = {
    SSG: "Static Site Generation",
    SSR: "Server-Side Rendering",
    CSR: "Client-Side Rendering",
    ISR: "Incremental Static Regeneration",
    PPR: "Partial Pre-Rendering",
  };

  return names[strategy] || strategy;
}

/**
 * Builds the PPR static shell - a COMPLETE, valid HTML document.
 *
 *   1. The shell includes a global window.__pprResolve(id, html) function
 *      defined in a <script> block inside <body>, before </body></html>.
 *
 *   2. At request time, after async work completes, the server streams a
 *      tiny inline <script> AFTER the closing </html> tag.
 *
 *   3. Browsers execute inline <script> tags that appear after </html>.
 *      This is intentional, spec-compliant behavior - browsers parse the
 *      entire HTTP response stream, not just up to the closing tag.
 *      React's streaming SSR uses this same mechanic.
 *
 *   4. That post-</html> script calls window.__pprResolve(), which was
 *      already registered during the initial document parse. It swaps
 *      the skeleton placeholder with the real dynamic content.
 *
 * The result: one HTTP connection, two delivery moments, zero broken HTML.
 *
 * @param {Array}  posts   - Post data from build time
 * @param {string} builtAt - ISO timestamp from when the build script ran
 * @returns {string} Complete, valid HTML document
 */
function buildPPRShell(posts, builtAt) {
  const postItems = posts
    .map(
      (post) => `
      <li class="post-card">
        <div class="post-title">${escapeHtml(post.title)}</div>
        <div class="post-excerpt">${escapeHtml(post.excerpt)}</div>
        <div class="post-meta">
          <span>${escapeHtml(post.author)}</span>
          <span>${escapeHtml(post.date)}</span>
          ${(post.tags || [])
            .map((t) => `<span class="tag">${escapeHtml(t)}</span>`)
            .join("")}
        </div>
      </li>`,
    )
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Blog Posts - PPR</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #0f172a; color: #e2e8f0;
      min-height: 100vh; padding: 2rem;
    }
    .container { max-width: 800px; margin: 0 auto; }
    .nav { display: flex; gap: 0.75rem; margin-bottom: 3rem; flex-wrap: wrap; }
    .nav a {
      color: #64748b; text-decoration: none; font-size: 0.85rem;
      padding: 0.3rem 0.75rem; border: 1px solid #334155;
      border-radius: 6px; transition: all 0.15s;
    }
    .nav a:hover { color: #e2e8f0; border-color: #64748b; }
    .nav a.active { color: #818cf8; border-color: #818cf8; }
    .strategy-banner {
      display: inline-flex; align-items: center; gap: 0.5rem;
      background: #1e293b; border: 1px solid #334155;
      border-radius: 8px; padding: 0.5rem 1rem;
      margin-bottom: 1.5rem; font-size: 0.85rem;
    }
    .strategy-badge {
      background: #818cf8; color: #0f172a;
      font-weight: 700; font-size: 0.75rem;
      padding: 0.15rem 0.5rem; border-radius: 4px;
    }
    .generated-at { color: #64748b; font-size: 0.8rem; }
    .ppr-explainer {
      background: #1e293b; border: 1px solid #818cf844;
      border-radius: 8px; padding: 1rem 1.25rem;
      margin-bottom: 2rem; font-size: 0.82rem; color: #94a3b8; line-height: 1.7;
    }
    .ppr-explainer strong { color: #818cf8; }
    .ppr-build-note {
      background: #0f172a; border: 1px solid #334155;
      border-radius: 6px; padding: 0.6rem 1rem;
      margin-top: 0.75rem; font-size: 0.78rem; color: #475569; font-family: monospace;
    }
    h1 { font-size: 2rem; font-weight: 700; margin-bottom: 0.5rem; color: #f1f5f9; }
    .subtitle { color: #64748b; margin-bottom: 2.5rem; }
    .post-list { list-style: none; display: flex; flex-direction: column; gap: 1rem; }
    .post-card {
      background: #1e293b; border: 1px solid #334155;
      border-radius: 12px; padding: 1.5rem;
    }
    .post-card:hover { border-color: #818cf8; }
    .post-title { font-size: 1.1rem; font-weight: 600; color: #f1f5f9; margin-bottom: 0.4rem; }
    .post-excerpt { color: #94a3b8; font-size: 0.9rem; line-height: 1.6; margin-bottom: 0.75rem; }
    .post-meta { display: flex; align-items: center; gap: 1rem; font-size: 0.8rem; color: #475569; flex-wrap: wrap; }
    .tag {
      background: #0f172a; border: 1px solid #334155;
      border-radius: 4px; padding: 0.1rem 0.4rem;
      font-size: 0.75rem; color: #64748b;
    }
    .section-divider { margin: 2.5rem 0; border: none; border-top: 1px solid #1e293b; }
    .skeleton-widget {
      background: #1e293b; border: 1px solid #334155;
      border-radius: 12px; padding: 1.5rem;
    }
    .skeleton-label {
      font-size: 0.75rem; font-weight: 600; color: #475569;
      text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 1rem;
    }
    .skeleton-line {
      height: 12px; border-radius: 4px;
      background: linear-gradient(90deg, #1e293b, #334155, #1e293b);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite; margin-bottom: 0.5rem;
    }
    .skeleton-line.long { width: 80%; }
    .skeleton-line.short { width: 45%; }
    @keyframes shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
    .trending-widget {
      background: #1e293b; border: 1px solid #818cf844;
      border-radius: 12px; padding: 1.5rem;
    }
    .trending-label {
      font-size: 0.75rem; font-weight: 600; color: #818cf8;
      text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 0.75rem;
    }
    .trending-title { font-size: 1rem; font-weight: 600; color: #f1f5f9; margin-bottom: 0.5rem; }
    .trending-meta { display: flex; gap: 1.5rem; font-size: 0.82rem; color: #64748b; }
    .trending-views { color: #e2e8f0; }
    .trending-trend { color: #4ade80; }
    .trending-fetched { font-size: 0.75rem; color: #475569; margin-top: 0.75rem; }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(4px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .fade-in { animation: fadeIn 0.2s ease-out; }
  </style>
</head>
<body>
  <div class="container">
    <nav class="nav">
      <a href="/">Home</a>
      <a href="/ssg">SSG</a>
      <a href="/ssr">SSR</a>
      <a href="/csr">CSR</a>
      <a href="/isr">ISR</a>
      <a href="/ppr" class="active">PPR</a>
    </nav>

    <div class="strategy-banner">
      <span class="strategy-badge">PPR</span>
      <span>Rendered via <strong>Partial Pre-Rendering</strong></span>
      <span class="generated-at">· Static shell built at ${escapeHtml(builtAt)}</span>
    </div>

    <div class="ppr-explainer">
      The post list is <strong>pre-built at build time</strong>, served from disk like SSG.
      The "Trending" widget below is a <strong>dynamic hole</strong> filled at request time.
      Both arrive in one HTTP response. Chunk 2 is a tiny inline &lt;script&gt; injected
      <em>after &lt;/html&gt;</em> - browsers execute it anyway. No broken HTML, no external file request.
      <div class="ppr-build-note">
        Shell built at: ${escapeHtml(builtAt)}
        &nbsp;·&nbsp; Dynamic fetched at: <span id="fetch-time" style="color:#475569;">waiting...</span>
      </div>
    </div>

    <h1>Blog Posts</h1>
    <p class="subtitle">${posts.length} articles on JavaScript, architecture, and building things.</p>

    <ul class="post-list">
      ${postItems}
    </ul>

    <hr class="section-divider" />

    <p style="font-size:0.75rem;color:#475569;margin-bottom:0.75rem;text-transform:uppercase;letter-spacing:0.08em;">
      Dynamic hole (filled by inline script after async fetch)
    </p>

    <div id="dynamic-hole">
      <div class="skeleton-widget">
        <div class="skeleton-label">Trending this week</div>
        <div class="skeleton-line long"></div>
        <div class="skeleton-line short"></div>
      </div>
    </div>

  </div><!-- close .container -->

  <script>
    // window.__pprResolve is the contract between the pre-built shell and
    // the dynamic chunk. The shell registers it. The chunk calls it.
    // This function is available the moment the browser parses this block -
    // long before the dynamic chunk arrives. When chunk 2's inline <script>
    // calls window.__pprResolve('dynamic-hole', html), this runs immediately.
    window.__pprResolve = function(id, html) {
      var el = document.getElementById(id);
      if (el) el.innerHTML = html;
    };
  </script>
</body>
</html>
`;
}

/**
 * Builds the dynamic closing chunk - the second half of a PPR response.
 *
 * This is generated at request time, after the async data fetch resolves.
 * It contains the resolved content, the swap script, and the closing tags
 * that complete the HTML document opened by buildPPRShell().
 *
 * @param {object} trending  - Live data fetched at request time
 * @param {string} fetchedAt - ISO timestamp of when the fetch completed
 * @returns {string} HTML fragment that completes the open document
 */
function buildPPRDynamicChunk(trending, fetchedAt) {
  const widgetHtml = `
    <div class="trending-widget fade-in">
      <div class="trending-label">Trending this week</div>
      <div class="trending-title">${escapeHtml(trending.title)}</div>
      <div class="trending-meta">
        <span class="trending-views">${trending.views.toLocaleString()} views</span>
        <span class="trending-trend">${escapeHtml(trending.trend)}</span>
      </div>
      <div class="trending-fetched">
        Fetched at request time: ${escapeHtml(fetchedAt)}
        - this changes every request. The shell timestamp above does not.
      </div>
    </div>`
    .replace(/`/g, "\\`")
    .replace(/\\/g, "\\\\")
    .replace(/`/g, "\\`");

  // CHUNK 2: An inline <script> that arrives AFTER </html>.
  // Browsers parse and execute this even though the document is "closed."
  // window.__pprResolve() was defined inside the shell's <script> block,
  // so it's available here. We call it with the hole ID and the resolved HTML

  // One more thing: the reason why did not do "<script src='file.js'>":
  // src= fires a new HTTP request. Inline script reads from THIS stream.
  const resolverCall = `
<script>
  (function() {
    var html = ${JSON.stringify(widgetHtml)};
    window.__pprResolve('dynamic-hole', html);
    var fetchTimeEl = document.getElementById('fetch-time');
    if (fetchTimeEl) {
      fetchTimeEl.textContent = ${JSON.stringify(fetchedAt)};
      fetchTimeEl.style.color = '#4ade80';
    }
  })();
</script>`;

  return resolverCall;
}

module.exports = {
  htmlShell,
  renderPostList,
  renderHomePage,
  escapeHtml,
  buildPPRShell,
  buildPPRDynamicChunk,
};

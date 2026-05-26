/**
 * templates.js - Shared HTML generation logic
 *
 * EVERY rendering strategy (SSG, SSR, CSR, ISR) uses
 * the SAME template functions. What differs is WHEN and WHERE they get called:
 *
 *   SSG  → called once at build time, output saved to disk
 *   SSR  → called on every incoming request, output sent directly
 *   ISR  → called in the background after a cache expires, output saved to disk
 *   CSR  → NOT called here at all - the browser does its own rendering
 *           (we expose a JSON API endpoint, the client builds its own HTML)
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
  };

  const badgeColor = strategyColors[strategy] || "#94a3b8";

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
      <a href="/">Home</a>
      <a href="/ssg">SSG</a>
      <a href="/ssr">SSR</a>
      <a href="/csr">CSR</a>
      <a href="/isr">ISR</a>
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
  };

  return names[strategy] || strategy;
}

module.exports = {
  htmlShell,
  renderPostList,
  renderHomePage,
  escapeHtml,
};

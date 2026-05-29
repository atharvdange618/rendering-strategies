/**
 * client/app.js - CSR renderer
 *
 * This file runs in the BROWSER, not in Node.js.
 * It is the CSR implementation - everything that SSG's build.js and
 * SSR's request handler did on the server, this does on the client.
 *
 * The flow:
 *   1. Page loads with an empty #app div (just a comment inside it)
 *   2. This script is fetched and executed by the browser (via defer)
 *   3. We fetch /api/posts to get the data
 *   4. We build DOM nodes and insert them into #app
 *   5. User sees content
 *
 * Steps 1-2 are the "blank screen" window. On a slow connection or a slow
 * device, the user sees nothing useful during this time. This is CSR's
 * primary weakness: Time to First Contentful Paint (FCP) is slower because
 * content can't render until JS downloads, parses, executes, AND the API
 * responds. SSR and SSG don't have this problem - the HTML already has
 * content when it arrives.
 */

// DOM Helpers

/**
 * Creates a DOM element with optional props and children.
 * This is h() from my VDOM project - stripped to its minimal form.
 * No VNode layer, no diffing, just direct DOM creation.
 * You can visit my react dom project to understand the raw implemenation of vdom, here's the github repo: https://github.com/atharvdange618/React-Vdom
 */

function el(tag, props, ...children) {
  const node = document.createElement(tag);

  if (props) {
    for (const [key, value] of Object.entries(props)) {
      if (key === "className") {
        node.className = value;
      } else if (key === "style" && typeof value === "object") {
        Object.assign(node.style, value);
      } else {
        node.setAttribute(key, value);
      }
    }
  }

  for (const child of children) {
    if (child == null) continue;
    if (typeof child === "string" || typeof child === "number") {
      node.appendChild(document.createTextNode(String(child)));
    } else {
      node.appendChild(child);
    }
  }

  return node;
}

// render functions

function renderTag(tag) {
  return el("span", { className: "tag" }, tag);
}

function renderPostCard(post) {
  const tags = (post.tags || []).map(renderTag);

  const meta = el(
    "div",
    { className: "post-meta" },
    el("span", null, post.author),
    el("span", null, post.date),
    ...tags,
  );

  return el(
    "li",
    { className: "post-card" },
    el("div", { className: "post-title" }, post.title),
    el("div", { className: "post-excerpt" }, post.excerpt),
    meta,
  );
}

function renderPostList(posts, fetchedAt) {
  // Client-rendered timestamp panel - shows when the FETCH completed,
  // not when the page HTML was sent. This is the second timestamp you'll
  // see on the CSR page, and it's distinct from the shell's generatedAt.
  //
  // Compare this to SSR: SSR has ONE timestamp (when the server ran the
  // template). CSR has TWO timestamps - the shell send time and the fetch
  // completion time - because the process has two distinct phases.

  const fetchInfo = el(
    "div",
    {
      style: {
        background: "#1e293b",
        border: "1px solid #334155",
        borderRadius: "8px",
        padding: "0.75rem 1rem",
        marginBottom: "1.5rem",
        fontSize: "0.82rem",
        color: "#64748b",
      },
    },
    el(
      "span",
      { style: { color: "#c084fc", fontWeight: "600" } },
      "API response",
    ),
    ` received at ${fetchedAt} · `,
    el("span", null, `${posts.length} posts loaded`),
  );

  const heading = el("h1", null, "Blog Posts");

  const subtitle = el(
    "p",
    { className: "subtitle" },
    `${posts.length} articles on JavaScript, architecture, and building things.`,
  );

  const list = el(
    "ul",
    { className: "post-list" },
    ...posts.map(renderPostCard),
  );

  const wrapper = document.createDocumentFragment();
  wrapper.appendChild(fetchInfo);
  wrapper.appendChild(heading);
  wrapper.appendChild(subtitle);
  wrapper.appendChild(list);
  return wrapper;
}

function renderError(message) {
  return el(
    "div",
    {
      style: {
        background: "#1e293b",
        border: "1px solid #dc2626",
        borderRadius: "8px",
        padding: "1.5rem",
        color: "#fca5a5",
      },
    },
    el(
      "div",
      { style: { fontWeight: "600", marginBottom: "0.5rem" } },
      "Failed to load posts",
    ),
    el("div", { style: { fontSize: "0.85rem", color: "#94a3b8" } }, message),
  );
}

// main - fetch the data, render and mount

async function main() {
  const statusEl = document.getElementById("csr-status");
  const appEl = document.getElementById("app");

  try {
    // Phase 1: Fetch
    // This is the network round-trip that CSR always requires before showing
    // content. SSR and SSG don't have this - their data is already in the HTML.
    const startTime = performance.now();
    const response = await fetch("/api/posts");

    if (!response.ok) {
      throw new Error(`API responded with status ${response.status}`);
    }

    const { posts, generatedAt: fetchedAt } = await response.json();
    const elapsed = Math.round(performance.now() - startTime);

    // Update status to show the fetch completed
    if (statusEl) {
      statusEl.textContent = `Data fetched from /api/posts in ${elapsed}ms`;
      statusEl.style.color = "#4ade80";
    }

    // Phase 2: Render
    // This is where the browser does the work that SSR's server did.
    // Instead of an HTML string, we're building a live DOM tree.
    const content = renderPostList(posts, fetchedAt);

    // Phase 3: Mount
    // Clear the placeholder comment and insert the rendered content.
    appEl.innerHTML = "";
    appEl.appendChild(content);
  } catch (error) {
    if (statusEl) {
      statusEl.textContent = "Something went wrong.";
      statusEl.style.color = "#fca5a5";
    }
    appEl.innerHTML = "";
    appEl.appendChild(renderError(error.message));
  }
}

main();

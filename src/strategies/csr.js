/**
 * csr.js - Client-Side Rendering handler
 *
 * This is the smallest strategy handler in the project, and that's the point.
 * The server's job in CSR is to send a shell - a valid HTML document with
 * a mount point and a script tag. That's it. No data fetching, no template
 * rendering, no posts.json involved at all on this side.
 *
 * The actual rendering happens in /client/app.js, running in the browser.
 *
 * Notice the function signature: handleCSR(req, res)
 * That's intentional and worth staring at for a moment.
 * In CSR, the server doesn't need your data to respond to the request.
 * The client fetches it separately, via /api/posts, after the page loads.
 */

const { htmlShell } = require("../templates");

module.exports = function handleCSR(req, res) {
  // The shell body: a loading indicator + a mount point for the client JS.
  //
  // #app is where client/app.js will inject the rendered content.
  // The loading state is visible during the fetch - you might catch it
  // briefly on a slow connection or with network throttling in DevTools.
  //
  // KEY EXPERIMENT: After the page loads, right-click → View Page Source.
  // You will see this shell - the #app div with the loading text.
  // You will NOT see any blog posts. They don't exist in the HTML.
  // Now right-click → Inspect. You WILL see the posts there, because
  // the inspector shows the live DOM after JavaScript has run.
  // That difference between "View Source" and "Inspect" is CSR in one observation.

  const shellBody = `
    <div id="csr-status" style="color:#64748b; font-size:0.85rem; margin-bottom:1.5rem;">
      Fetching posts from <code style="color:#c084fc;">/api/posts</code>...
    </div>
    <div id="app">
      <!-- JavaScript will render content here -->
      <!-- View Source to see that this is all there is at page load -->
    </div>
  `;

  // We still use htmlShell() for the nav, styles, and overall structure.
  // But notice the generatedAt here is the time the SHELL was sent -
  // not when the content was rendered. The client will display its own
  // fetch timestamp separately, making the two-phase nature visible.

  const html = htmlShell({
    title: "Blog Posts - CSR",
    body: shellBody,
    strategy: "CSR",
    generatedAt: new Date().toISOString(),
    // This is how we load the client-side script.
    // defer ensures it runs after the HTML is parsed.
    extraHead: `<script src="/client/app.js" defer></script>`,
  });

  res.writeHead(200, {
    "Content-Type": "text/html",
    "Cache-Control": "no-cache",
  });
  res.end(html);
};

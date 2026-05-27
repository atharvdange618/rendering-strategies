/**
 * isr.js - Incremental Static Regenration handler
 *
 * The handler itself is suprisingly simple because all the complexity
 * lives in isr-cache.js.
 * What this handler does is pure decision-making: read the cache status, decide
 * what to serve, decide whether to revalidate, fire res.end() first, then
 * trigger the background work
 *
 * here is how the state machine works, it has exactly 4 states:
 *
 * State 1 - No cache exists yet (first ever request)
 *   -> Generate synchronously (user waits), serve the fresh result, cache it
 *   -> This is the cold start. Unavoidable the first time.
 *
 * State 2 - Cache exists and is fresh (within revalidation window)
 *   -> Serve cached file immediately, do nothing else
 *   -> This is the happy path. Fast, cheap, no background work.
 *
 * State 3 - Cache exists but is stale (window has expired)
 *   -> Serve the STALE cached file immediately (user gets fast response)
 *   -> AFTERR res.end(), trigger background revalidation
 *   -> This is the ISR mechanic. The current user gets stale content
 *   -> The NEXT user gets fresh content.
 *
 * State 4 - Revalidation is in progress (concurrent stale requests)
 *   -> Just serve the stale file. The ongoing background job will handle it
 *   -> Don't trigger a second rebuild.
 */

const isrCache = require("../isr-cache");

module.exports = async function handleISR(req, res, posts) {
  const cachedHtml = isrCache.readCache();

  // state 1 - cold start  - no cache file exists
  if (!cachedHtml) {
    console.log("  [ISR] Cold start - generating inital cache...");

    // we need to generate synchronously here because we have no stale version to fall back on. This request waits. Every subsequent requests hit the cache.

    const html = await isrCache.generateAndCache(posts);

    console.log("  [ISR] Inital cache ready. Serving the fresh page.");

    res.writeHead(200, {
      "Content-Type": "text/html",
      "X-ISR-Status": "cold-start",
    });

    res.end(html);
    return;
  }

  // state 2 - cache is fresh - serve immediately boii, no revalidation needed
  if (isrCache.isCacheValid()) {
    console.log(
      `  [ISR] Cache is fresh (${isrCache.getCacheStatus()}), Serving cached page.`,
    );

    res.writeHead(200, {
      "Content-Type": "text/html",
      "X-ISR-Status": "fresh",
    });

    res.end(cachedHtml);
    return;
  }

  // state 3 & 4 - cache is stale, so serve it NOW and then revalidate in background

  console.log(
    `  [ISR] Cache is stale (${isrCache.getCacheStatus()}), Serving stale page, triggering revalidation`,
  );

  // now the imp stuff
  // here is the order is very critical
  // res.end() fires BEFORE revalidateInBackground()
  // The user gets their response first. The rebuild happens after.
  // if you reverse the order, you get ssr - the user waits for the rebuild
  res.writeHead(200, {
    "Content-Type": "text/html",
    // only for learning mere dost
    "X-ISR-Status": isrCache.isRevalidating ? "stale-revalidating" : "stale",
  });
  res.end(cachedHtml);

  // now we will trigger the background rebuild. `await` is intentionally NOT used here. We want this to run without blocking anything. The promise resolves on its own time, updates the cache file on disk, and the next request picks it up.
  isrCache.revalidateInBackground(posts);
};

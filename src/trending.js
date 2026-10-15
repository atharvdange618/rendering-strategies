/**
 * trending.js - Simulated request-time data source for the dynamic hole.
 *
 * Shared by the PPR and streaming SSR handlers. They call it as
 * trending.fetchTrendingData() rather than destructuring it, so tests can
 * swap it out with mock.method().
 */

// Simulate async DB call
function fetchTrendingData() {
  return new Promise((resolve) => {
    // 2 seconds makes the gap between the two chunks easy to see in the browser.
    setTimeout(() => {
      resolve({
        title: "Building an OIDC Provider from Scratch",
        views: 1432,
        trend: "+38% this week",
      });
    }, 2000);
  });
}

module.exports = { fetchTrendingData };

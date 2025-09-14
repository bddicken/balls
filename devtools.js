// DevTools script - runs when DevTools opens
// Create panel immediately and synchronously
chrome.devtools.panels.create(
  "Balls",
  "", // Empty string for icon to avoid loading issues
  "panel.html",
  function(panel) {
    // Panel created callback
    if (chrome.runtime.lastError) {
      // Error occurred during panel creation
    } else {
      // Store panel reference globally if needed
      window.ballsPanel = panel;
    }
  }
);
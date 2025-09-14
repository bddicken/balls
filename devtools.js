// DevTools script - runs when DevTools opens
console.log("[Balls] DevTools script loaded at", new Date().toISOString());

// Create panel immediately and synchronously
chrome.devtools.panels.create(
  "Balls",
  "", // Empty string for icon to avoid loading issues
  "panel.html",
  function(panel) {
    // Panel created callback
    if (chrome.runtime.lastError) {
      console.error("[Balls] Panel creation error:", chrome.runtime.lastError);
    } else {
      console.log("[Balls] Panel created successfully");
      
      // Store panel reference globally if needed
      window.ballsPanel = panel;
    }
  }
);

// Log that we've attempted to create the panel
console.log("[Balls] Panel creation initiated");
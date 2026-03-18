// This script generates a shortcut file that can be imported on iOS
// Run: node build-shortcut.js
// Then AirDrop join-thekickback.shortcut to your iPhone

const fs = require('fs');
const plist = require('plist');

// Shortcut is essentially a plist with actions
// Since we can't easily generate the binary format,
// here's the exact steps to build it manually:

console.log(`
╔═══════════════════════════════════════════════════════════╗
║          theKickBack JOIN Shortcut — Quick Build          ║
╠═══════════════════════════════════════════════════════════╣
║                                                           ║
║  Open Shortcuts app on iPhone → tap + → build this:       ║
║                                                           ║
║  1. URL                                                   ║
║     https://kickback-sms.carl-lewis.workers.dev/api/venues║
║                                                           ║
║  2. Get Contents of URL (method: GET)                     ║
║                                                           ║
║  3. Get Dictionary Value → key: "venues"                  ║
║                                                           ║
║  4. Choose from List → prompt: "Pick a venue"             ║
║                                                           ║
║  5. Get Dictionary Value → key: "id" (from chosen item)   ║
║     → Set Variable: venueId                               ║
║                                                           ║
║  6. URL                                                   ║
║     https://kickback-sms.carl-lewis.workers.dev/api       ║
║                                                           ║
║  7. Get Contents of URL                                   ║
║     Method: POST                                          ║
║     Headers: Content-Type = application/json               ║
║     Request Body: JSON                                    ║
║       command = "join"                                    ║
║       venue_id = venueId (variable)                       ║
║       device_id = "my-iphone"                             ║
║                                                           ║
║  8. Get Dictionary Value → key: "venue"                   ║
║     → Set Variable: venue                                 ║
║                                                           ║
║  9. Get Variable: venue                                   ║
║     Get Dictionary Value → key: "name"                    ║
║     → Set Variable: venueName                             ║
║                                                           ║
║ 10. Get Variable: venue                                   ║
║     Get Dictionary Value → key: "vibe"                    ║
║     → Set Variable: vibe                                  ║
║                                                           ║
║ 11. Get Variable: venue                                   ║
║     Get Dictionary Value → key: "occupancy"               ║
║     → Set Variable: people                                ║
║                                                           ║
║ 12. Show Alert                                            ║
║     Title: "Welcome to [venueName]!"                      ║
║     Body: "[vibe] vibe · [people] people here"            ║
║                                                           ║
║ 13. Get Dictionary from step 7                            ║
║     Get Dictionary Value → key: "pass_url"                ║
║                                                           ║
║ 14. Open URL (opens wallet pass download)                 ║
║                                                           ║
║  Name it: "Join theKickBack"                              ║
║  Add to Siri: "Join the kick back"                        ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝

API Endpoints:
  GET  /api/venues  → list active venues
  POST /api         → { command, venue_id, device_id }

Test with curl:
  curl https://kickback-sms.carl-lewis.workers.dev/api/venues
`);

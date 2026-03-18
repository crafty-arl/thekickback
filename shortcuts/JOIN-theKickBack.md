# theKickBack JOIN Shortcut — Build Instructions

Open the Shortcuts app on your iPhone and create a new Shortcut with these actions:

## Step 1: Get Device ID
- Action: **Get Device Details**
- Get: **Device Name**
- Set Variable: `deviceId`

## Step 2: Fetch Venues
- Action: **Get Contents of URL**
- URL: `https://kickback-sms.carl-lewis.workers.dev/api/venues`
- Method: GET

## Step 3: Parse Venue Names
- Action: **Get Dictionary Value**
- Get Value for Key: `venues`
- Action: **Repeat with Each** (the venues array)
  - **Get Dictionary Value** → Key: `name`
  - **Add to Variable**: `venueNames`

## Step 4: Choose Venue
- Action: **Choose from List**
- List: `venueNames`
- Prompt: "Which venue are you at?"
- Set Variable: `chosenVenue`

## Step 5: Get Venue ID
(Match chosen name back to venue ID from the original list)

## Step 6: JOIN the Venue
- Action: **Get Contents of URL**
- URL: `https://kickback-sms.carl-lewis.workers.dev/api`
- Method: **POST**
- Request Body: **JSON**
  - command: `join`
  - venue_id: (the matched venue ID)
  - device_id: `deviceId`

## Step 7: Show Welcome
- Action: **Get Dictionary Value** → Key: `message`
- Action: **Show Alert**
  - Title: theKickBack
  - Body: (the message from the response)

## Step 8: Show Venue Details
- Action: **Get Dictionary Value** → Key: `venue`
- Show: "Vibe: [vibe] · People: [occupancy]/[capacity]"

## Step 9: Add Wallet Pass
- Action: **Get Dictionary Value** → Key: `pass_url`
- Action: **Open URL** (opens the .pkpass download → Add to Wallet)

---

## Trigger Options
- NFC sticker on table
- "Hey Siri, join theKickBack"
- Home screen icon
- Widget

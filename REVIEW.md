# Twitch Review

## INTRODUCTION

Heroes Share is a replay sharing and metadata site for Blizzard’s Heroes of the Storm. This overlay delivers live game information (gather by our client) to viewers in an accessible panel that mimics the in-game stats board. Similar to Innkeeper for HearthStone, the goal is to provide as much helpful information about the game to new viewers and game veterans alike - without getting in the way or complicating the viewer experience.


## WALKTHROUGH
By default, after an error, and when there are no live games the overlay is completely hidden. Once a game becomes live the main display board loads tucked away to the right, barely visible, ready to be expanded with a click. Additionally there is a text “summary” of the match (region, map, and game mode) in the upper right corner. Once expanded, the main display supports two levels of access:
* “Basic” provides information on the current heroes in the game, accessible by clicking on portraits of each hero and hovering their abilities and talents.
* “Premium” accounts (currently all accounts during beta testing) have additional tabs for in-game talent picks and average game performance; Premium access will require purchase of a premium subscription to our site

… and two levels of data depth:
* “Preview” is available as soon as a game loads and provides information only on the players in the game
* “Full” completes the dataset about 1 minute later when the rest of the hero and game information become available

All icons are either a clickable hero portrait (to open a hero “card”) or a hoverable tooltip with additional information. The three control buttons at the bottom and their corresponding panels display contingent on the access and data depth mentioned above.


## CHANNELS

Nobody on the dev team streams, so we have a faux stream up with a static image from the game in the background (https://www.twitch.tv/tattersail1). Every five minutes live game data is sent from the EBS to a channel broadcast and the display is updated - this includes the occasional “no live games” message to demonstrate a hidden display. All EBS data are from actual live games and can be compared for accuracy against the live game index on our site (https://heroesshare.net/lives/index).


## CHANGELOG

### Version 0.9.1:
* manifest.js: fixed upload disjoint for new hero
* helper.js: updated status message on JWT refresh

### Version 0.9.0:
* Cleaned up directory structure
* manifest.js: image assets now served from Twitch CDN (with failover to remote assets)
* helper.js: now handles common functions and data for window.Twitch.ext
* overlay.js: check for initialized client to prevent repeated EBS calls
* overlay.css: fixed non-responsive text sizes on hero cards
* overlay.html: added one-line status div on icon mouseover

### Version 0.8.2:
* overlay.js: Bugfix for partial panels not loading
* overlay.js: Removed channel from URL; updated endpoints
* broadcaster.js: Removed channel from URL; updated endpoints
* overlay.css: Tucker bar style a bit more obvious
* component.css: Removed (will be separate extension)
* component.html: Removed (will be separate extension)
* config.html: Updated URLs to site docs

### Version 0.8.1
* overlay.js: Added additional check to hide between games
* overlay.js: Fixed “playerFlag” and “heroFlag” typos (should be plurals)
* overlay.js: Removed pre-auth channel ID seed
* overlay.js: Removed pre-auth AJAX gamedata call
* overlay.js: Removed AJAX notice of broadcast reception
* overlay.js: Only calls gamedata on game confirmation
* overlay.js: Preventative check for duplicate gamedata calls
* overlay.css: increase drop-down relative font size
* broadcaster.css: Switch to white background
* config.html: Links open in new tab/window (for Content-Security-Policy)

### Version 0.0.1:
* Initial beta release for review and approval

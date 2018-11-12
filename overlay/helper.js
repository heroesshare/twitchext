// Twitch credentials
var token = "";
var tuid = "";
var channel = "";

// status
var enabled = true;
var initialized = false;
var playing = "";

// cached AJAX data
var gameData = [];
var currentGame = false;


// because who wants to type this every time?
var twitch = window.Twitch.ext;

// update status based on current game
twitch.onContext(function(context) {
	playing = context.game;
});

// update credentials when a new JWT token is issued
twitch.onAuthorized(function(auth) {

	token = auth.token;
	tuid = auth.userId;
	channel = auth.channelId;
	
	if (! enabled) {
		addLog("Disabled");
		return false;
	}
	
	if (initialized) {
		addLog("Re-authorized. Waiting for game...");
	} else {
		addLog("Connection established, checking for game...");
		fetchGame();
	}
	
});

// generic handler for AJAX failures
function logError(_, error, status) {
	addLog("EBS request returned "+status+" ("+error+")");
}

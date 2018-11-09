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
	addLog(auth);

	token = auth.token;
	tuid = auth.userId;
	channel = auth.channelId;
	
	$('#status').append("Connection established, waiting for game\n");
});

// generic handler for AJAX failures
function logError(_, error, status) {
  addLog("EBS request returned "+status+" ("+error+")");
}

// development = log to console
// production = do nothing
function addLog(data) {
	console.log(data);
}


$(function() {
	$('#status').append("\nConnecting to EBS...\n");
});
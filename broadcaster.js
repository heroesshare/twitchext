var token = "";
var tuid = "";
var channel = "223620806";

// because who wants to type this every time?
var twitch = window.Twitch.ext;

twitch.onContext(function(context) {
	twitch.rig.log(context);
});

twitch.onAuthorized(function(auth) {
	// save our credentials
	token = auth.token;
	tuid = auth.userId;
	channel = auth.channelId;
	
	$('#status').append("Connection initialized, waiting for game<br />");
	
});

function logError(_, error, status) {
  twitch.rig.log('EBS request returned '+status+' ('+error+')');
}

$(function() {
    // listen for incoming broadcast message from our EBS
    twitch.listen('broadcast', function (target, contentType, data) {
        $('#status').append("Received broadcast live update<br />");
        $('#status').append(data.message+"<br />");
        
        // notify of reception
		$.ajax({
			headers: { 'Authorization': 'Bearer ' + token },
			type: 'GET',
			url: 'https://heroesshare.net/twitches/receive',
			dataType: 'json',
			error: logError
		});
    });
});

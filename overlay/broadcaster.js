// append data to status div
function addLog(data) {
	if (typeof data == 'array') {
		data = data.toString();
	}
	$('#status').append(data+"<br />");
}

// initial fetch of any live games
function fetchGame() {
	if (! enabled) { return false; }
	if (initialized) { return true; }
		
	$.ajax({
		headers: { 'Authorization': 'Bearer ' + token },
		type: 'GET',
		url: 'https://heroesshare.net/twitches/fetch',
		dataType: 'json',
		success: function(data) { addLog(data.message); },
		error: logError
	});
	
	initialized = true;
}

$(function() {
    // listen for incoming broadcast message from our EBS
    twitch.listen('broadcast', function (target, contentType, data) {
        addLog("Received broadcast live update");
        addLog(data.message);
        
        // notify of reception
		$.ajax({
			headers: { 'Authorization': 'Bearer ' + token },
			type: 'GET',
			url: 'https://heroesshare.net/twitches/receive',
			dataType: 'json',
			error: logError
		});
    });
    
	addLog("Connecting to EBS...");
});

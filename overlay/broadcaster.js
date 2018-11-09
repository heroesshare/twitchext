
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

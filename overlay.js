var token = "";
var tuid = "";
var channel = "223620806";
var ebs = "";

var gameData = [];

// because who wants to type this every time?
var twitch = window.Twitch.ext;

twitch.onContext(function(context) {
	twitch.rig.log(context);
	console.log(context);
});

twitch.onAuthorized(function(auth) {
	// save our credentials
	token = auth.token;
	tuid = auth.userId;
	channel = auth.channelId;
	
	// pre-load game data to reduce PubSub body message size
	$.ajax({
		headers: { 'Authorization': 'Bearer ' + token },
		type: 'GET',
		url: 'https://heroesshare.net/twitchext/gamedata',
		dataType: 'json',
		success: cacheGameData,
		error: logError
	});
});

function logError(_, error, status) {
  twitch.rig.log('EBS request returned '+status+' ('+error+')');
}

function cacheGameData(data) {
	if (data.status == "success") {
		gameData = data.gameData;

		// initial fetch of any live games
		$.ajax({
			headers: { 'Authorization': 'Bearer ' + token },
			type: 'GET',
			url: 'https://heroesshare.net/twitchext/fetch/' + channel,
			dataType: 'json',
			success: updateTables,
			error: logError
		});

	} else {
		disappear();
		twitch.rig.log('Failed to load game data');
		console.log('Failed to load game data');
	}
}

// make whole UI go away (usually between games or in case of an error)
function disappear(data) {
	$('#main').addClass("tucked");
	$('#wrapper').hide();
}

function updateTables(data) {
	// check for errors
	if (data.status == "error") {
		twitch.rig.log('Error from application: ' + data.message);
		console.log('Error from application: ' + data.message);
		disappear();
		return;
	}
	
	// make sure there is a game
	if (typeof data.id == 'undefined' || data.id == null) {
		twitch.rig.log('No game active, hiding');
		console.log('No game active, hiding');
		disappear();
		return;
	}
	
	$('#summary').html(data.summary);
	$('#wrapper').show();
	
	// check for players endpoint (e.g. basic vs premium)
	if (typeof data.players == 'undefined' || data.players == null) {
		updateHeroes(data);
	} else {		
		updateTalents(data);
		updateHeroes(data);
		updateStats(data);
	}
}

function updateStats(data) {
	var tableLength = 8;

	twitch.rig.log('Updating stats table');
	$(".table-stats").empty();	
	
	tr = "<tr class='row-header'>";
	tr += "<th></th><th></th><th>Stats by HeroesProfile.com</th>";
	
	tr1 = tr;
	tr2 = tr;
	tr3 = tr;
	
	tally = 0;
	$.each(gameData.stats, function (statKey, statName) {
		th = "<th class='column-stat' title='"+statName+"'>"+statKey+"</th>";
		
		// add to one or all tables
		if (tally<2) {
			tr1 += th;
			tr2 += th;
			tr3 += th;
		} else if (tally > tableLength*2) {
			tr3 += th;
		} else if (tally > tableLength) {
			tr2 += th;
		} else {
			tr1 += th;
		}
		
		tally++;
	});
	tr1 += "</tr>";
	tr2 += "</tr>";
	tr3 += "</tr>";
	$('#table-stats1').append(tr1);
	$('#table-stats2').append(tr2);
	$('#table-stats3').append(tr3);

	// add a row for each player
	$.each(data.players, function (i, player) {
	
		// start building the row
		tr = "<tr class='";
		
		// set row class based on self/ally/enemy
		if (player.isSelf) {
			tr += "row-self";
		} else if (player.team == data.myTeam) {
			tr += "row-ally";
		} else {
			tr += "row-enemy";
		}
		tr += "'>";
		tr += "<td class='bar'></td>";
		
		// check for a hero
		if (typeof player.heroId !== 'undefined' && player.heroId !== null) {

			// hero icon
			hero = gameData.heroes[player.heroId];
			heroIcon = iconify("hero", hero.name, hero.icon);

			tr += "<td class='hero-column' onclick='showHero("+player.heroId+");'>";
			// hero level
			if (typeof player.heroLevel !== 'undefined' && player.heroLevel !== null) {
				tr += "<span class='hero-level'>"+player.heroLevel+"</span>";
			}
			
			// add the icon
			tr += heroIcon+"</td>";
		
			// hero and player names
			tr += "<td><span class='player-name'>"+hero.name+"</span><br />"+player.shortname+"</td>";
			
		} else {
			tr += "<td>";
			heroIcon = iconify("hero", "unknown", "unknown.png");
			
			// add the icon
			tr += heroIcon+"</td>";
		
			// player name
			tr += "<td><span class='player-name'>"+player.shortname+"</td>";
		}
		
		tr1 = tr;
		tr2 = tr;
		tr3 = tr;
				
		// track how many columns
		tally = 0;
		$.each(player.stats, function (stat, val) {

			if (val==null) {
				td = "<td class='stat-column'></td>";
			} else {
				td = "<td class='stat-column'>"+val+"</td>";
			}
			
			// add to one or both tables
			if (tally<2) {
				tr1 += td;
				tr2 += td;
				tr3 += td;
			} else if (tally > tableLength*2) {
				tr3 += td;
			} else if (tally > tableLength) {
				tr2 += td;
			} else {
				tr1 += td;
			}
			
			tally++;
		});
		
		// fill the rest of the columns
		for (j = tally; j<Object.keys(gameData.stats).length; j++) {
			td = "<td class='stat-column'></td>";
			
			// add to the correct table
			if (j > tableLength*2) {
				tr3 += td;
			} else if (j > tableLength) {
				tr2 += td;
			} else {
				tr1 += td;
			}
		}
		
		// close rows on all tables
		tr1 += "</tr>";
		tr2 += "</tr>";
		tr3 += "</tr>";
		// add to tables
		$('#table-stats1').append(tr1);
		$('#table-stats2').append(tr2);
		$('#table-stats3').append(tr3);
	});
	
}

function updateTalents(data) {

	twitch.rig.log('Updating talents table');
	$('#table-talents').empty();
	
	tr = "<tr class='row-header'>";
	tr += "<th></th><th></th><th></th>";
	tr += "<th>1</th><th>4</th><th>7</th><th>10</th>";
	tr += "<th>13</th><th>16</th><th>20</th>";
	tr += "</tr>";
	$('#table-talents').append(tr);
	
	// add a row for each player
	$.each(data.players, function (i, player) {
	
		// start building the row
		tr = "<tr class='";
		
		// set row class based on self/ally/enemy
		if (player.isSelf) {
			tr += "row-self";
		} else if (player.team == data.myTeam) {
			tr += "row-ally";
		} else {
			tr += "row-enemy";
		}
		tr += "'>";
		tr += "<td class='bar'></td>";
		
		// check for a hero
		if (typeof player.heroId !== 'undefined' && player.heroId !== null) {

			// hero icon
			hero = gameData.heroes[player.heroId];
			heroIcon = iconify("hero", hero.name, hero.icon);

			tr += "<td class='hero-column' onclick='showHero("+player.heroId+");'>";
			// hero level
			if (typeof player.heroLevel !== 'undefined' && player.heroLevel !== null) {
				tr += "<span class='hero-level'>"+player.heroLevel+"</span>";
			}
			
			// add the icon
			tr += heroIcon+"</td>";
		
			// hero and player names
			tr += "<td><span class='player-name'>"+hero.name+"</span><br />"+player.shortname+"</td>";
			
		} else {
			tr += "<td>";
			heroIcon = iconify("hero", "unknown", "unknown.png");
			
			// add the icon
			tr += heroIcon+"</td>";
		
			// player name
			tr += "<td><span class='player-name'>"+player.shortname+"</td>";
		}		
		
		// track how many talents
		tally = 0;
		$.each(player.talents, function (j, talentId) {
			talent = gameData.talents[talentId];
			
			// talent icon
			talentIcon = iconify("talent", talent.name, talent.icon, talent.name+"  "+talent.description);
			tr += "<td class='column-talent'>"+talentIcon+"</td>";
				
			tally++;
		});
		
		// fill the rest of the columns
		for (j = tally; j<7; j++) {
			tr += "<td class='column-talent'></td>";
		}
		
		// close and add to table
		tr += "</tr>";
		$('#table-talents').append(tr);
	});

}

function updateHeroes(data) {

	twitch.rig.log('Updating heroes table');
	$('#table-heroes').empty();

	// add a column for each hero (max 4 across)
	tr = "<tr>";
	tally = 0
	$.each(data.heroes, function (i, heroId) {
		// if 5th hero start a new row
		if (tally==5) {
			// close and add to table
			tr += "</tr>";
			$('#table-heroes').append(tr);
			
			// start over
			tr = "<tr>";
			tally = 0;
		}
				
		// hero icon
		hero = gameData.heroes[heroId];
		heroIcon = iconify("hero", hero.name, hero.icon);
		tr += "<td onclick='showHero("+hero.id+");'>"+heroIcon+"</td>";
		
		tally++;
	});
	
	// fill the rest of the columns
	for (j = tally; j<5; j++) {
		tr += "<td></td>";
	}

	// close and add to table
	tr += "</tr>";
	$('#table-heroes').append(tr);
	
	// build a new section for each hero card
	$.each(data.heroes, function (i, heroId) {
		hero = gameData.heroes[heroId];
		
		section = "<section class='hero' id='hero-"+hero.id+"'>";
		section += "<div class='close ui-icon ui-icon-closethick' onclick='$(\".hero\").hide();'></div>"
		
		// hero icon & name
		heroIcon = iconify("hero", hero.name, hero.icon);
		section += heroIcon;
		section += "<h2>"+hero.name+"</h2>";
		
		// ABILITIES
		section += "<div class='wrapper-abilities'>";
		section += "<h3>Abilities</h3>";
		section += "<table class='table-abilities'>";

		var type = "";
		var tally = 0;
		$.each(hero.abilities, function (i, abilityId) {
			ability = gameData.abilities[abilityId];
			
			// if type changed start a new row
			if (ability.type != type) {
				if (tally>0) {
					// fill the rest of the columns
					for (j = tally; j<4; j++) {
						section += "<td></td>";
					}

					// close the row
					section += "</tr><tr>";
				}
								
				// update last type
				type = ability.type;
				tally = 0;
			}
			
			// ability icon
			abilityIcon = iconify("ability", ability.name, ability.icon, "*"+ability.name+"*  "+ability.description);
			section += "<td>"+abilityIcon+"</td>";
			
			tally++;
		});

		// fill the rest of the columns
		for (j = tally; j<4; j++) {
			section += "<td></td>";
		}
		// close last row and the table
		section += "</tr></table>";
		// close wrapper
		section += "</div>";

		
		// TALENTS
		section += "<div class='wrapper-talents'>";
		section += "<h3>Talents</h3>";
		section += "<table class='table-talents'>";
		var level = "";
		var tally = 0;
		$.each(hero.talents, function (i, talentId) {
			talent = gameData.talents[talentId];
			
			// if level changed start a new row
			if (talent.level != level) {
				if (tally>0) {
					// fill the rest of the columns
					for (j = tally; j<5; j++) {
						section += "<td></td>";
					}

					// close the row
					section += "</tr><tr>";
				}
								
				// update last level
				level = talent.level;
				tally = 0;
				
				// start each row with level
				section += "<th>"+talent.level+"</th>";
			}
			
			// talent icon
			talentIcon = iconify("talent", talent.name, talent.icon, talent.name+"  "+talent.description);
			section += "<td>"+talentIcon+"</td>";
			
			tally++
		});

		// fill the rest of the columns
		for (j = tally; j<5; j++) {
			section += "<td></td>";
		}
		// close last row and the table
		section += "</tr></table>";
		// close wrapper
		section += "</div>";
		
		// close out section
		section += "</section>";
		
		// add it to the main div
		$("#main").append(section);
	});
}

$(function() {
    // listen for incoming broadcast message from our EBS
    twitch.listen('broadcast', function (target, contentType, data) {
        twitch.rig.log('Received broadcast live update');
        console.log(data);
        updateTables(JSON.parse(data));
    });
	
	// pre-load game data to reduce PubSub body message size
	$.ajax({
		headers: { 'Authorization': 'Bearer 123456789' },
		type: 'GET',
		url: 'https://heroesshare.net/twitchext/gamedata',
		dataType: 'json',
		success: cacheGameData,
		error: logError
	});

	$(document).tooltip({
		show: false,
		classes: { "ui-tooltip": "highlight" }
	});
	$("#controls span").button();
});

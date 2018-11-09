
function logError(_, error, status) {
	addLog('EBS request returned '+status+' ('+error+')');
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
		success: processGame,
		error: logError
	});
	
	initialized = true;
}

// load game data and save it
function cacheGameData() {
	// success = save data and update tables
	// error = log and hide
	$.ajax({
		headers: { 'Authorization': 'Bearer ' + token },
		type: 'GET',
		url: 'https://heroesshare.net/twitches/gamedata',
		dataType: 'json',
		success: function(data) {
			gameData = data.gameData;
			updateTables();
		},
		error: function(data) {
			initialized = false;
			addLog('Failed to load game data');
			disappear();
		},
	});

}
	
// make whole UI go away (usually between games or in case of an error)
function disappear(data) {

	$('#main').addClass("tucked");
	$('#wrapper').hide();
	
}

// enables dynamically-created hero icons to be pushed to show hero card
function enableHeroButtons() {

	$(".hero-button").click(function() {
		// figure out hero ID
		target = $(this).attr("id");
		target = target.split('-')[1];
		showHero(target);
	});
	
}

// receives AJAX response data and figures out state
function processGame(data) {
	// log any response
	if (data.messsage) {
		addLog(data.status+": "+data.message)
	}
	
	// check for errors
	if (data.status != "success") {
		currentGame = false;
		disappear();
		return;
	}
	
	// failsafe check for missing game
	if (typeof data.id == 'undefined' || data.id == null) {
		addLog("Invalid data returned from EBS");
		
		currentGame = false;
		disappear();
		return;
	}
	
	// we have a game!
	currentGame = data;
	
	// if game data hasn't been loaded, fetch it and quit
	// cacheGameData will call updateTables
	if (gameData.length == 0) {
		cacheGameData();
		return true;
	}
	
	// update the tables with current game info
	updateTables();
}

// formats current game info for display
function updateTables() {

	// make sure game info made it
	if (! currentGame) {
		addLog("Attempt to update tables without current game");
		disappear();
		return;
	}
	
	// add the summary and bring up the display
	$('#summary').html(currentGame.summary);
	$('#wrapper').show();
	
	// figure out what to display	
	// check for players endpoint
	if (! currentGame.players) {
		playersFlag = false;
	} else {
		playersFlag = true;
	}
	
	// check for heroes endpoint
	if (! currentGame.heroes) {
		heroesFlag = false;
	} else {
		heroesFlag = true;
	}

	// if both endpoints present display all panels and controls
	if (playersFlag && heroesFlag) {
		updateStats();
		updateTalents();
		updateHeroes();
		
		$("#controls").show();
		$("#main").show();
	}
	
	// if only one endpoint, display the corresponding panel and hide others
	else if (playersFlag) {
		$("#controls").hide();
		$('.panel').hide();
		$('#table-stats').show();
		
		updateStats();
		$("#main").show();
	}
	
	// if only one endpoint, display the corresponding panel and hide others
	else if (heroesFlag) {
		$("#controls").hide();
		$('.panel').hide();
		$('#table-heroes').show();
		
		updateHeroes();
		$("#main").show();
	}
	
	// no endpoints, hide main (leave wrapper for summary)
	else {
		$("#main").hide();		
	}
	
}

function updateStats() {
	var tableLength = 8;

	twitch.rig.log('Updating stats table');
	$("#table-stats").empty();	
	
	tr = "<tr class='row-header'>";
	tr += "<th colspan='3'>Stats by HeroesProfile.com</th>";
		
	tally = 0;
	$.each(gameData.stats, function (statKey, statName) {
		if (tally < 6) {
			tr += "<th class='column-stat'>"+statName+"</th>";
		} else if (tally == 6) {
			tr += "<th>";
			tr += "<select id='stat-select'>";
			tr += "<option value='-1'>Hero & mode average:</option>";
		}
		
		if (tally >= 6) {
			tr += "<option value='"+tally+"'>"+statName+"</option>";
		}
		
		tally++;
	});
	tr += "</select></tr>";
	$('#table-stats').append(tr);

	// add a row for each player
	$.each(currentGame.players, function (i, player) {
	
		// start building the row
		tr = "<tr class='";
		
		// set row class based on self/ally/enemy
		if (player.isSelf) {
			tr += "row-self";
		} else if (player.team == currentGame.myTeam) {
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

			tr += "<td class='column-hero hero-button' id='stats"+i+"hero-"+player.heroId+"'>";
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
						
		// track how many columns
		tally = 0;
		$.each(player.stats, function (stat, val) {
			
			if (tally < 6) {
				tr += "<td class='column-stat'>"+val+"</td>";
			} else if (tally == 6) {
				tr += "<td class='column-stat'>";
			}
			
			if (tally >=6) {
				tr += "<span class='stat-extra stat-extra-"+tally+"'>"+val+"</span>";
			}
			
			tally++;
		});
	
		// close column and row and add to table
		tr += "</td></tr>";
		$('#table-stats').append(tr);
		
	});
	
	enableHeroButtons();
	
	// enable stats dropdown
	$("#stat-select").change(function() {
		$(".stat-extra").hide();
		$(".stat-extra-"+this.value).show();
	});
	
}

function updateTalents() {

	twitch.rig.log('Updating talents table');
	$('#table-talents').empty();
	
	tr = "<tr class='row-header'>";
	tr += "<th></th><th></th><th></th>";
	tr += "<th>1</th><th>4</th><th>7</th><th>10</th>";
	tr += "<th>13</th><th>16</th><th>20</th>";
	tr += "</tr>";
	$('#table-talents').append(tr);
	
	// add a row for each player
	$.each(currentGame.players, function (i, player) {
	
		// start building the row
		tr = "<tr class='";
		
		// set row class based on self/ally/enemy
		if (player.isSelf) {
			tr += "row-self";
		} else if (player.team == currentGame.myTeam) {
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

			tr += "<td class='column-hero hero-button' id='talents"+i+"hero-"+player.heroId+"'>";
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
			tooltip = talent.name.toUpperCase()+": ";
			if (talent.cooldown != null)
				tooltip += "Cooldown: "+talent.cooldown+"s. ";
			tooltip += talent.description;
			
			talentIcon = iconify("talent", talent.name, talent.icon, tooltip);
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

	enableHeroButtons();
}

function updateHeroes() {

	twitch.rig.log('Updating heroes table');
	$('#table-heroes').empty();

	// add a column for each hero (max 4 across)
	tr = "<tr>";
	tally = 0
	$.each(currentGame.heroes, function (i, heroId) {
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
		tr += "<td class='hero-button' id='heroes"+i+"hero-"+hero.id+"'>"+heroIcon+"</td>";
		
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
	$.each(currentGame.heroes, function (i, heroId) {
		hero = gameData.heroes[heroId];
		
		section = "<section class='hero' id='hero-"+hero.id+"'>";
		section += "<div class='close ui-icon ui-icon-closethick'></div>"
		
		// hero icon & name
		heroIcon = iconify("hero", hero.name, hero.icon);
		section += "<h2>"+hero.name+"<br />"+heroIcon+"</h2>";
		
		// ABILITIES
		section += "<div class='wrapper-abilities'>";
		section += "<h3>Abilities</h3>";
		section += "<table class='table-abilities'>";
		section += "<tr><th>basic</th>"
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
					section += "</tr><tr><th>"+ability.type+"</th>";
				}
								
				// update last type
				type = ability.type;
				tally = 0;
			}
			
			// ability icon
			tooltip = ability.name.toUpperCase()+": ";
			if (ability.cooldown != null)
				tooltip += "Cooldown: "+ability.cooldown+"s. ";
			if (ability.manaCost != null)
				tooltip += ability.manaCost+" Mana. ";
			tooltip += ability.description;
			
			abilityIcon = iconify("ability", ability.name, ability.icon, tooltip);
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
			talentIcon = iconify("talent", talent.name, talent.icon, talent.name.toUpperCase()+":  "+talent.description);
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
		
	// enable close buttons
	$(".close").click(function() {
		$(".hero").hide();
	});
	enableHeroButtons();
}

// creates a standardized image element
// uses onError to fall back to remote icon when missing from Twitch CDN
function iconify(target, name, file, tooltip) {
	var remoteIconsDir = "https://heroesshare.net/assets/icons/";
	
	// start building the tag
	img = '<img class="icon icon-'+target+'" src="';
	
	if (target == "hero") {
		imgSrc = "heroes/"+file;
	} else if (target == "ability") {
		imgSrc = "talents/"+file;
	} else {
		imgSrc = "talents/"+file;
	}
	img += imgSrc+'" alt="'+imgSrc+'"';
	
	if (tooltip) {
		img += ' title="'+tooltip+'"';
	}
	img += " onerror=\"$(this).src='"+remoteIconsDir+"'+$(this).attr('alt');\" />";
	
	return img;
}

// show a hero card
function showHero(heroId) {
	// hide any other cards
	$(".hero").hide();
	// show this one
	$("#hero-"+heroId).show();
}

$(function() {

    // listen for incoming broadcast message from EBS
    twitch.listen('broadcast', function (target, contentType, data) {
        addLog("Received broadcast live update");
        processGame(JSON.parse(data));
    });
	
	// make the display more obvious when extension icon is hovered
	twitch.onHighlightChanged(function(hovered) {
		if (hovered) { alert("hi"); } else { alert("bye"); }
	});
	
	// enable JQueryUI tooltips
	$(document).tooltip({
		show: false,
		classes: { "ui-tooltip": "highlight" }
	});

	// clickbar to toggle display
	$("#clickbar").click(function() {
		$("#main").toggleClass('tucked');
	});
	// X to hide display
	$("#tuck").click(function() {
		$("#main").addClass('tucked');
	});
	 
	// setup buttons
	$("#controls span").button();
	$("#controls span").click(function() {
		
		// figure out target
		target = $(this).attr("id");
		target = target.split('-')[1];
		
		// display target and hide others
		$(".panel").hide();
		$("#table-"+target).show();
		
	});
	
});

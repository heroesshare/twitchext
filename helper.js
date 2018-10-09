var server = "https://heroesshare.net";
var assetsDir = server+"/assets";

var heroesDir = assetsDir+"/icons/heroes";
var abilitiesDir = assetsDir+"/icons/talents";
var talentsDir = assetsDir+"/icons/talents";

// creates a standardized image element
function iconify(target, name, file, tooltip) {
	// start building the tag
	img = '<img class="icon icon-'+target+'" src="';
	
	if (target == "hero") {
		img += heroesDir;
	} else if (target == "ability") {
		img += abilitiesDir;
	} else {
		img += talentsDir;
	}
	img += '/'+file+'" alt="'+name+'"';
	
	if (tooltip) {
		img += ' title="'+tooltip+'"';
	}
	img += ' />';
	
	return img;
}

// show a hero card
function showHero(heroId) {
	// hide any other cards
	$(".hero").hide();
	// show this one
	$("#hero-"+heroId).show();
}

//Copyright 2015 Kyle Smith
//This is an example config for node-steam-profilecheck
//This is a module that checks steam API and optionally steamrep for scammers and private profiles
//If a user adds the provided with a scammer, private profile, no community profile the request is denied
//Minimal documentation is available here
//For more detailed documentation, please visit the GitHub wiki
//https://github.com/dragonbanshee/node-steam-profilecheck


var ProfileCheck = require('../'); //change to steam-profilecheck if not running from same directory

var Bot = new ProfileCheck('username', 'password', { //enter username and password here
	guardCode: '55QKD', //steam-guard code, comment out when sentry file is generated
	
	//General profile options
	gamesPlayed: [440], //array of appid integers for the bot to idle in
	sentryfile: 'username.sentry', //the filename of the sentry file containing the steamguard information
	steamrep: true, //whether to check steamrep for scammer status
	
	//Logger options, optional
	log_colorize: true, //whether to color the logs
	log_timestamp: true, //whether to inclue timestamps in the console
});

Bot.connect(); //call connect on your Bot object to connect to steam and login 
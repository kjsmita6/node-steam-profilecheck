var Steam = require('steam');
var Winston = require('winston');
var Request = require('request');
var GetSteamAPIKey = require('steam-web-api-key');
var SteamWebLogOn = require('steam-weblogon');
var fs = require('fs');
var crypto = require('crypto');

var ProfileCheck = function(username, password, options) {
	var that = this;
	
	this.username = username;
	this.password = password;
	this.options = options;
	
	this.steamClient = new Steam.SteamClient();
	this.steamUser = new Steam.SteamUser(that.steamClient);
	this.steamFriends = new Steam.SteamFriends(that.steamClient);
	
	this.steamWebLogOn = new SteamWebLogOn(that.steamClient, that.steamUser);
	
	this.logger = new Winston.Logger;
	
	this.apiKey = undefined;
	this.gamesPlayed = options.gamesPlayed || [];
	this.sentryfile = options.sentryfile || username + '.sentry';
	this.guardCode = options.guardCode || undefined;
	this.steamrep = options.steamrep || true;
	
	this.logger.add(Winston.transports.Console, {
		colorize: options.log_colorize ? options.log_colorize : true,
		timestamp: options.log_timestamp ? options.log_timestamp : true,
		level: 'silly',
		json: false
	});
	
	if(fs.existsSync(this.sentryfile)) this.logger.info('Using sentryfile as defined by options: ' + this.sentryfile);
	else this.logger.warn('Sentry file ' + this.sentryfile + ' doesn\'t exist and will be created on successful logon');
	
	this.steamClient.on('error', function() { that._onError(); });
	this.steamClient.on('connected', function() { that._onConnected(); });
	this.steamClient.on('loggedOff', function(res) { that._onLoggedOff(res); });
	this.steamClient.on('debug', that.logger.silly);
	this.steamClient.on('logOnResponse', function(res) { that._onLogOnResponse(res); });

	this.steamUser.on('updateMachineAuth', function(sentry, callback) { that._onUpdateMachineAuth(sentry, callback); });

	this.steamFriends.on('friend', function(steamID, relationship) { that._onFriend(steamID, relationship); });
}

var prototype = ProfileCheck.prototype;

prototype.connect = function() {
	this.steamClient.connect();
	this.logger.debug('Connecting to Steam network...');
}

prototype.logOn = function() {
	var that = this;
	var sha = '';
	this.logger.debug('Logging in bot ' + this.username);
	try {
		if(this.guardCode) {
			if(fs.existsSync(that.sentryfile)) {
				var file = fs.readFileSync(that.sentryfile);
				sha = crypto.createHash('sha1').update(file).digest();
			}
			this.steamUser.logOn({
				account_name: that.username,
				password: that.password,
				auth_code: that.guardCode,
				sha_sentryfile: sha
			});
		}
		else {
			if(fs.existsSync(that.sentryfile)) {
				var file = fs.readFileSync(that.sentryfile);
				sha = crypto.createHash('sha1').update(file).digest();
			}
			this.steamUser.logOn({
				account_name: that.username,
				password: that.password,
				sha_sentryfile: sha
			});
		}
	}
	catch(e) {
		this.logger.error('Error logging in: ' + e);
		process.exit(1);
	}
}

prototype.playGame = function(games) {
	this.steamUser.gamesPlayed({ 'games_played': [{ 'game_id': parseInt(games.toString()) }] });
	this.logger.debug('Playing game(s) ' + games.toString());
}

prototype.checkProfile = function(steamID) {
    var that = this;
	var scammer;
	var privateprofile;
	var createdprofile;
	if(this.steamrep) {
		Request({
			method: 'GET',
			encoding: 'utf8',
			uri: 'http://steamrep.com/api/beta/reputation/' + steamID + '?json=1&extended=1',
			json: true,
			followAllRedirects: true,
		}, function (error, response, body) {
			if (error) {
				that.logger.error(error);
			}
			else {
				var status = body.steamrep.reputation;
				var re = /scammer/ig;
				if (re.test(status)) {
					scammer = true;
				}
				else {
					scammer = false;
					Request({
						method: 'GET',
						encoding: 'utf8',
						uri: 'http://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=' + that.apiKey + '&steamids=' + steamID,
						json: true,
						followAllRedirects: true
					}, function (error, response, body) {
						if (error) that.logger.error(error);
						else {
							var CVS = body.response.players[0].communityvisibilitystate;
							if (CVS !== 3) {
								privateprofile = true;
							}
							else {
								privateprofile = false;
								var PS = body.response.players[0].profilestate;
								if(PS !== 1) {
									createdprofile = false;
								}
								else {
									createdprofile = true;
								}
							}
						}
					});
				}
			}
		});
		setTimeout(function() {
			if (!createdprofile || scammer || privateprofile) {
				that.steamFriends.removeFriend(steamID);
				that.logger.warn('Scammer/no profile/level 0 with steamID ' + steamID + ' added me, denying.');
			}
			else {
				that.logger.info('No scammer/public profile/created profile with steamID ' + steamID + ' added me, doing nothing');
			}
		}, 3000);
	}
	else {
		Request({
			method: 'GET',
			encoding: 'utf8',
			uri: 'http://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=' + that.apiKey + '&steamids=' + steamID,
			json: true,
			followAllRedirects: true
		}, function (error, response, body) {
			if (error) that.logger.error(error);
			else {
				var CVS = body.response.players[0].communityvisibilitystate;
				if (CVS !== 3) {
					privateprofile = true;
				}
				else {
					privateprofile = false;
					var PS = body.response.players[0].profilestate;
					if(PS !== 1) {
						createdprofile = false;
					}
					else {
						createdprofile = true;
					}
				}
			}
		});
		
		setTimeout(function() {
			if (!createdprofile || privateprofile) {
				that.steamFriends.removeFriend(steamID);
				that.logger.warn('No profile/level 0 with steamID ' + steamID + ' added me, denying.');
			}
			else {
				that.logger.info('Public profile/created profile with steamID ' + steamID + ' added me, doing nothing');
			}
		}, 3000);
	}
}
		
		
		
		
//Event handlers 

prototype._onError = function() {
	this.logger.error('Disconnected from Steam, reconnecting...');
	this.connect();
}

prototype._onConnected = function() {
	this.logger.debug('Connected to Steam, logging in...');
	this.logOn();
}

prototype._onLoggedOff = function(res) {
	this.logger.warn('Logged off for reason: ' + res);
	this.logOn();
}

prototype._onLogOnResponse = function (response) {
    var that = this;
    if (response.eresult === Steam.EResult.OK) {
        this.logger.info('Logged into Steam!');
        this.steamUser.gamesPlayed({ 'games_played': [{ 'game_id': parseInt(that.gamesPlayed.toString()) }] });
        this.steamWebLogOn.webLogOn(function (webSessionID, cookies) {
            GetSteamAPIKey({
                sessionID: webSessionID,
                webCookie: cookies
            }, function (e, api) {
                if (e) that.logger.error(e);
                else {
                    that.apikey = api;
                    that.logger.info('Logged into steam web');
                }
            });
        });
    }
    else {
        this.logger.warn(response.eresult);
		process.exit(1);
    }
}

prototype._onUpdateMachineAuth = function(sentry, callback) {
	var that = this;
	this.logger.debug('New sentry: ' + sentry.filename);
	fs.writeFileSync(this.sentryfile, sentry.bytes);
	
	callback({
		sha_file: crypto.createHash('sha1').update(sentry.bytes).digest()
	});
}

prototype._onFriend = function(steamID, relationship) {
	var that = this;
	if(relationship === Steam.EFriendRelationship.RequestRecipient) {
		this.logger.debug('User with steamID ' + steamID + ' added me, checking profile...');
		this.checkProfile(steamID);
	}
}

module.exports = ProfileCheck;		
/*
 * Trello burndown chart generator
 *
 * Author: Norbert Eder <wpfnerd+nodejs@gmail.com>
 */
var fs = require('fs');
var path = require('path');

var CardStatistics = function() { }

CardStatistics.prototype.generate = function(cards, finishList, standuptime, callback) {
	var data = {
		"estimate": 0,
		"estimatedone": 0,
		"efforttotal": 0,
		"cardsopen": 0,
		"cardsfinished": 0,
		"effort": []
	};

	var standup = !standuptime ? standuptime : new Date("1970-01-01T" + standuptime);

	if (standup) {
		standup = new Date(0,0,0,standup.getHours(), standup.getMinutes(), 0);
	}

	var reg_std = /^\[(\d+)\|(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)\]\s*(.*)$/;
    // the "scrum for trello" chrome extension just requires points in parentheses prefixing the card title
    var reg_chrome_scrum_for_trello = /^\(([^\)]+)\)\s*(.*)$/;
    var reg = reg_chrome_scrum_for_trello;

	for (var i = 0; i < cards.length; i++) {
		var card = cards[i];

		var title = card.name;
		console.log(title);
		var matches = reg.exec(title);

		if (matches.length > 1) {
            console.log('found matches');
            var prio = 1;
            var estimate = parseFloat(matches[1]);
            var effort = card.actions && card.actions[idxActions].data.listAfter.name === finishList ? True : False;
			//var prio = matches[1];		
			//var estimate = parseFloat(matches[2]);
			//var effort = parseFloat(matches[3]);
            console.log('card: '  + card);
            console.log('est: ' + estimate + ', effort: ' + effort);

			var isCardFinished = false;
			var isCardOpen = false;

			if (card.actions) {
                console.log( 'card actions');
				for (var idxActions = 0; idxActions < card.actions.length; idxActions++) {
					if (card.actions[idxActions]) {
						if (card.actions[idxActions].data.listAfter 
							&& card.actions[idxActions].data.listBefore
							&& card.actions[idxActions].data.listAfter.name === finishList) {

							var date = new Date(Date.parse(card.actions[idxActions].date));
							var cleanDate = getRelatingDay(date, standup);

							if (!data.effort.length) {
								data.effort[0] = { date: cleanDate, estimate: estimate, effort: effort };
							} else {
								var found = false;
								for (var idxEffort = 0; idxEffort < data.effort.length; idxEffort++) {
									if (Date.parse(data.effort[idxEffort].date) === Date.parse(cleanDate)) {
										data.effort[idxEffort].estimate += estimate;
										data.effort[idxEffort].effort += effort;
										found = true;
									}
								}
								if (!found) {
									data.effort[data.effort.length] = { date: cleanDate, estimate: estimate, effort: effort };
								}
							}
							isCardFinished = true;
							data.efforttotal += effort;
							data.estimatedone += estimate;
						} else {
							isCardOpen = true;
						}
					}
				}
			}

			if (isCardFinished)
				data.cardsfinished += 1;
			if (isCardOpen)
				data.cardsopen += 1;

			data.estimate += estimate;
		}
	}
	callback(null, data);
}

function getRelatingDay(date, standuptime) {
	if (standuptime) {
		var standup = new Date(date.getFullYear(), date.getMonth(), date.getDate(), standuptime.getHours(), standuptime.getMinutes(), 0);
		
		if (Date.parse(date) <= Date.parse(standup)) {
			var returnDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
			returnDate = new Date(returnDate.setDate(returnDate.getDate() - 1));

			return returnDate;
		}
	}
	return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

CardStatistics.prototype.export = function(data, resources, days, name, callback) {
	var statsData = [];
	var plannedDays = getPlannedDays(resources);
	var averageDayEffort = data.estimate / plannedDays;

	var plannedDaysCount = 0;
	var openEstimate = data.estimate;
	var totalEffort = 0;

	for (var date = 0; date < days.length; date++) {
		var dateToReceive = new Date(Date.parse(days[date]));
		var effortContent = getDateData(dateToReceive, data.effort);
		
		plannedDaysCount += Math.floor(resources[date]);

		if (!effortContent) {
			statsData[date] = { day: date, date: dateToReceive, totalEstimate: data.estimate, idealEstimate: data.estimate - (averageDayEffort * plannedDaysCount), openEstimate: openEstimate, doneEstimate: 0, effort: 0, totalEffort: totalEffort };
		} else {
			totalEffort += effortContent.effort;
			openEstimate = openEstimate - effortContent.estimate;
			statsData[date] = { day: date, date: dateToReceive, totalEstimate: data.estimate, idealEstimate: data.estimate - (averageDayEffort * plannedDaysCount), openEstimate: openEstimate, doneEstimate: effortContent.estimate, effort: effortContent.effort, totalEffort: totalEffort };
		}
	}

	saveJSON(settings.exportPath, statsData, name, callback);
}

function saveJSON(dir, data, name, callback) {
	if (!fs.existsSync(dir)) {
		fs.mkdirSync(dir);
	}
	var dir = path.join(dir, name + '.json');

	var jsonData = JSON.stringify(data, null, 4);
	fs.writeFile(dir, jsonData, function(err) {
		callback(err);
	})
}

function getPlannedDays(resourceArray) {
	var plannedDays = 0;
	for (var i = 0; i < resourceArray.length; i++) {
		plannedDays += Math.floor(resourceArray[i]);
	}
	return plannedDays;
}

function getDateData(date, stats) {
	var compareDate = Date.parse(new Date(date.getFullYear(), date.getMonth(), date.getDate()));
	for (var i = 0; i < stats.length; i++) {
		var statsDate = Date.parse(new Date(stats[i].date.getFullYear(), stats[i].date.getMonth(), stats[i].date.getDate()));
		if (statsDate === compareDate) {
			return stats[i];
		}
	}
	return null;
}

module.exports = CardStatistics;

var codename = (function() {

	var fs = require('fs'),
		filepath = './words.txt',
		lines = fs.readFileSync(filepath,'utf-8').split("\n"),
		words = {};

	function randint(i) {
		return Math.floor(Math.random()*(i));
	}
	
	for (var i=0,max=lines.length;i<max;i+=1) {
		var line = lines[i].split(' '),
			type = line[1][0];
			if (words[type]===undefined) {
				words[type]=[];
			}
			words[type].push(line[0]);
	}

	for (var t in words) {
		if (words.hasOwnProperty(t)) {
			words[t].len = words[t].length;
		}
	}
	
	function getWordFrom(k) {
		return words[k][randint(words[k].len-1)].toLowerCase();
	}
	
	var adverb = ['A','V'];
	
	return function() {
		var wordup = [];
		wordup.push(getWordFrom(adverb[randint(1)]));
		wordup.push(getWordFrom('N'));
		return wordup.join('_');
	};
	
})();

exports.codename = codename;
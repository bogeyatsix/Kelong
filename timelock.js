exports.Timelock = function() {
	// TODO: Delete specific/expired timelocks
	var timelocks = {},
		EventEmitter = require('events').EventEmitter,
		events = new EventEmitter(),
		timeToRelease = null,
		that = this;

	events.setMaxListeners(0);

	var re, valids = [],
		days_of_week = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
	
	[0,1,2,3,4,5,6,7,8,9,10,11].forEach(function(i) {
		valids.push(new Date(new Date().setMonth(i)).toString().split(' ')[1])
	});
	
	re = new RegExp('^'
			+
			valids.concat(days_of_week).join('|')
			+
			'[1-31]?$');
	
	this.onActive = function(callback) {
		events.on('active',callback);
	};

	this.onInactive = function(callback) {
		events.on('inactive',callback);
	};

	this.add = function(s) {
		// Jun24:0800-0900
		// Fri:1230-1500
		var sss = [], heads_tail, heads, head, tail, entry;
		if (s.match(/Everyday/)) {
			s = s.replace(/Everyday/,days_of_week.join(','));
		}
		if (s.match(/,/)) {
			heads_tail = s.split(':');
			heads = heads_tail[0].split(",");
			tail = heads_tail[1];
			for (var i=0,max=heads.length;i<max;i+=1) {
				head = heads[i];
				sss.push(head+':'+tail)
			}
		} else {
			sss.push(s);
		}
		var done = [], sooner, later;
		for (var i=0,max=sss.length;i<max;i+=1) {
			s = sss[i];
			if (s.match(/^\w\w\w\d?\d?:\d\d\d\d-\d\d\d\d/) &&
				re.test(s.split(':')[0])) {
				heads_tail = s.split(':');
				head = heads_tail[0];
				tail = heads_tail[1].split('-');
				sooner = tail[0];
				later = tail[1];
				later = /0000/.test(later) ? '2359' : later;
				if (later > sooner) {
					if (typeof timelocks[head]==='undefined') { timelocks[head] = []; }
					done.push(s);
					timelocks[head].push([sooner,later]);
				}
			}
		}
		if (done.length===sss.length) {
			return timelocks;
		} else {
			return null;
		}
	};

	this.active = function() {
		var d = new Date().toLocaleString().split(' '),
			k1 = d[0],
			k2 = d[1]+d[2],
			now = d[4].split(':').slice(0,2).join(''),
			lookup = [timelocks.hasOwnProperty(k1),timelocks.hasOwnProperty(k2)],
			times = {
				'true,false':timelocks[k1],
				'false,true':timelocks[k2],
				'true,true':function() { timelocks[k1].concat(timelocks[k2]) },
				'false,false':[]}[lookup];
		times = typeof times==='function' ? times() : times;
		for (var i=0,max=times.length;i<max;i+=1) {
			var range = times[i],
				sooner = range[0],
				later = range[1],
				inside = now <= later && now >= sooner;
				//console.log(now+':'+sooner+':'+later);
				if (inside) {
					timeToRelease = later;
					return true;
				}
		}
		return false;
	};
	
	this.show = function() {
		return timelocks;
	};

	setInterval(function(){
		if (that.active()) {
			events.emit('active',timeToRelease);
		} else {
			events.emit('inactive');
		}
	},1000);

};

/*

var tc = require('./timelock') ;
var timelocks = new tc.Timelock() ;

timelocks.onActive(function() {
	console.log("Yes!");
});

//console.log(timelocks.add("Sat:0300-0330")); // null
//console.log(timelocks.add("July21:1200-1230"));	// null
console.log(timelocks.add("Everyday:2200-0000"));

*/














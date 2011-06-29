var Advertisement = function(config) {

	if (typeof(config.txt_record)!=='undefined') {
		for (var k in config.txt_record) {
			if (config.txt_record.hasOwnProperty(k)){
				config.txt_record[k] = String(config.txt_record[k]);
			}
		}
	}
	
	var sys = require('sys'),
		mdns = require('mdns'),
		ad = mdns.createAdvertisement(config.type, config.port, undefined, 
			undefined, undefined, config.name, undefined, config.address, config.txt_record,
			function(err, info, flags) {
				sys.puts("==== up");
				if (err) {
					assert.fail(err);
				} else {
					sys.puts('Advertising', sys.inspect(info));
				}
			});

	this.start = function() { ad.start(); };
	this.stop = function() { ad.stop(); };
};

var CouchReplicator = function(config) {
	
	var self = config;

	var sys = require('sys'),
		mdns = require('mdns'),
		app = require('express').createServer(),
		agent = require('superagent'),
		urlopen = require('open-uri'),
		couch_replicate_url = 'http://127.0.0.1:PORT/_replicate'.replace('PORT',self.couchPort),
		discovered_services = {},
		harem = {},
		mates = {};
	
	var	serv_config = {}; // Bonjour service registration info
		serv_config.type = 'couchdb';
		serv_config.name = self.hostname;
		serv_config.address = self.address;
		serv_config.port = self.couchPort;
		serv_config.txt_record = {
			dbname:self.dbname,
			couchport:self.couchPort,
			httpport:self.httpPort
		};

	var	listener = mdns.createBrowser(serv_config.type,'tcp'),
		advertisement = new Advertisement(serv_config);

	function start() {
		sys.puts(sys.inspect(self));
		app.listen(self.httpPort);
		advertisement.start();
		listener.start();
	}

	function service_pullable(name){
		if ((Object.keys(harem).length < 2) && (!harem.hasOwnProperty(name))) {
			return true;
		} else {
			return false;
		}
	}

	function harem_add(res,name,options) {
		if (JSON.parse(res.body).hasOwnProperty('ok')){
			sys.puts("Started pulling "+name);
			harem[name] = options;
			sys.puts("HAREM: "+JSON.stringify(Object.keys(harem)));
		}
	}

	function json_post(url,options,callback,callback_args){
		console.log(url);
		console.log(options);
		agent
		.post(url)
		.json(options)
		.parse()
		.on('response', function(res){
			res.on('end', function(){
				if (typeof(callback_args)==='undefined'){
					callback(res);
				} else {
					callback_args.unshift(res);
					callback.apply(null,callback_args);
				}
			});
		 }).end();
	}

	function capture(serv){
		if (service_pullable(serv.name)) {
			urlopen(serv.remote_req_url, function(e,data) {
				if (JSON.parse(data).hasOwnProperty('ok')) {
					json_post(couch_replicate_url,
								serv.options,
								harem_add,
								[serv.name,serv.options]);
				}
			});
		}
	}

	function prowl() {
		setTimeout(function(){
			for (var name in discovered_services) {
				if (discovered_services.hasOwnProperty(name)) {
					capture(discovered_services[name]);
				}
			}
		},5*1000);
	}

	listener.on('serviceUp', function(info, flags) {
		var	hosttarget = info.hosttarget.slice(0,-1),
			remotehost = "http://"+hosttarget,
			rec = info.txt_record,
			remote_db_url = remotehost+":"+rec.couchport+"/"+self.db,
			serv = {};
			console.log(JSON.stringify(info));
			serv.name = info.name;
			serv.remote_req_url = remotehost+":"+rec.httpport+"/iwtfu/"+self.hostname;
			serv.options = {
				source:remote_db_url,
				target:couch_replicate_url.replace('_replicate',self.db),
				continuous:true
			};
		if (serv.name !== self.hostname) {
			discovered_services[serv.name] = serv;
			capture(serv);
		}
	});
	
	listener.on('serviceDown', function(info, flags) {
		var name = info.name,
			options;
		if (harem.hasOwnProperty(name)) {
			options = harem[name];
			options.cancel = true;
			json_post(couch_replicate_url,options,function(res){
				delete harem[name];
				sys.puts("Banished widow..."+name);
			});
		}
		if (mates.hasOwnProperty(name)) {
			delete mates[name];
			sys.puts("Lost mate..."+name);
		}
		delete discovered_services[name];
		prowl(); // Whenever a service goes down, some nodes become widows.
	});

	app.get('/iwtfu/:target', function(req, res){
		var len_mates = Object.keys(mates).length,
			target = req.params.target,
			_res;
		if ((len_mates < 2) && (!mates.hasOwnProperty(target))) {
			mates[target] = null;
			sys.puts("MATES: "+JSON.stringify(Object.keys(mates)));
			_res = {ok:'replicate granted'};
		} else {
			_res = {notok:'fully mated'};
		}
		res.send(JSON.stringify(_res));
	});

	start();

};

exports.start = function(myconfig) {

	if (myconfig===undefined) { 
		myconfig={};
	}
	
	var sys = require('sys'),
		os = require('os'),
		socket = new require('net').Socket(),
		hostname = os.hostname().split(".")[0],
		couchReplicator,
		config = {};
		config.hostname = typeof(myconfig.hostname)!=='undefined' ? myconfig.hostname : hostname;
		config.dbname = typeof(myconfig.db)!=='undefined' ? myconfig.db : 'testdb';
		config.couchPort = typeof(myconfig.couchPort)!=='undefined' ? myconfig.couchPort : 5984;
		config.httpPort = typeof(myconfig.httpPort)!=='undefined' ? myconfig.httpPort : 3000;
		config.address = '0.0.0.0';
	
	socket.addListener('error', function(socketException){
		if (socketException.errno === 61 /*ECONNREFUSED*/) {
			sys.puts("Cannot resolve LAN IP.");
		} else {
			sys.puts(socketException);
		}
		sys.puts("Check net connection.");
		process.exit(1);
	});
	
	socket.connect(80,'www.facebook.com',function(){
		var addr = socket.address().address;
		config.address = typeof(myconfig.address)!=='undefined' ? myconfig.address : addr;
		couchReplicator = new CouchReplicator(config);
	});
	
};


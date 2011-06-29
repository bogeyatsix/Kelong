/*
*	Launch with:
*		cd ~/Dropbox/kelong && spark2 -v --port 8080 -n 1 -E development --watch
*
*/

var assert = require('assert'),
	popen = require('child_process').exec,
	pathfinder = require('./pathfinder'),
	codename = require('./codename').codename,
	mdnsModules = {'darwin':'mdns_darwin', 'linux':'mdns_linux'},
	mdns = require(mdnsModules[process.platform]),
	colors = require('./colored');

for (var k in colors) {
	if (colors.hasOwnProperty(k)) {
		String.prototype[k] = colors[k];
	}
}

function elapsedSeconds(startTime) {
	return ((new Date()-startTime)/1000).toFixed(2);
}

function compareByNumericValueOfKey(name) {
	return function(a,b) {
		return a[name] - b[name];
	};
}

function checksum(o,algo) {
	var crypto = require('crypto'),
		shasum = crypto.createHash(algo),
		oo = typeof o==='string' ? o : JSON.stringify(o);
	shasum.update(oo);
	return shasum.digest('hex');
}

function checksumFile(path) {
	var	fs = require('fs'),
		crypto = require('crypto'),
		shasum = crypto.createHash('sha1'),
		data = fs.readFileSync(path);
	shasum.update(data);
	return shasum.digest('hex');
}

function randint(max) {
	return ~~(Math.random()*(max+1));
}

function randrange(min,max) {
	max+=1;
	return ~~(min+(Math.random()*(max-min)));
}

function sample(n,items,sorted) {

	function isArray(o) {
		return Object.prototype.toString.call(o)==='[object Array]';
	}

	if (!isArray(items)) {
		throw 'Object to sample from is not an Array.'; 
	}

	var i, x, c = [], s = [], v=[];

	function randint(max) {
		return ~~(Math.random()*(max));
	}
	
	if (n >= items.length) {
		return items;
	} else {
		while (c.length<n) {
			i = randint(items.length);
			if (s[i]===undefined) { s[i]=i; c.push(i); }
		}
		if (sorted) {
			for (var k in s) {
				if (s.hasOwnProperty(k)) {
					v.push(items[k]);
				}
			}
		} else {
			var max=c.length;
			for (i=0;i<max;i+=1) {
				x = c[i];
				v.push(items[x]);
			}
		}
		return v;
	}
}

function isCallable(o,prop) {
	return o.hasOwnProperty(prop) &&
			typeof o[prop] === 'function';
}

function bind(o,m) {
	return function() {
		return m.apply(o,[].slice.call(arguments));
	};
}

function for_each_in(o,callback) {

	function isArray(o) {
		return Object.prototype.toString.call(o)==='[object Array]';
	}

	if (isArray(o)) {
		for (var i=0,max=o.length;i<max;i+=1) {
			callback(o[i]);
		}
	} else {
		for (var k in o) {
			if (o.hasOwnProperty(k)) {
				callback(k,o[k]);
			}
		}
	}
}

function enumerate(o, callback) {

	function isArray(o) {
		return Object.prototype.toString.call(o)==='[object Array]';
	}

	var i = 0;
	if (isArray(o)) {
		for (var max=o.length;i<max;i+=1) {
			callback(i,o[i]);
		}
	} else {
		for (var k in o) {
			if (o.hasOwnProperty(k)) {
				callback(i,k,o[k]);
				i+=1;
			}
		}
	}
}

function collect(list, callback) {
	var newList = [];
	for_each_in(list,function(t) {
		newList.push(callback(t));
	});
	return newList;
}

function jsonclone(o) {
	var noneCallable;
	for (var k in o) {
		if (o.hasOwnProperty(k)) {
			noneCallable = !isCallable(o,k);
		}
	}
	if (noneCallable) {
		return JSON.parse(JSON.stringify(o));
	} else {
		return {};
	}
}

function isArray(o) {
	return Object.prototype.toString.call(o)==='[object Array]';
}

function Renderer() {}

Renderer.prototype.runningProc = null;

Renderer.prototype.createCommand = function(pkg) {
	return this.cmd + " " + pkg.args + " " + pkg.file;
};

Renderer.prototype.postRender = function(io, pkg, serverPostRender) {
	serverPostRender(pkg);
};

Renderer.prototype.render = function(pkg, serverPostRender) {
	var cmd = this.createCommand(pkg),
		msg = 'Rendering from batch: BATCHID id: DID'
				.replace(/BATCHID/,pkg.batchID.yellow())
				.replace(/DID/,pkg._id.cyan());
	console.log(msg+'\n'+cmd.yellow());
	var io,
		postpopen = bind(this, function(error,stdout,stderr) {
			this.runningProc = null;
			if (error &&
				error.hasOwnProperty('signal')) {
				pkg.status = 'REOPEN';                              // < BACK TO SERVER: REOPEN
				serverPostRender(pkg);
			} else {
				io = {error:error, stdout:stdout, stderr:stderr};
				this.postRender(io, pkg, serverPostRender);
			}
		});
	this.runningProc = popen(cmd, postpopen);
};

Renderer.prototype.preflight = function(pkg, serverPostRender, callback) {
	/*	Make sure the file has not changed since the time it was submitted. */
	// TODO: This feature has not yet been tested!
	if (checksumFile(pkg.file)===pkg.checksum) {
		callback();
	} else {
		pkg.status = 'BATCHFAIL';										// < BACK TO SERVER: BATCHFAIL
		pkg.render_messages = {	status:'BATCH FAIL',
								message:'File changed since submission.'};
		serverPostRender(pkg);
	}
};

Renderer.prototype.testRendererFound = function() {
	var msg = {
			'true':"GOOD: "+this.name.green(),
			'false':"BAD: "+this.name.red()
		},
		test = bind(this,function(error, stdout, stderr) {
			var re = /not found/m;
			this.ready = !re.test(stderr);
			console.log(msg[this.ready]);
		});
	popen(this.test_cmd, test);
};

Renderer.prototype.createRenderPacket = function(meta,f) {

	var	h = {};

	h.project = meta.project;
	h.shot = meta.shot;
	h.args = f.args;
	h.frame = f.frame_no;
	h.framerange = meta.framerange;
	h.batchID = meta.batchID;
	h.file = meta.file;
	h.checksum = checksumFile(h.file);
	h.password = meta.password;
	h.type = meta.type;
	h.submitted = new Date().getTime(); // Time since epoch
	h.completed = '';
	h.origin = meta.origin;
	h.status = 'OPEN';
	h.dependencies = meta.depp;
	h.handler = '';
	h.render_messages = {};
	
	return h;

};

Renderer.prototype.stringifyFlags = function(flags) {
	var return_string = "",tmp_string;
	for_each_in(flags,function(k,v) {
		tmp_string = "-"+k+" "+v.toString();
		return_string += tmp_string;
	});
	return return_string;
};

Renderer.prototype.parse = function(meta) {
	var frames = [],
		flags = "",
		range = {},
		s = null,
		e = null;
	if (meta.flags.hasOwnProperty('s') && meta.flags.hasOwnProperty('e')) {
		s = parseInt(meta.flags.s,10);
		e = parseInt(meta.flags.e,10);
		delete meta.flags.s;
		delete meta.flags.e;
	} else if (isCallable(this,'extract')) {
		range = this.extract(meta.file);
		s = range.s;
		e = range.e;
	}
	if (s!==null && e!==null) {
		flags = this.stringifyFlags(meta.flags);

		meta.batchID = meta.batchID || codename();
		meta.framerange = meta.framerange || [s,e];

		for (var frame_no=s; frame_no<(e+1); frame_no+=1) {
			var frame_specifics = {
				frame_no:frame_no
			};
			if (isCallable(this,'setRange')) {
				frame_specifics.args = this.setRange(frame_no)+" "+flags;
			} else {
				frame_specifics.args = flags;
			}
			var pkg = this.createRenderPacket(meta,frame_specifics);
			frames.push(pkg);
		}
	}
	return frames;
};

Renderer.PRMAN = function() {

	var fs = require('fs');
	
	this.name = 'prman';
	this.cmd = "prman -t:7";
	this.extensions = ["rib","alf"];
	this.test_cmd = "prman -help";
	
	function extractRibsFromAlf(filepath) {
		var ribs = [],
			lines = fs.readFileSync(filepath,'utf-8').split("\n");
		for_each_in(lines,function(line) {
			if (line.match(/Cmd/)) {
				var match = line.match(/"%D\((.+)\)" "%D\((.+)\)"/);
				if (match) {
					ribs.push([match[1],match[2]]);
				}
			}
		});
		return ribs;
	}
	
	function statPath(ribPath) {
		return ribPath.replace(/\.rib/,".xml");
	}
	
	this.setRenderThreads = function(n) {
		this.cmd = "prman -t:"+n;
	};
	
	this.createCommand = function(pkg) {
		var renderFlags = pkg.args,
			renderFile = pkg.file,
			ignore_codes = ['R56006', // Cannot write statsfile
							'R20040', // ???
							'R10012', // Previously used __instanceid provided for shader
							'R50006', // Pixar license expires in ... days.
							'T16001'  // Texture out-of-range center
							].join(","),
			final_cmd = this.cmd +  ' -woff ' +  ignore_codes,
			statsfilepath = statPath(renderFile);
		statsfilepath = 'TMP'; // Forces renderstats to STDOUT
		final_cmd += ' -statsfile ' + statsfilepath;
		final_cmd += ' ' + renderFlags + ' ' + renderFile;
		return final_cmd;
	};
	
	this.parse = function(meta) {
		var frames = [], // The return object
			ribs = [],
			texture_rib,
			pkg = {};
		
		if (meta.file.match(/\.alf/)) {
			var alf_ribs = extractRibsFromAlf(meta.file),
				depp_dupe = meta.depp.slice(),
				frame_specifics = {};
			if (alf_ribs.length!==0) {
				texture_rib = alf_ribs[0];
				
				meta.framerange = [0,0];
				meta.batchID = codename();
				meta.flags.cwd = texture_rib[0];
				meta.file = texture_rib[1];
				
				frame_specifics = { 
					frame_no:0,
					args:this.stringifyFlags(meta.flags)
				};
				
				pkg = this.createRenderPacket(meta,frame_specifics);
				frames.push(pkg);
				ribs = alf_ribs.slice(1);
				meta.depp = depp_dupe;
				meta.depp.push(meta.batchID);
			}
		} else {
			ribs = [[null, meta.file]];
		}
	
		meta.batchID = codename();
		meta.framerange = [1,ribs.length];
		
		enumerate(ribs, bind(this,function(i,rib) {
			var cwd = rib[0];
			if (cwd) {
				meta.flags.cwd = cwd;
			}
			meta.file = rib[1];
			meta.flags.s = i+1;
			meta.flags.e = i+1;
			pkg = Renderer.prototype.parse.apply(this,[meta]);
			frames = frames.concat(pkg);
		}));
		return frames;
	};
	
	this.preRender = function(pkg, serverPostRender) {
		var resolveAndRender = bind(this, function(paths) {
			var missing = [];
			for_each_in(paths.paths,function(fp,exists) {
				!exists && fp.match(/rib|tex$/) &&
				!paths.lines[fp].match(/Make/) &&
					missing.push(fp);
			});
			if (missing.length===0) {
				this.render(pkg, serverPostRender);
			} else {
				console.log("RETURNING ".red()+pkg._id);
				console.log("Missing links on this server:");
				console.log(JSON.stringify(missing,null,3));
				pkg.status = 'BAN';										// < BACK TO SERVER: BAN
				serverPostRender(pkg);
			}
		});
		this.preflight(pkg, serverPostRender, function() {
			pathfinder.resolve('rib', pkg.file, resolveAndRender);
		});
	};
	
	this.postRender = function(io, pkg, serverPostRender) {
		var render_messages = {};
		if (io.error) {
			render_messages.status = 'SYSTEM ERROR';
			render_messages.message = io.error;
			pkg.status = 'FAILED';
		} else if (io.stderr.match(/SEVERE|ERROR/)) {
			render_messages.status = 'PRMAN SEVERE';
			render_messages.messages = io.stderr;
			pkg.status = 'FAILED';
		} else {
			if (io.stderr) { 
				render_messages.status = 'COMPLETED WITH WARNINGS';
				render_messages.messages = io.stderr;
			} else {
				render_messages.status = 'PERFECT';
				render_messages.message = io.stdout;
			}
			pkg.status = 'DONE';
		}
		render_messages.fileouts = pathfinder.extractPaths(io.stdout);
		/* If this is a preprocess rib file then no output files are
		reported so we use a dummy image */
		if (render_messages.fileouts===null && 
			pkg.frame===0 &&
			pkg.status==='DONE') {
			render_messages.fileouts = [__dirname+'/root/images/alfred_dummy.jpg'];
		}
		pkg.render_messages = render_messages;
		serverPostRender(pkg);
	};

};

Renderer.MAYA = function() {
	
	this.name = 'maya';
	this.cmd = "Render -mr:rt 4 -mr:v 5";
	this.extensions = ["ma","mb"];
	this.test_cmd = "Render";
	
	this.setRange = function(i) {
		return "-s @ -e @".replace(/@/g,i);
	};
	
	this.extract = function(filepath) {
		var fs = require('fs'),
			range = {s:null,e:null},
			data = "",s,e;
		if (filepath.match(/\.ma$/)) {
			data = fs.readFileSync(filepath,'utf-8');
			s = data.match(/setAttr ".fs" (\d+)/);
			s = s ? parseInt(s[1],10) : 1;
			e = data.match(/setAttr ".ef" (\d+)/);
			e = e ? parseInt(e[1],10) : null;
			if (e) {
				range.s = s;
				range.e = e;
			}
		}
		return range;
	};
	
	this.preRender = function(pkg, serverPostRender) {
		var resolveAndRender = bind(this,function(paths) {
			var missing = [];
			for_each_in(paths.paths,function(fp,exists) {
				if (!exists) {
					missing.push(fp);
				}
			});
			if (missing.length===0) {
				this.render(pkg, serverPostRender);
			} else {
				console.log("RETURNING ".red()+pkg._id);
				console.log("Missing links on this server:");
				for_each_in(missing, function(fp) {
					console.log(fp);
				});
				pkg.status = 'BAN';											// < BACK TO SERVER: BAN
				serverPostRender(pkg);
			}
		});
		this.preflight(pkg, serverPostRender, function() {
			pathfinder.resolve('ma',pkg.file,resolveAndRender);
		});
	};
	
	this.postRender = function(io, pkg, serverPostRender) {
		var render_messages = { fileouts:[] },
			m = null;
		if (io.error) {
			render_messages.status = 'SYSTEM ERROR';
			render_messages.message = io.error;
			pkg.status = 'FAILED';
		} else {
			/* 	WARNING: When prman is invoked from/within MayaBatch,
				it generates no output and this in turn will fail.
			*/
			if (m===null) { // Match Maya Software
				m = io.stderr.match(/Finished Rendering (.+)\./);
				if (m) { render_messages.fileouts.push(m[1]); }
			}
			if (m===null) { // Match Mental Ray
				/* Output lines looks like:
					'writing frame buffer mayaColor to image file /path/to/masterLayer/sphereMR.00001.exr (frame'
					'writing frame buffer INDIRR:indirect.persp to image file /path/to/layer1/sphereMR.00001.exr (frame' 
				*/
				m = io.stderr.match(/writing.+file (.*) .frame/g);
				if (m) {
					for_each_in(m, function(line) {
						// For each line matched, get the filepath...
						var fp = line.match(/file (.+) \(frame/)[1];
						render_messages.fileouts.push(fp);
					});
				}
			}
			// Finally...
			if (render_messages.fileouts.length>0) {
				if (io.stderr.match(/Warning/g)) {
					render_messages.status = 'COMPLETED WITH WARNINGS';
				} else {
					render_messages.status = 'PERFECT';
				}
				pkg.status = 'DONE';
			} else {
				pkg.status = 'FAILED';
				delete render_messages.fileouts;
			}
			render_messages.message = io.stderr;
			pkg.render_messages = render_messages;
			serverPostRender(pkg);
		}
	};

};

Renderer.MAYA2012 = function() {
	Renderer.MAYA.apply(this);
	this.name = 'maya2012';
	this.cmd = "Render2012 -mr:rt 4 -mr:v 5";	
	this.test_cmd = "Render2012";
};

Renderer.Factory = function(constr) {
	var renderer;
	
	if (typeof Renderer[constr].prototype.render !== "function") {
		Renderer[constr].prototype = new Renderer();
	}
	
	renderer = new Renderer[constr]();	
	renderer.testRendererFound();
	return renderer;
};

function RenderServerUtils() {
	
	var sys = require('sys'),
		path = require('path');

	this.consumable = function(type,path) {
		var ext = this.renderers[type].extensions.join('|'),
			re = new RegExp('\\.(SUFFIXES)$'.replace(/SUFFIXES/,ext));
		return path.match(re) ? true : false;
	};
	
	this.available_renderers = function() {
		var available = [];
		for_each_in(this.renderers, function(type,renderer) {
			renderer.ready && available.push(type);
		});
		return available;
	};
	
	this.getStatus = function() {
		return {
			master_status:this.master_status,
			available_renderers:this.available_renderers()
		};
	};
	
	this.setStatus = function(code) {
		var stats = [];
		stats[0] = {ok:true,
					msg:'Ready to render.'};
		stats[1] = {ok:false,
					msg:'Suspended.'};
		if (typeof code==='number') {
			if (code<=stats.length-1) {
				this.master_status = stats[code];
			}
		} else {
			this.master_status = code;
		}
	};
	
	this.checkFile = function(rtype,params) {
		if (!params.hasOwnProperty('file')) {
			throw {error:"No file given."};
		}
		if (!this.consumable(rtype,params.file)) {
			throw {error:"Wrong filetype for TYPE".replace(/TYPE/,rtype)};
		}
		if (!path.existsSync(params.file)) {
			throw {error:"File does not exists."};
		}
		return true;
	};

	this.printRenderers = bind(this, function() {
		var self = this;
		setTimeout(function() {
			console.log(self.renderers);
			console.log(self.master_status);
		}, 1000);
	});

}

var Keystore = function(dbname) {

	var cradle = require('cradle'),
		conn = new(cradle.Connection)();
		conn.options.cache = false;

	var	db = conn.database(dbname),
		info = {},
		EventEmitter = require('events').EventEmitter,
		dbEvents = new EventEmitter(),
		fs = require('fs'),
		self = this;

	this.on = dbEvents.on;
	this.emit = dbEvents.emit;
	this.db = db;

	var by_type_status = 'docs/by_type_status_nodocs';

	var updating = false;
	var last_update_seq = 0;

	setInterval(function updateView() {
		db.info(function(e,info) {
			if (info.update_seq!==last_update_seq &&
				updating===false) {
				updating = true;
				last_update_seq = info.update_seq;
				//console.log("Indexing views...");
				var t1 = new Date();
				db.view('docs/by_type_status_nodocs', {limit:0}, function(e,res) {
					//console.log("Views reindexed! "+elapsedSeconds(t1).red());
					updating = false;
				});
			}
		});
	},5000);

	db.info(function(e,info) {
		last_update_seq = info.update_seq;
		db.changes({since:info.update_seq}).on('response', function(res) {
			res.on('data', function(change) {
				/* The change object looks like:
				{ seq: 9092,
				  id: 'fd2ac87e-b6f6-5e96-a59f-65ab5b45ff8c',
				  changes: [ { rev: '60-ddfb9d4fd49d6a7ead2b40e04a89ff96' } ] }
				*/
				self.emit('change',change)
			});
		});
	});

	this.get = function(rows, callback) {
		assert.strictEqual(isArray(rows),true,"Non-array argument passed to Keystore#get");
		db.get(rows, function(e,docs) {
			assert.strictEqual(rows.length,docs.length);
			enumerate(docs, function(i,doc) {
				rows[i] = doc.doc;
			});
			callback(rows);
		});
	};

	this.save = function(rows, callback) {
		assert.strictEqual(isArray(rows),true,"Non-array argument passed to Keystore#save");
		assert.strictEqual(rows.length>0,true,"Zero-length argument passed to Keystore#save");
		if (rows.length===0) {
			callback && callback(rows);
			return;
		}
		// var t1 = new Date();
		db.save(rows, function(e,res) {
			if (e) { throw e; }
			else {
			/*	On success, the response is an array that looks like:
				[ { id: 'FFF9905F-A597-4978-B97E-09E4E1CCEEDB', rev: '3-c5d34ac8e1b660f6d5cd15e4684844a3' } ]
				If any document in rows fails, then the array contains:
				[ 	{ id: 'FFF9905F-A597-4978-B97E-09E4E1CCEEDB', error: 'conflict', reason: 'Document update conflict.' },
					{ id: 'FFED752B-BFF2-44D2-BA35-C7BD2935713D', rev: '2-8c15a50b4def03daeb991ec8248cf3e4' } ]
			*/
				assert.strictEqual(rows.length,res.length);
				enumerate(res, function(i,rev) {
					if (rev.hasOwnProperty('rev')) {
						rows[i]._id = rev.id;
						rows[i]._rev = rev.rev;
					}
				});
				// console.log("Saved "+rows.length+' records. '+elapsedSeconds(t1).red());
				callback && callback(rows);
			}
		});
	};
	
	this.attach = function(pkg, fp, callback) {
		db.saveAttachment(
			pkg._id,
			pkg._rev,
			'thumb.jpg',
			'image/jpeg',
			fs.createReadStream(fp),
			function(e,res) {
				if (e) {
					console.log("Failed to attach "+fp.red());
				} else {
					pkg._rev = res.rev;
				}
				callback(pkg);
			}
		);
	};
	
	this.getBatch = function(batchID, callback) {
		var key = typeof batchID==='string' ? [batchID,'ALL'] : batchID,
			parms = {	key:key,
						reduce:false,
						include_docs:true },
			pkg, frames = [];
		if (updating) { parms.stale = 'ok' }
		db.view(by_type_status, parms, function(e,res) {
			/* 	The return object is an array of hashes.
				Each hash has 4 keys: id, key, value and doc
				where doc is the actual row document in the database:
				[ { id: 'EE247F73-9D24-4133-8974-B0C95E0907D6',
					key: 'EE247F73-9D24-4133-8974-B0C95E0907D6',
					value: { rev: '2-819ed79af06bfafe5edeb9bfbf1c901c' },
					doc:
					 { _id: 'EE247F73-9D24-4133-8974-B0C95E0907D6',
					   _rev: '2-819ed79af06bfafe5edeb9bfbf1c901c',
					   status: 'DONE' } } ]
			*/
			for_each_in(res, function(row) {
				frames.push(row.doc);
			});
			callback(frames);
		});
	};

	this.getOpen = function(avail, callback) {
		var docs = [];
		this.getBatch(['ALL','OPEN'], function(frames) {
			for_each_in(frames, function(doc) {
				avail.indexOf(doc.type)!==-1 && docs.push(doc);
			});
			callback(docs);
		});
	};

	this.batchUpdate = function(batchID, props, callback) {
		var updated = [];
		this.getBatch(batchID, function(docs) {
			for_each_in(docs, function(doc) {
				for_each_in(props, function(k,v) {
					doc[k] = v;
				});
				updated.push(doc);
			});
			self.save(updated, function(newRevs) {
				callback && callback(newRevs);
			});
		});
	};

	this.batchCollate = function(batches, callback) {
		/* 	Argument batches is an array of BatchIDs. Returns to the callback the following hash:
			{ 	artfully_cappadocian: { OPEN: 1, RENDERING: 0, FAILED: 0, DONE: 0, ALL: 1 },
  				deathly_apparel: { OPEN: 1, RENDERING: 0, FAILED: 0, DONE: 0, ALL: 1 }
  			}
		 */
		var done = 0, h = {},
			end = function() { done===batches.length && callback(h); };
		for_each_in(batches, function(batchID) {
			db.view(by_type_status,
				{	group:true,
					reduce:true,
					startkey:[batchID],
					endkey:[batchID,{}]
				},
				function(e,res) {
					for (var i=res.length-1;i>= 0;i--){
						var row = res[i],
							r = row.key,
							_batchID = r[0],
							_status = r[1],
							count = row.value;
						if (!h.hasOwnProperty(_batchID)) {
							h[_batchID] = { OPEN:0, RENDERING:0, FAILED:0, DONE:0 };
						}
						_status = _status==='ALL' ? 'TOTAL' : _status;
						h[_batchID][_status] = count;
					}
					done+=1;
					end();
				}
			);
		});
	};

	this.revDiff = function(earlier,later) {
		var x = parseInt(earlier._rev.split('-')[0],10),
			y = parseInt(later._rev.split('-')[0],10);
		return y-x;
	}

};

var Spacetree = function(app, keystore) {

	var nowjs = require("now"),
		everyone = nowjs.initialize(app),
		COLORSTAT = {
			OPEN:"#C9B13C",
			RENDERING:"#3C70C9",
			DONE:"#18865A",
			FAILED:"#E91F5F",
			OTHERS:"#CAC5C7"
		};

	everyone.now.finalGather = finalGather;

	function buildFrameNode(pkg) {
		var status = pkg.status in COLORSTAT ?
						pkg.status : 'OTHERS';
		return {
			id:pkg._id,
			name:'frame_'+pkg.frame,
			data:{
				$color:COLORSTAT[status],
				nodetype:'frame',
				batchID:pkg.batchID,
				renderer:pkg.type,
				status:pkg.status,
				file:pkg.file,
				frame:pkg.frame},
			children:[]
		};
	}

	function buildBatchNode(pkg) {
		return {
			id:pkg.batchID,
			name:pkg.batchID,
			data:{	nodetype:'batch',
					renderer:pkg.type,
					submitted:pkg.submitted },
			children:[]
		}
	}

	function countStats(frames) {
		var stats = {TOTAL:0};
		frames.forEach(function addStatCount(frame) {
			var stat = 	frame.data.status in COLORSTAT
						? frame.data.status
						: 'OTHERS';
			if (!stats.hasOwnProperty(stat)) {
				stats[stat] = {n:0,color:COLORSTAT[stat]}
			}
			stats[frame.data.status].n+=1;
			stats.TOTAL+=1;
		});
		return stats;
	}

	function buildFromRoot(frames) {

		var batches = {}, batch, root, row, pkg, frame_base, pie_base;

		var byFrameNumber = function(a,b) { return a.data.frame - b.data.frame; };
		var byFrameStatus = function(a,b) { return a.data.status - b.data.status; };
		var byTimeSubmitted = function(a,b) { return a.data.submitted - b.data.submitted; };

		root = {
			id: "master",
			name: "master",
			data: {},
			children: []
		};

		for_each_in(frames, function(pkg) {
			frame_base = buildFrameNode(pkg);
			if (!batches.hasOwnProperty(pkg.batchID)) {
				batches[pkg.batchID] = buildBatchNode(pkg);
			}
			batches[pkg.batchID].children.push(frame_base);
		});

		for (var batchID in batches) {
			batch = batches[batchID];
			if (batch.children.length>0) {
				batch.data.stats = countStats(batch.children);
				batch.children.sort(byFrameNumber);
				batch.children = [];
			}
			root.children.push(batch);
		}

		root.children.sort(byTimeSubmitted);

		return root;
	}

	function finalGather(key, callback) {
		key = key===null ? 'ALL' : key;
		keystore.getBatch(key,function(frames){
			callback(buildFromRoot(frames));
		});
	}
	
	keystore.on('batchCreated', function injectNewBatch(frames) {
		if (everyone.count===0) { return; }
		everyone.now.newBatch(buildFromRoot(frames));
	});

/*
	var buffer = [];

	keystore.on('change', function everyoneUpdate(change) {
		everyone.count>0 && buffer.push(change.id);
	});
	
	setInterval(function() {
		if (buffer.length>0) {
			keystore.get(buffer, function(docs) {
				for_each_in(docs, function(doc) {
					var frame = buildFrameNode(doc);
					everyone.now.updateST(frame);
					console.log(frame);
					buffer.shift();
				});
			});
		}
	},10*1000)
*/
};

var Ad = function(config) {
	var sys = require('sys'),
		ad = mdns.createAdvertisement(config.type, config.port, config,
			function(err, info, flags) {
				//console.log("==== up");
				if (err) {
					assert.fail(err);
				} else {
					//console.log(sys.inspect(info));
				}
			});
	this.start = function() { ad.start(); };
	this.stop = function() { ad.stop(); };
};

function RenderServerAdvertisement() {

	var self = this;
	var	socket = new require('net').Socket(),
		serviceType = 'renderblade',
		ringAd, httpAd,
		listener = mdns.createBrowser(serviceType,'tcp'),
		getMAC = {
			'darwin':{cmd:'ifconfig en0',match:/\w\w:\w\w:\w\w:\w\w:\w\w:\w\w/},
			'linux':{cmd:'ifconfig eth0',match:/\w\w:\w\w:\w\w:\w\w:\w\w:\w\w/},
			'windows':'ipconfig /all'
		}[process.platform];

	this.startAdvertising = function() {
		popen(getMAC.cmd, function(e, stdout, stderr) {
			self.machineID = stdout.match(getMAC.match)[0];
			socket.setTimeout(100, function(e) {
				var config = {
					type: serviceType,
					name: self.machineID,
					port: httpPort,
					txtRecord:{ip:socket.address().address}
				};
				socket.destroy();

				httpAd = new Ad({type:'http',port: httpPort});
				httpAd.start();

				ringAd = new Ad(config);
				ringAd.start();
			
			});
			socket.connect(123,'4.3.2.1');
			listener.on('serviceUp', function(info, flags) {
				/* The info object looks like:
					{ interfaceIndex: 6,
					  serviceName: '00:1f:5b:34:ac:e8',
					  regtype: '_renderblade._tcp.',
					  replyDomain: 'local.',
					  fullname: '00:1f:5b:34:ac:e8._renderblade._tcp.local.',
					  host: 'hiroshima.local.',
					  port: 8080,
					  txtRecord: { '': '' } }
				*/
				info.status = 'unknown';
				info.last = new Date().getTime();
				self.peers[info.serviceName] = info;
				console.log('++ '.green()+info.serviceName)
			});
			listener.on('serviceDown', function(info, flags) {
				if (self.peers.hasOwnProperty(info.serviceName)) {
					console.log('-- '.red()+info.serviceName);
					delete self.peers[info.serviceName];
				}
			});
			listener.start();
		});
	};

}

module.exports = (function() {

	RenderServerUtils.apply(this);
	RenderServerAdvertisement.apply(this);

	var sys = require('sys'),
		os = require('os'),

		hostname = os.hostname(),
		httpPort = 8080, //randrange(20000,30000),
		
		express = require('express'),
		app = express.createServer(),
		
		renderers = {},
		blacklist = {},

		machineID = null,

		dbname = 'maggiequeue',
		dbport = 5984,
		keystore = new Keystore(dbname),

		timelocks = null,

		st = new Spacetree(app, keystore),

		peers = {},
		server = this;
		
	var RVGO = true; // TODO: Check for rvio

	this.httpPort = httpPort;
	this.master_status = {};
	this.renderers = renderers;
	this.machineID = machineID;
	this.peers = peers;

	server.setStatus(0); // Disable || enable on startup

	server.startAdvertising();

	renderers.prman = new Renderer.Factory('PRMAN');
	renderers.maya = new Renderer.Factory('MAYA');
	renderers.maya2012 = new Renderer.Factory('MAYA2012');

	(function initExpress() {
		app.use(express.bodyParser());
		app.use(express.static(__dirname+'/root'));
		// app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
		// app.listen(httpPort);
	})();

	(function initTimelocks() {
		var timelock = require('./timelock'),
			in_timelock = false;
		timelocks = new timelock.Timelock(),
		timelocks.onActive(function(timeToRelease) {
			if (!in_timelock) {
				var msg = "TIMELOCK ACTIVE: Suspended! Will resume @ "+timeToRelease;
				console.log(msg.red());
			}
			if (server.master_status.hasOwnProperty('rendering')) {
				console.log("TIMELOCK ACTIVE: Aborting render!".red());
				abortCurrentRender(1);
				in_timelock = true;
			} else {
				server.setStatus(1);
				in_timelock = true;
			}
		});
		timelocks.onInactive(function() {
			if (in_timelock) {
				console.log("EXITING TIMELOCK: Server resumed...".green());
				server.setStatus(0);
				in_timelock = false;
			}
		});
	})();
	
	keystore.on('change', function(change) {
		// TODO: Suspected has side-effects!
		if (server.master_status.hasOwnProperty('rendering') && !isNotRendering()) {
			if (change.id===server.master_status.rendering._id) {
				abortCurrentRender(1);
			}
		}
	});

	function updateRemote(pkg,callback) {
		// console.log("CALLER: "+arguments.callee.caller.name.red());
		function updateLocally(mpkg) {
			keystore.save([mpkg], function(res) {
				if (res[0].hasOwnProperty('rev')) {
					mpkg._rev = res[0].rev;
					callback(mpkg);
				} else {
					callback({error:true});
				}
			});
		}

		var buffer=[], chunky={},
			http = require('http'),
			url = require('url'),
			originIP, return_address;

		if (peers.hasOwnProperty(pkg.origin)) {
			originIP = peers[pkg.origin].txtRecord.ip;
			return_address = 'http://' + originIP + ':' + dbport + '/' + dbname;
		}
	
		if (!(return_address)) {
			callback({error:true});
			return;
		}

		var origin = url.parse(return_address),
			options = {
				host: origin.hostname,
				port: origin.port || 80,
				path: origin.pathname+'/'+pkg._id,
				method: 'PUT',
				headers:{'Content-Type':'application/json'}
			},
			req	= http.request(options, function(res) {
				res.setEncoding('utf8');
				res.on('data',function(chunk) {
					buffer.push(chunk);
				});
				res.on('end', function() {
					chunky = JSON.parse(buffer.join(''));
					if (chunky.hasOwnProperty('ok')) {
						/*	On success the chunk looks like:
							{ok:'true', id:'someid', 'rev':'2-j2elk29dadsa'}
						*/
						var o = jsonclone(pkg);
							o._rev = chunky.rev;
						callback(o);
					} else {
						/* 	This is usually a conflict error, as such, we're
							not going to call #updateLocally
						*/
						callback({error:true});
					}
				});
			});
		req.on('error', function() { // Connection/network failures go here
			updateLocally(pkg);
		});
		req.write(JSON.stringify(pkg)+'\n');
		req.end();
	}

	function abortCurrentRender(killcode) {
		/*	TODO: Warning: this doesn't work for Maya!
			Maya calls "Render" which invokes "MayaBatch".
			Kill signal terminates 'Render' but not MayaBatch.
		*/
		var pkg, pid, exec;
		if (server.master_status.hasOwnProperty('rendering')) {
			pkg = server.master_status.rendering;
			exec = [0,0].hasOwnProperty(killcode) &&
			{
				0:function killActive() {
					pid = renderers[pkg.type].runningProc;
					if (pid) { pid.kill(); }
				},
				1:function suspendAndKill() {
					var that = this;
					pkg.status = 'OPEN';
					updateRemote(pkg,function() {
						that[0]();
						server.setStatus(1);
					});
				}
			}[killcode]();
		}
	}

	function isNotRendering() {
		var procs = [];
		for_each_in(renderers, function(type) {
			procs.push(renderers[type].runningProc===null);
		});
		return procs.indexOf(false)===-1;
	}

	function serverPostRender(pkg) {
		keystore.get([pkg._id], function(rows) {
			var row = rows[0];
			assert.strictEqual(pkg._rev, row._rev,
					'Renderpacket revision changed while rendering.');
			_serverPostRender(pkg);
		});
	}

	function _serverPostRender(pkg) {
		var path = require('path'),
			fs = require('fs'),
			status;
		
		switch(pkg.status) {
			case 'BAN':
				pkg.status='OPEN';
				blacklist[pkg.batchID] = null;
				break;
			case 'FAILED':
				pkg.status='FAILED';
				keystore.batchUpdate(pkg.batchID, {
					status:'FAILED',
					render_messages:pkg.render_messages
				});
				break;
			case 'REOPEN':
				pkg.status='OPEN';
				break;
			default:
				// pass
		}
		
		if (pkg.status==='DONE' &&
			pkg.render_messages.hasOwnProperty('fileouts') &&
			pkg.render_messages.fileouts.length>0) {
			for_each_in(pkg.render_messages.fileouts,function(fp) {
				if (!path.existsSync(fp)) { pkg.status = 'FAILED'; }
			});
			if (pkg.status==='DONE') {
				pkg.completed = new Date().getTime();
				// Before attaching the thumbnail, save the document...
				updateRemote(pkg, function(updated_pkg) {
					// Now that we have the latest _rev
					server.master_status.hasOwnProperty('rendering') && server.setStatus(0);
					if (RVGO && updated_pkg.hasOwnProperty('_id')) {
						var fp = updated_pkg.render_messages.fileouts[0],
							thumb = fp.replace(/\.....?$/,'.thumb.jpg'),
							cmd = 'rvio '+fp+' -outres 250 140 -o '+thumb;
						popen(cmd, function() {
							keystore.attach(updated_pkg, thumb, function() {
								console.log('DONE ==> '.green() +
									JSON.stringify(pkg.render_messages.fileouts,null,3));
							});
						});
					}
				});
				return null;
			}
		}
		
		updateRemote(pkg,function() {
			status = pkg.status==='DONE' ? pkg.status.green() : pkg.status.red();
			console.log(status+': no output files. '+pkg._id);
			server.master_status.hasOwnProperty('rendering') && server.setStatus(0);
		});
	}
	
	function getNewRenders() {

		function render(pkg) {
			// Be super-paranoid and check this at every step
			if (server.master_status.ok && isNotRendering()) {
				pkg.status='RENDERING';
				pkg.handler = 'http://' + hostname + ':' + httpPort;
				updateRemote(pkg, function(res) {
					if (res.hasOwnProperty('_id') &&
						keystore.revDiff(pkg,res)===1) {
						server.setStatus({ ok:false, rendering:res });
						var renderPkg = jsonclone(res);
						//console.log("RENDER ====> "+renderPkg._rev);
						renderers[renderPkg.type].preRender(renderPkg,serverPostRender);
					}
				});
			}
		}
		
		function makeReservation(pkg) {
			 // Be super-paranoid and check this at every step
			if (server.master_status.ok && isNotRendering()) {
				pkg.render_messages = {}; // Clean out messages from previous runs
				updateRemote(pkg, function(res) {
					if (res.hasOwnProperty('_id') &&
					keystore.revDiff(pkg,res)===1) {
						render(res);
					}
				});
			}
		}
		
		function resolveDeppsAndCapture(batches,pkg) {
			var allDone = {};
			for_each_in(batches, function(id,batch) {
				allDone[batch.DONE===batch.TOTAL] = null;
			});
			if (!allDone.hasOwnProperty('false')) { makeReservation(pkg); }
		}

		function canRender(pkg) {
			var path = require('path');
			return	!timelocks.active() && 							// This is a precautionary double-check
					renderers.hasOwnProperty(pkg.type) &&			// Is the renderer implemented?
					renderers[pkg.type].ready &&					// Is it ready on this machine?
					path.existsSync(pkg.file) &&					// Does the render file exists here?
					typeof blacklist[pkg.batchID]==='undefined';	// Is the batch blacklisted?
		}

		function grabOne(list) {
			if (list.length===0) { return; }
			var depps = [], pkg,
				with_depps = [], no_depps = [],
				which = { 'true':no_depps, 'false':with_depps };
			list.sort(compareByNumericValueOfKey('submitted'));
			for_each_in(list,function(pkg) {
				which[pkg.dependencies.length===0].push(pkg);
			});
			pkg = which[no_depps.length>0][0];
			depps = pkg.dependencies;
			if (canRender(pkg)) {
				depps.length===0 && makeReservation(pkg) ||
				keystore.batchCollate(depps, function(batches) {
					resolveDeppsAndCapture(batches,pkg);
				});
			}
		}

		(function getNewRenderMain() {
			if (server.master_status.ok && isNotRendering()) {
				var avail = server.available_renderers(); // an [] of ready renderer names
				keystore.getOpen(avail, grabOne);
			}
		})();
	}

	setInterval(getNewRenders,5*1000);

	// ---------- SERVER ROUTES -----------
	
	function jsonify(o) {
		return JSON.stringify(o,null,2); 
	}

	function writeStatus(res) {
		res.writeHead(200, {'Content-Type':'application/json'});
		res.write(jsonify(server.getStatus())+'\r\n');
		res.end();
	}

	app.get('/', function index(req,res) {
		res.writeHead(200, {'Content-Type':'application/json'});
		res.write(jsonify({
			ok:true,
			msg:'Welcome to MQ',
			machineID:server.machineID
		}));
		res.end();
	});
	
	app.get('/status', function getStatus(req,res) {
		writeStatus(res);
	});

	app.get('/peers', function monitorPeers(req,res) {
		var heartbeat = 10, last_result_crc = '', curr_result_crc = '';
		function writePeers() {
			var p = {};
			for_each_in(peers, function(serviceName,info) {
				p[serviceName] = {status:info.status};
			});
			curr_result_crc = checksum(p,'md5');
			if (curr_result_crc!==last_result_crc) {
				last_result_crc = curr_result_crc;
				res.write(jsonify(p)+"\r\n");
			}
		}
		writePeers();
		setInterval(function() { writePeers(); },heartbeat*1000);
	});

	app.get('/status/:code', function setStatus(req,res) {
		var code = parseInt(req.params.code,10),
			msg;
		if (typeof server.master_status.rendering==='undefined') {
			server.setStatus(code);
			writeStatus(res);
		} else {
			msg = {error:'Cannot override status while rendering. Use kill instead.'};
			res.send(jsonify(msg))
		}
	});
	
	app.get('/toggle/:renderer', function toggleRenderer(req,res) {
		var type = req.params.renderer;
		if (renderers.hasOwnProperty(type)) {
			renderers[type].ready = !renderers[type].ready;
		}
		writeStatus(res);
	});

	app.get('/timelocks/add/:dateday/:time', function addTimelock(req,res) {
		var dateday = req.params.dateday,
			time = req.params.time,
			locks = timelocks.add(dateday+':'+time);
			var msg = locks ? {ok:true,locks:locks} : {error:'Lock not added. Check formatting.'};
		res.send(jsonify(msg));
	});

	app.get('/timelocks/show', function addTimelock(req,res) {
		var msg = {active:timelocks.active(),locks:timelocks.show()};
		res.send(jsonify(msg));
	});
	
	app.get('/kill/:code', function killall(req,res) { // ----- DESTRUCTIVE
		var pkg, exec, killcode = parseInt(req.params.code,10);
		if (server.master_status.hasOwnProperty('rendering')) {
			pkg = server.master_status.rendering;
			exec = [0,1].indexOf(killcode)!==-1 && abortCurrentRender(killcode);
			exec===false && res.send('Only status 1 or 0 allowed.');
			res.send(jsonify({ok:'Killed current render.'}))
		} else {
			res.send(jsonify({error:'Not rendering anything.'}));
		}
	});
	
	app.get('/submit/:renderer', function submit(req,res) {
		/*	Special query flags are:
			- project : project id
			- shot : shot number
			- file : path of file to render
			- s : start frame to render
			- e : end frame to render
			- depp : semicolon ':' delimited list of batchIDs
			         the current submission is dependent upon
			All other parameters are treated as flags and given to the renderer.
		*/
		var request_root = req.headers.host.split(':')[0],
			frames = [],
			params = req.query,
			renderer = req.params.renderer,
			zuuid = require('node-uuid'),
			meta = { password:zuuid() };
		try {
			if (request_root.match(/localhost|127.0.0.1/)) {
				throw {error:"Do not submit to localhost. Use "+hostname};
			}
			if (!renderers.hasOwnProperty(renderer)) {
				throw {error:"Renderer "+renderer+" not implemented."};
			}

			server.checkFile(renderer,params);

			meta.type = renderer;
			meta.origin = server.machineID;

			meta.project = params.hasOwnProperty('project') ? params.project : 'default';
			delete params.project;

			meta.shot = params.hasOwnProperty('shot') ? params.shot : '00000';
			delete params.shot;

			meta.depp = params.hasOwnProperty('depp') ? params.depp.split(',') : [];
			delete params.depp;

			meta.file = params.file;
			delete params.file;

			meta.flags = params;

			frames = renderers[meta.type].parse(meta);

			if (frames.length===0) {
				throw {error:"Cannot get framerange from file. Specify range manually."};
			} else {
				keystore.save(frames, function(new_frames) {  // <----------------- DATABASE COMMIT
					keystore.emit('batchCreated', new_frames);
					var stat = "ADDED COUNT TYPE frame(s)."
							.replace(/COUNT/,new_frames.length)
							.replace(/TYPE/,meta.type),
						ids = (function(c) {
									for_each_in(new_frames, function(frame) {
										c.push(frame._id);
									});
									return c;
								})([]);
					res.send(jsonify({
						ok:stat,
						batchID:new_frames.slice(-1)[0].batchID,
						jobs:ids,
						password:meta.password
					}));
				});
			}
		} catch(e) {
			if (e.hasOwnProperty('error') || e.hasOwnProperty('ok')) {
				res.send(jsonify(e));
			} else {
				res.send(e);
			}
		}
	});
	
	app.get('/watch/:batchID', function watch(req,res) {
		res.writeHead(200, {'Content-Type':'application/json'});
		var params = req.query,
			watchBatchID = req.params.batchID,
			last_result_crc = '', curr_result_crc = '';
		function writeResults(once) {
			keystore.batchCollate([watchBatchID],function(results) {
				results = results[watchBatchID];
				curr_result_crc = checksum(results,'md5');
				if (curr_result_crc!==last_result_crc) {
					last_result_crc = curr_result_crc;
					res.write(jsonify(results)+"\r\n");
				}
				if (results.DONE===results.TOTAL ||
					results.hasOwnProperty('error') ||
					once) {
					res.end();
				}
			});
		}
		if (params.hasOwnProperty('once')) {
			writeResults(true);
		} else {
			writeResults(false);
			setInterval(function keepAlive() {
				res.write('\n');
			},60*1000);
			keystore.getBatch(watchBatchID, function(docs) {
				var watchIDs = [];
				for_each_in(docs, function(doc) {
					watchIDs.push(doc._id);
				});
				keystore.on('change', function(change) {
					if (watchIDs.indexOf(change.id)!==-1) {
						writeResults(false);
					}
				});
			});
		}
	});

	app.get('/randomupdate/:batchID', function randomUpdateBatch(req,res) {
		var batchID = req.params.batchID,
			statuses = ['DONE','RENDERING','FAILED'];
		keystore.getBatch(batchID, function(frames) {
			for_each_in(statuses, function(stat) {
				var batch = sample(randrange(10,frames.length/2), frames);
				for_each_in(batch, function(doc) {
					doc.status = stat;
				});
				keystore.save(batch, function(new_frames) {
					// Ignore
				});
			});
			res.send('OK');
		});
	});

	app.get('/update/:batchID/:status', function updateBatch(req,res) {
		// TODO: Check for password before allowing batch override.
		var batchID = req.params.batchID,
			new_status = req.params.status;
		keystore.batchUpdate(batchID, { status:new_status },
		function(frames) {
			var msg = {ok:"Updated "+frames.length+" frames."};
			res.send(jsonify(msg));
		});
	});
	
	app.get('/flush/blacklist', function flushBlacklist(req,res) {
		blacklist = {};
		res.send(jsonify({ok:true,msg:'Blacklist reset.'}));
	}); // flush blacklist

	return app;

})();

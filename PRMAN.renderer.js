PRMAN = function() {

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

module.exports.PRMAN = PRMAN;
MAYA = function() {
	
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

MAYA2012 = function() {
	MAYA.apply(this);
	this.name = 'maya2012';
	this.cmd = "Render2012 -mr:rt 4 -mr:v 5";	
	this.test_cmd = "Render2012";
};

module.exports.MAYA = MAYA;
module.exports.MAYA2012 = MAYA2012;
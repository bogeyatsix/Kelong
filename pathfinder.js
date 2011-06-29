var exists = require('path').exists;
var fs = require('fs');
// var fm = /(?:[A-Za-z]:)?\.?[\\\/][\\\/\w-. ]+[\\\/][\w-. ]+\.\w\w\w?/g; | Allow spaces in names
var fm = /(?:[A-Za-z]:)?\.?[\\\/][\\\/\w-.]+[\\\/][\w-.]+\.\w\w\w\w?/g;

String.prototype.endswith = function(suffix) {
	var re = (typeof suffix==='string') ? RegExp(suffix+'$') : suffix;
	return re.test(this);
};

function isArray(obj) {
	return Object.prototype.toString.call(obj)==='[object Array]';
}

function for_each_in(obj,callback) {
	if (isArray(obj)) {
		for (var i=0,max=obj.length;i<max;i+=1) {
			callback(obj[i]);
		}
	} else {
		for (var k in obj) {
			if (obj.hasOwnProperty(k)) {
				callback(k,obj[k]);
			}
		}
	}
}

function keys_values(obj) {
	var keys = {}, values = {};
	for_each_in(obj,function(k,v){
		keys[k] = null;
		values[v] = null;
	});
	return {
		keys:keys,
		values:values
	};
}

function extractPaths(string) {
	return string.match(fm);
}

function resolve(suffix_list,filepath,callback) {
/*	Returns to the callback an object of the form:
	
	paths.paths[path_matched] = BOOL path_exists?

	If for whatever reason, you need the original line
	the regular expression matched then:
	
	paths.lines[path_mathed] = original_line_containing_path_matched

*/
	var paths = {};
		paths.paths = {};
		paths.lines = {};
	
	paths.paths[filepath] = null;
	
	function find() {
		for_each_in(paths.paths, function(path,v) {
			if (v===null) {
				exists(path,function(ex){
					paths.paths[path] = ex;
					if (path.endswith(suffix_list)) {
						fs.readFile(path,'utf-8',function(err,data) {
							var lines = data.split('\n');
							for_each_in(lines, function(line) {
								var subs = line.match(fm);
								if (subs) {
									for_each_in(subs,function(fp) {
										paths.paths[fp] = null;
										paths.lines[fp] = line;
									});
								}
							});
						});
					}
				});
			}
		});
	}
	
	var run = setInterval(function(){
		if (keys_values(paths.paths).values.hasOwnProperty('null')){
			find();
		} else {
			if (callback) {
				callback(paths);
			} else {
				console.log(JSON.stringify(paths,null,2));
			}
			clearInterval(run);
		}
	},100);

}

exports.fm = fm;
exports.resolve = resolve;
exports.extractPaths = extractPaths;
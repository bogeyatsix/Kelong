var fs = require('fs');
var popen = require('child_process').exec;
var growl = require('growl');

popen('find docs -type f | sed "s#docs#$(pwd)/docs#"', function(e,o,ee) {
	
	var files = o.split('\n');

	popen('couchapp push docs http://127.0.0.1:5984/maggiequeue', function(e,o,ee){
		console.log('Started watching...');
	});

	for (var i=0,max=files.length;i<max;i+=1) {
		(function watch(file) {
			fs.watchFile(file, function upload(curr,prev) {
				if (curr.mtime.toString()!==prev.mtime.toString()) {
					growl.notify('CHANGED: '+file,{title:'CouchApp Watcher'});
					popen('couchapp push docs http://127.0.0.1:5984/maggiequeue',function(e,o,err){});
				}
			});
		})(files[i]);
	}
	
});
/**
 * Unused global functions from server.js.
 */

function elapsedSeconds(startTime) {
	return ((new Date()-startTime)/1000).toFixed(2);
}

function randint(max) {
	return ~~(Math.random()*(max+1));
}

function collect(list, callback) {
	var newList = [];
	for_each_in(list,function(t) {
		newList.push(callback(t));
	});
	return newList;
}

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



function(head,req) {
	
	var root,
		row,
		pkg,
		frame_base,
		pie_base,
		batches = {};
	
	var COLORSTAT = {
		OPEN:"#FFFF33",
		RENDERING:"#3366FF",
		DONE:"#33FF33",
		FAILED:"#FF0033",
	};
	
	var byFrameNumber = function(a,b) { return a.data.frame - b.data.frame; };

	var byFrameStatus = function(a,b) { return a.data.status - b.data.status; };	
	
	var byTimeSubmitted = function(a,b) { return a.data.submitted - b.data.submitted; };

	root = {
		id: "hiroshima.local",
		name: "hiroshima.local",
		data: {},
		children: []
	};
	
	while (row=getRow()) {
		pkg = row.value;
		frame_base = {
			id:pkg._id,
			name:'frame_'+pkg.frame,
			data:{
				$color:COLORSTAT[pkg.status],
				type:'frame',
				renderer:pkg.type,
				status:pkg.status,
				file:pkg.file,
				frame:pkg.frame},
			children:[]
		}
		
		if (!batches.hasOwnProperty(pkg.batchID)) {
			batches[pkg.batchID] = {
				id:pkg.batchID, 
				name:pkg.batchID,
				data:{	type:'batch',
						renderer: pkg.type,
						submitted: pkg.submitted,
						children1:[], children2:[],
						counts: { TOTAL:0, OPEN:0, RENDERING:0, FAILED:0, DONE:0 } },
				children:[]
			}
		}
		
		batches[pkg.batchID].data.counts.TOTAL+=1;
		batches[pkg.batchID].data.counts[pkg.status]+=1;
		batches[pkg.batchID].data.children2.push(frame_base);
	};

	for (var batchID in batches) {
		
		var batch = batches[batchID];
		
		if (batch.data.counts.TOTAL!==batch.data.counts.DONE) {
			batch.data.status='LIVE';
		} else {
			batch.data.status='COMPLETE';
		}
		
		var TOTAL = batch.data.counts.TOTAL;
		
		for (var stat in batch.data.counts) {
			var i = batch.data.counts[stat];
			if (stat==='TOTAL' || i===0) { continue; };
			pie_base = {
				id:batch.id+'_'+stat,
				name:stat,
				data: {
					$angularWidth:parseFloat((i/TOTAL*100).toFixed(1),10),
					$color:COLORSTAT[stat] },
				children:[]
			}
			batch.data.children1.push(pie_base);
		}
		
		batch.data.children2.sort(byFrameNumber);
		root.children.push(batch);
	}
	
	root.children.sort(byTimeSubmitted);
	
	return JSON.stringify(root,null,1);
}























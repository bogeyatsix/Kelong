function(doc) {
	var d = new Date(doc.submitted),
		dateArray = [	d.getFullYear(),
						d.getMonth()+1,
						d.getDate(),
						d.getHours(),
						d.getMinutes()
					];
	emit([	doc.project,
			dateArray,
			doc.batchID,
			doc.type,
			doc.status
		], null);
	emit(["ALL","ALL"],null);
	emit(["ALL",doc.status],null);
	emit([doc.batchID,"ALL"],null);
	emit([doc.batchID,doc.status],null);
	emit([doc.type,"ALL"],null);
	emit([doc.type,doc.status],null);
}
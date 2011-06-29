var cradle = require('cradle'),
	conn = new(cradle.Connection)();

exports.log = function(e,res) {
	console.log(res);
};
	
exports.db = conn.database('maggiequeue');
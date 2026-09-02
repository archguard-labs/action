const db = require('mongoose');
module.exports.getUsers = function(req, res) { db.query('SELECT * FROM users'); }

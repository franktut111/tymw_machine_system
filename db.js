const mysql = require('mysql2');

const pool = mysql.createPool({
  host: 'frank.tsungyin.tw',
  user: 'frank',
  password: 'Tu0426',
  database: 'tymw'
});

module.exports = pool.promise();
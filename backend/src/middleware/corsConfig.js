// CORS configuration middleware
const cors = require('cors');

module.exports = cors({
  origin: 'http://127.0.0.1:5500',
  credentials: true
});

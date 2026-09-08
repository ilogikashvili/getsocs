const { startServer, HOST, PORT } = require('./server/server');

if (require.main === module) {
  startServer(PORT, HOST);
}

module.exports = { startServer, HOST, PORT };

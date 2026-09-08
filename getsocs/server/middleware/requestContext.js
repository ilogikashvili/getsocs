const crypto = require('crypto');

function requestContext(req, res, next) {
  const incoming = req.get('x-request-id');
  const requestId = incoming && /^[A-Za-z0-9._:-]{8,128}$/.test(incoming) ? incoming : crypto.randomUUID();
  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
}

module.exports = { requestContext };

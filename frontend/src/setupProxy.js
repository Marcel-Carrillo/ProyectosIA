const { createProxyMiddleware } = require('http-proxy-middleware');

const target = process.env.BACKEND_URL || 'http://localhost:3000';

module.exports = function (app) {
  app.use(
    '/api',
    createProxyMiddleware({
      target,
      changeOrigin: true,
    })
  );
};

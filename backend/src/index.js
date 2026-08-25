const { createApp } = require('./app');

// Fail fast if SESSION_SECRET is not set
if (!process.env.SESSION_SECRET) {
  console.error('FATAL: SESSION_SECRET environment variable is required. Set it before starting the server.');
  process.exit(1);
}

const app = createApp();
const PORT = process.env.PORT || 3000;

app.listen(PORT, '127.0.0.1', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

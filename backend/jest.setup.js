process.env.NODE_ENV = 'test';
// Integration-style tests hit Prisma. Load backend/.env when present so
// `npm test` works after local setup without exporting DATABASE_URL by hand.
// Existing variables (CI) are left unchanged.
// eslint-disable-next-line @typescript-eslint/no-require-imports
require('dotenv').config();

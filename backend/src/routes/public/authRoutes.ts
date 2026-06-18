import { Router } from 'express';
import express from 'express';
import rateLimit from 'express-rate-limit';
import {
  register,
  login,
  logout,
  refresh,
  me,
  verify2fa,
  forgotPassword,
  resetPassword,
  oauthProviders,
  googleAuthStart,
  googleAuthCallback,
  appleAuthStart,
  appleAuthCallback,
  facebookAuthStart,
  facebookAuthCallback,
  oauthMockLogin,
} from '../../presentation/controllers/customerAuthController';
import { requireCustomerAuth } from '../../middleware/requireCustomerAuth';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

const router = Router();

router.use(authLimiter);

router.post('/register', register);
router.post('/login', login);
router.post('/logout', logout);
router.post('/refresh', refresh);
router.get('/me', requireCustomerAuth, me);
router.post('/2fa/verify', verify2fa);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

router.get('/oauth/providers', oauthProviders);

router.get('/google', googleAuthStart);
router.get('/google/callback', googleAuthCallback);
router.get('/apple', appleAuthStart);
router.post('/apple/callback', express.urlencoded({ extended: true }), appleAuthCallback);
router.get('/facebook', facebookAuthStart);
router.get('/facebook/callback', facebookAuthCallback);

if (process.env.NODE_ENV !== 'production') {
  router.post('/oauth/mock', oauthMockLogin);
}

export default router;

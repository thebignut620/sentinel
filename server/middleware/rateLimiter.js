import rateLimit from 'express-rate-limit';

// Login: 5 attempts per 15 minutes per IP
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    const resetTime = req.rateLimit.resetTime;
    const minutesLeft = Math.ceil((resetTime - Date.now()) / 60000);
    res.status(429).json({
      error: `Too many login attempts. Please try again in ${minutesLeft} minute${minutesLeft !== 1 ? 's' : ''}.`,
    });
  },
});

// Forgot password: 3 attempts per hour per IP
export const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      error: 'Too many password reset requests. Please try again in 1 hour.',
    });
  },
});

// Signup: 10 per hour per IP — prevent mass account creation
export const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      error: 'Too many signup attempts. Please try again later.',
    });
  },
});

// General API: 100 requests per minute per IP
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/billing/webhook', // Stripe webhooks must not be rate-limited
  handler: (_req, res) => {
    res.status(429).json({
      error: 'Too many requests. Please slow down.',
    });
  },
});

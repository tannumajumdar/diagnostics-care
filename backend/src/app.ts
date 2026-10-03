// First, before any module reads process.env while it loads.
import 'dotenv/config';
import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { connectDB } from './config/database';
import { RolePermissionService } from './services/rolePermission.service';
import { errorHandler } from './middleware/errorHandler';
import routes from './routes';

// Refuse to start without them rather than fail on the first login.
const missing = ['DATABASE_URL', 'JWT_SECRET', 'JWT_REFRESH_SECRET'].filter((name) => !process.env[name]);
if (missing.length && process.env.NODE_ENV !== 'test') {
  console.error(`[LMS Server] Missing required settings in backend/.env: ${missing.join(', ')}`);
  process.exit(1);
}

const isProduction = process.env.NODE_ENV === 'production';

const app: Application = express();
const PORT = process.env.PORT || 5000;

// Behind a host's proxy (Render, nginx) every request arrives from the proxy's
// address. TRUST_PROXY=1 makes req.ip the real client again, so the rate
// limiter counts each counter PC separately and the audit log records it.
if (process.env.TRUST_PROXY) {
  app.set('trust proxy', Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY);
}

// Security Headers
app.use(helmet());

// Cross-Origin Resource Sharing (CORS)
// CLIENT_URL may list several sites, comma-separated. The local dev servers
// are let in only outside production.
const allowedOrigins = [
  ...(process.env.CLIENT_URL || '').split(',').map((url) => url.trim().replace(/\/$/, '')).filter(Boolean),
  ...(isProduction ? [] : ['http://localhost:3000', 'http://localhost:5173']),
];

app.use(
  cors({
    origin: (origin, callback) => {
      // No Origin header: same-origin requests, curl, health checks.
      callback(null, !origin || allowedOrigins.includes(origin));
    },
    credentials: true,
  })
);

// Rate Limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // Limit each IP to 300 requests per windowMs
  message: { success: false, message: 'Too many requests from this IP, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', apiLimiter);

// Body Parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// API Routes
app.use('/api', routes);

// Health Check
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'UP', service: 'Laboratory Management System API', timestamp: new Date() });
});

// Centralized Error Handling
app.use(errorHandler);

// Start Server after connecting to PostgreSQL
if (process.env.NODE_ENV !== 'test') {
  connectDB().then(async () => {
    // The Admin's saved role permissions replace the shipped defaults before
    // the first request is served.
    try {
      await RolePermissionService.loadIntoMemory();
    } catch (error) {
      console.error('[LMS Server] Could not load saved role permissions, using defaults', error);
    }
    app.listen(PORT, () => {
      console.log(`[LMS Server] Operational on port ${PORT}`);
    });
  });
}

export default app;


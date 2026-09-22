"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const dotenv_1 = __importDefault(require("dotenv"));
const database_1 = require("./config/database");
const errorHandler_1 = require("./middleware/errorHandler");
const routes_1 = __importDefault(require("./routes"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
// Security Headers
app.use((0, helmet_1.default)());
// Cross-Origin Resource Sharing (CORS)
const allowedOrigins = process.env.CLIENT_URL
    ? [process.env.CLIENT_URL, 'http://localhost:3000', 'http://localhost:5173']
    : ['http://localhost:3000', 'http://localhost:5173'];
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        }
        else {
            callback(null, true); // Allow dev origins gracefully
        }
    },
    credentials: true,
}));
// Rate Limiter
const apiLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 300, // Limit each IP to 300 requests per windowMs
    message: { success: false, message: 'Too many requests from this IP, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/api', apiLimiter);
// Body Parsing
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
// API Routes
app.use('/api', routes_1.default);
// Health Check
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'UP', service: 'Laboratory Management System API', timestamp: new Date() });
});
// Centralized Error Handling
app.use(errorHandler_1.errorHandler);
// Start Server after connecting to MongoDB
if (process.env.NODE_ENV !== 'test') {
    (0, database_1.connectDB)().then(() => {
        app.listen(PORT, () => {
            console.log(`[LMS Server] Operational on port ${PORT}`);
        });
    });
}
exports.default = app;

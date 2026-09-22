"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ENV = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.ENV = {
    PORT: process.env.PORT || 5000,
    MONGO_URI: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/lms_db',
    JWT_SECRET: process.env.JWT_SECRET || 'lms_jwt_secret_key_development_2026',
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'lms_jwt_refresh_secret_key_development_2026',
    CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:3000',
    EMAIL_API_KEY: process.env.EMAIL_API_KEY || '',
    SMS_API_KEY: process.env.SMS_API_KEY || '',
    WHATSAPP_API_KEY: process.env.WHATSAPP_API_KEY || '',
};

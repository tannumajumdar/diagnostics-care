import dotenv from 'dotenv';
dotenv.config();

export const ENV = {
  PORT: process.env.PORT || 5000,
  DATABASE_URL: process.env.DATABASE_URL || '',
  JWT_SECRET: process.env.JWT_SECRET || 'lms_jwt_secret_key_development_2026',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'lms_jwt_refresh_secret_key_development_2026',
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:3000',
  EMAIL_API_KEY: process.env.EMAIL_API_KEY || '',
  SMS_API_KEY: process.env.SMS_API_KEY || '',
  WHATSAPP_API_KEY: process.env.WHATSAPP_API_KEY || '',
};


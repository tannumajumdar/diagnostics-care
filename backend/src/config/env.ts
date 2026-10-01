import dotenv from 'dotenv';
dotenv.config();

export const ENV = {
  PORT: process.env.PORT || 5000,
  DATABASE_URL: process.env.DATABASE_URL || '',
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:3000',
  EMAIL_API_KEY: process.env.EMAIL_API_KEY || '',
  SMS_API_KEY: process.env.SMS_API_KEY || '',
  WHATSAPP_API_KEY: process.env.WHATSAPP_API_KEY || '',
};


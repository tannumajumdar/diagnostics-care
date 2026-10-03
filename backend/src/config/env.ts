import dotenv from 'dotenv';
dotenv.config();

export const ENV = {
  PORT: process.env.PORT || 5000,
  DATABASE_URL: process.env.DATABASE_URL || '',
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:3000',
  EMAIL_API_KEY: process.env.EMAIL_API_KEY || '',
  SMS_API_KEY: process.env.SMS_API_KEY || '',
  WHATSAPP_API_KEY: process.env.WHATSAPP_API_KEY || '',
  // ABDM (ABHA M1). Sandbox by default; the live hosts and CM id come with
  // production approval.
  ABDM_CLIENT_ID: process.env.ABDM_CLIENT_ID || '',
  ABDM_CLIENT_SECRET: process.env.ABDM_CLIENT_SECRET || '',
  ABDM_GATEWAY_URL: process.env.ABDM_GATEWAY_URL || 'https://dev.abdm.gov.in/api/hiecm/gateway/v3',
  ABDM_ABHA_URL: process.env.ABDM_ABHA_URL || 'https://abhasbx.abdm.gov.in/abha/api/v3',
  ABDM_CM_ID: process.env.ABDM_CM_ID || 'sbx',
  // 'true' answers every ABHA step locally (OTP 123456), 'false' never does;
  // unset, demo runs only while there are no credentials and NODE_ENV is not
  // production. See services/abdm.demo.ts.
  ABDM_DEMO: (process.env.ABDM_DEMO || '').trim().toLowerCase(),
};


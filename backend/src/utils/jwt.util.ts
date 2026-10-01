import jwt from 'jsonwebtoken';

// Read at call time, not import time, so the value from .env is the one used
// whatever order the modules load in. There is no fallback: a secret written
// in the code is a secret anyone with the code can sign an Admin token with.
const secret = (name: 'JWT_SECRET' | 'JWT_REFRESH_SECRET'): string => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set - add it to backend/.env`);
  return value;
};

export function generateAccessToken(payload: { userId: string; email: string; role: string; name: string }) {
  return jwt.sign(payload, secret('JWT_SECRET'), { expiresIn: '8h' });
}

export function generateRefreshToken(payload: { userId: string; email: string; role: string; name: string }) {
  return jwt.sign(payload, secret('JWT_REFRESH_SECRET'), { expiresIn: '7d' });
}

export function generateTokens(payload: { userId: string; email: string; role: string; name: string }) {
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);
  return { accessToken, refreshToken };
}

export function verifyAccessToken(token: string) {
  return jwt.verify(token, secret('JWT_SECRET')) as any;
}

export function verifyRefreshToken(token: string) {
  return jwt.verify(token, secret('JWT_REFRESH_SECRET')) as any;
}

export default {
  generateAccessToken,
  generateRefreshToken,
  generateTokens,
  verifyAccessToken,
  verifyRefreshToken,
};

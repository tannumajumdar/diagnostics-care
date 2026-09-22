import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'lms_jwt_secret_key_development_2026';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'lms_jwt_refresh_secret_key_development_2026';

export function generateAccessToken(payload: { userId: string; email: string; role: string; name: string }) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });
}

export function generateRefreshToken(payload: { userId: string; email: string; role: string; name: string }) {
  return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: '7d' });
}

export function generateTokens(payload: { userId: string; email: string; role: string; name: string }) {
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);
  return { accessToken, refreshToken };
}

export function verifyAccessToken(token: string) {
  return jwt.verify(token, JWT_SECRET) as any;
}

export function verifyRefreshToken(token: string) {
  return jwt.verify(token, JWT_REFRESH_SECRET) as any;
}

export default {
  generateAccessToken,
  generateRefreshToken,
  generateTokens,
  verifyAccessToken,
  verifyRefreshToken,
};

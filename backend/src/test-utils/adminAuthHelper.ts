import request from 'supertest';
import { Express } from 'express';

export async function getAdminAccessToken(
  app: Express,
  email = process.env.ADMIN_EMAIL ?? 'admin@example.com',
  password = process.env.ADMIN_PASSWORD ?? 'AdminPass1'
): Promise<string> {
  const res = await request(app)
    .post('/api/admin/auth/login')
    .send({ email, password });
  if (res.status !== 200) {
    throw new Error(`Admin login failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body.data.accessToken as string;
}

export function withAdminAuth(token: string) {
  return { Authorization: `Bearer ${token}` };
}

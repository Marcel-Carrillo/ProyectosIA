import appleSignin from 'apple-signin-auth';
import { getOAuthCallbackUrl } from './oauthConfig';

function getApplePrivateKey(): string {
  return (process.env.APPLE_PRIVATE_KEY ?? '').replace(/\\n/g, '\n');
}

function getAppleClientSecret(): string {
  return appleSignin.getClientSecret({
    clientID: process.env.APPLE_CLIENT_ID!,
    teamID: process.env.APPLE_TEAM_ID!,
    keyIdentifier: process.env.APPLE_KEY_ID!,
    privateKey: getApplePrivateKey(),
  });
}

export function getAppleAuthorizationUrl(state: string): string {
  const clientId = process.env.APPLE_CLIENT_ID!;
  const redirectUri = getOAuthCallbackUrl('apple');
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code id_token',
    response_mode: 'form_post',
    scope: 'name email',
    state,
  });
  return `https://appleid.apple.com/auth/authorize?${params.toString()}`;
}

export async function exchangeAppleCode(code: string): Promise<{
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}> {
  const clientId = process.env.APPLE_CLIENT_ID!;
  const redirectUri = getOAuthCallbackUrl('apple');
  const clientSecret = getAppleClientSecret();

  const tokenResponse = await appleSignin.getAuthorizationToken(code, {
    clientID: clientId,
    clientSecret,
    redirectUri,
  });

  if (!tokenResponse.id_token) {
    throw new Error('Apple id_token missing');
  }

  const payload = await appleSignin.verifyIdToken(tokenResponse.id_token, {
    audience: clientId,
  });

  if (!payload.sub) {
    throw new Error('Apple subject missing');
  }
  if (!payload.email) {
    throw new Error('Apple email missing');
  }

  return {
    id: payload.sub,
    email: payload.email,
    firstName: 'Apple',
    lastName: 'User',
  };
}

export function parseAppleUserField(userJson?: string): { firstName: string; lastName: string } {
  if (!userJson) {
    return { firstName: 'Apple', lastName: 'User' };
  }
  try {
    const user = JSON.parse(userJson) as {
      name?: { firstName?: string; lastName?: string };
    };
    return {
      firstName: user.name?.firstName ?? 'Apple',
      lastName: user.name?.lastName ?? 'User',
    };
  } catch {
    return { firstName: 'Apple', lastName: 'User' };
  }
}

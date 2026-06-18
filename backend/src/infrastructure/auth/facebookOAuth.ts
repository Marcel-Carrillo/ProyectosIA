import { getOAuthCallbackUrl } from './oauthConfig';

const FACEBOOK_GRAPH = 'https://graph.facebook.com/v21.0';

export function getFacebookAuthorizationUrl(state: string): string {
  const appId = process.env.FACEBOOK_APP_ID!;
  const redirectUri = getOAuthCallbackUrl('facebook');
  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    state,
    scope: 'email,public_profile',
    response_type: 'code',
  });
  return `https://www.facebook.com/v21.0/dialog/oauth?${params.toString()}`;
}

export async function exchangeFacebookCode(code: string): Promise<{
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}> {
  const appId = process.env.FACEBOOK_APP_ID!;
  const appSecret = process.env.FACEBOOK_APP_SECRET!;
  const redirectUri = getOAuthCallbackUrl('facebook');

  const tokenParams = new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    redirect_uri: redirectUri,
    code,
  });
  const tokenRes = await fetch(`${FACEBOOK_GRAPH}/oauth/access_token?${tokenParams.toString()}`);
  if (!tokenRes.ok) {
    throw new Error('Facebook token exchange failed');
  }
  const tokenBody = (await tokenRes.json()) as { access_token?: string };
  if (!tokenBody.access_token) {
    throw new Error('Facebook token missing');
  }

  const profileParams = new URLSearchParams({
    fields: 'id,email,first_name,last_name',
    access_token: tokenBody.access_token,
  });
  const profileRes = await fetch(`${FACEBOOK_GRAPH}/me?${profileParams.toString()}`);
  if (!profileRes.ok) {
    throw new Error('Facebook profile fetch failed');
  }
  const profile = (await profileRes.json()) as {
    id?: string;
    email?: string;
    first_name?: string;
    last_name?: string;
  };
  if (!profile.id || !profile.email) {
    throw new Error('Facebook profile incomplete');
  }

  return {
    id: profile.id,
    email: profile.email,
    firstName: profile.first_name ?? 'User',
    lastName: profile.last_name ?? '',
  };
}

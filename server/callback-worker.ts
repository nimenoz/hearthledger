/**
 * Battle.net OAuth callback for the Armoury.
 *
 * The app opens https://oauth.battle.net/authorize with redirect_uri = this Worker's CALLBACK_URL.
 * Battle.net sends the browser back here with ?code=...&state=...; we exchange the code for an
 * access token using the client secret (which never leaves the server), then send the browser to
 * the app's return URL with the token in the URL fragment. Fragments are not sent to servers.
 */

export interface Env {
  BATTLENET_CLIENT_ID: string;
  BATTLENET_CLIENT_SECRET: string;
  /** Exact redirect URI registered with Battle.net, e.g. https://auth.example.com/battlenet/callback */
  CALLBACK_URL: string;
  /** App return URL, e.g. hearthledger://armoury */
  APP_RETURN_URL: string;
}

export const TOKEN_URL = 'https://oauth.battle.net/token';

export function buildAppReturnUrl(appReturnUrl: string, params: Record<string, string>): string {
  const fragment = Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  return `${appReturnUrl}#${fragment}`;
}

function redirect(location: string): Response {
  return new Response(null, { status: 302, headers: { Location: location, 'Cache-Control': 'no-store' } });
}

function fail(env: Env, state: string | null, error: string): Response {
  return redirect(buildAppReturnUrl(env.APP_RETURN_URL, { error, ...(state ? { state } : {}) }));
}

export async function handleCallback(request: Request, env: Env, fetchImpl: typeof fetch = fetch): Promise<Response> {
  if (request.method !== 'GET') return new Response('Method not allowed', { status: 405 });

  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const providerError = url.searchParams.get('error');

  if (providerError) return fail(env, state, providerError);
  if (!code || !state) return new Response('Missing code or state', { status: 400 });

  const basic = btoa(`${env.BATTLENET_CLIENT_ID}:${env.BATTLENET_CLIENT_SECRET}`);
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: env.CALLBACK_URL,
  });

  const tokenRes = await fetchImpl(TOKEN_URL, {
    method: 'POST',
    headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body,
  });
  if (!tokenRes.ok) return fail(env, state, `token_exchange_${tokenRes.status}`);

  const json = (await tokenRes.json()) as { access_token?: unknown; expires_in?: unknown };
  if (typeof json.access_token !== 'string' || typeof json.expires_in !== 'number') {
    return fail(env, state, 'token_invalid');
  }

  return redirect(
    buildAppReturnUrl(env.APP_RETURN_URL, {
      access_token: json.access_token,
      expires_in: String(json.expires_in),
      state,
    }),
  );
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return handleCallback(request, env);
  },
};

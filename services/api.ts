import { API_CONFIG } from '../constants/api';

const { ENDPOINTS } = API_CONFIG;

function authHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

export async function startRaffle(
  token: string,
  params: {
    keyword: string;
    game: string;
    streamer: string;
    twitchChannel?: string;
    subMult?: number;
    giftMult?: number;
  },
): Promise<Response> {
  return fetch(ENDPOINTS.RAFFLE_START, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(params),
  });
}

export async function stopRaffle(token: string): Promise<Response> {
  return fetch(ENDPOINTS.RAFFLE_STOP, {
    method: 'POST',
    headers: authHeaders(token),
  });
}

export async function pickWinner(token: string): Promise<Response> {
  return fetch(ENDPOINTS.PICK_WINNER, {
    method: 'POST',
    headers: authHeaders(token),
  });
}

export async function getSubs(token: string): Promise<Response> {
  return fetch(ENDPOINTS.SUBS, {
    headers: authHeaders(token),
  });
}

export async function getSubsHistory(
  token: string,
  params: { startDate?: string; endDate?: string; subType?: string },
): Promise<Response> {
  const url = new URL(ENDPOINTS.SUBS_HISTORY);
  if (params.startDate) url.searchParams.set('startDate', params.startDate);
  if (params.endDate) url.searchParams.set('endDate', params.endDate);
  if (params.subType) url.searchParams.set('subType', params.subType);
  return fetch(url.toString(), { headers: authHeaders(token) });
}

export async function getChatters(token: string): Promise<Response> {
  return fetch(ENDPOINTS.CHATTERS, {
    headers: authHeaders(token),
  });
}

export async function getFollowers(
  token: string,
  params: { startDate?: string; endDate?: string; streamerNick: string },
): Promise<Response> {
  return fetch(ENDPOINTS.FOLLOWERS, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(params),
  });
}

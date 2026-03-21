// constants/api.ts
const BASE_URL = "https://manti-twitch-backend.onrender.com";

export const API_CONFIG = {
  BASE_URL,
  ENDPOINTS: {
    // Auth
    AUTH_TWITCH: `${BASE_URL}/auth/twitch`,
    
    // Twitch Data
    SUBS: `${BASE_URL}/api/twitch/subs`,
    SUBS_HISTORY: `${BASE_URL}/api/twitch/subs-history`,
    CHATTERS: `${BASE_URL}/api/twitch/chatters`,
    FOLLOWERS: `${BASE_URL}/api/twitch/followers-between-dates`,
    
    // Raffle
    RAFFLE_START: `${BASE_URL}/api/raffle/start`,
    RAFFLE_STOP: `${BASE_URL}/api/raffle/stop`,
    PICK_WINNER: `${BASE_URL}/api/raffle/pick-winner`,
  }
};
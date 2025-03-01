// constants

// secrets
export const soggeeboiUserId = process.env.SOGGEEBOI_USERID;
export const soggeebotUserId = process.env.SOGGEEBOT_USERID;
export const soggeebotClientId = process.env.SOGGEEBOT_CLIENTID;

// twitch urls
export const eventsubWSUrl = "wss://eventsub.wss.twitch.tv/ws";
export const twitchBanUserUrl = "https://api.twitch.tv/helix/moderation/bans";
export const twitchChatUrl = "https://api.twitch.tv/helix/chat/messages";
export const twitchAnnouncementUrl = "https://api.twitch.tv/helix/chat/announcements";
export const twitchChannelInfoUrl = "https://api.twitch.tv/helix/channels";
export const twitchShoutoutUrl = "https://api.twitch.tv/helix/chat/shoutouts";
export const twitchChatColorUrl = "https://api.twitch.tv/helix/chat/color";
export const twitchEventsubUrl = "https://api.twitch.tv/helix/eventsub/subscriptions";
export const twitchGetUsersUrl = "https://api.twitch.tv/helix/users";
export const twitchOAuthUrl = "https://id.twitch.tv/oauth2/validate";
export const twitchTokenUrl = "https://id.twitch.tv/oauth2/token";

export const ALL = "all";
export const BROADCASTER = "broadcaster"
export const CUSTOM = "custom";
export const MOD = "moderator";
export const SIMPLE = "simple";

export const TIMEOUT_THRESHOLD = 10;
export const TIMEOUT_RESET = 5000;
export const DEFAULT_COOLDOWN = 2000;
export const PERIODIC_DELAY = 10 * 60 * 1000;

// auth.js
// token handling via OAuth2

import { info, error } from "./log.js";
import { sendTwitchAPIRequest, soggeebotClientId } from "./soggeebot.js";

const soggeebotAuthCode = process.env.SOGGEEBOT_AUTHCODE;
const soggeebotClientSecret = process.env.SOGGEEBOT_CLIENTSECRET;

var soggeebotOAuthAccessToken = process.env.SOGGEEBOT_OAUTHTOKEN;
var soggeebotOAuthRefreshToken = process.env.SOGGEEBOT_REFRESHTOKEN;

const twitchTokenUrl = "https://id.twitch.tv/oauth2/token";
const twitchOAuthUrl = "https://id.twitch.tv/oauth2/validate";

export function accessToken() {
    return soggeebotOAuthAccessToken;
}

export async function secureToken() {
    let response = await fetch(twitchTokenUrl, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
            "client_id": soggeebotClientId,
            "client_secret": soggeebotClientSecret,
            "code": soggeebotAuthCode,
            "grant_type": "authorization_code",
            "redirect_uri": "http://localhost"
        })
    });

    if (response.status != 200) {
        let data = await response.json();
        error("Failed to secure OAuth token");
        error(data.message);
        process.exit(1);
    }

    const data = await response.json();
    soggeebotOAuthAccessToken = data["access_token"];
    soggeebotOAuthRefreshToken = data["refresh_token"];

    //console.log("AccessToken: " + soggeebotOAuthAccessToken);
    //console.log("RefreshToken: " + soggeebotOAuthRefreshToken);
}

export async function validateToken() {
    let response = await sendTwitchAPIRequest(twitchOAuthUrl, {
        method: "GET",
        headers: {
            "Authorization": "OAuth " + soggeebotOAuthAccessToken
        }
    });

    if (response.status != 200) {
        let data = await response.json();
        error("Token is not valid. /oauth2/validate returned status code " + response.status);
        error(data.message);
        process.exit(1);
    }

    info("Validated OAuth token. Authenication successful.");
}

export async function attemptRefreshToken() {
    info("Attempting to refresh token...");
    let response = await fetch(twitchTokenUrl, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
            "client_id": soggeebotClientId,
            "client_secret": soggeebotClientSecret,
            "grant_type": "refresh_token",
            "refresh_token": soggeebotOAuthRefreshToken
        })
    });

    if (response.status != 200) {
        let data = await response.json();
        error("Failed to acquire new OAuth access token via refresh token");
        error(data.message);
        process.exit(1); // if auth not valid, not reason to try running the bot
    }

    const data = await response.json();
    soggeebotOAuthAccessToken = data["access_token"];
    soggeebotOAuthRefreshToken = data["refresh_token"];
    //console.log("New AccessToken: " + soggeebotOAuthAccessToken);
    //console.log("New RefreshToken: " + soggeebotOAuthRefreshToken);
    //console.log(data);
    info("Successfully refreshed OAuth access token");
}

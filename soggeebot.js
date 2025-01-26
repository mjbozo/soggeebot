// soggeebot

import { debug, info, log, warn, error, LogLevels } from "./log.js";
import { secureToken, validateToken, attemptRefreshToken, accessToken } from "./auth.js";
import { subscribeToChannelFollow, subscribeToChatMessage, subscribeToChannelOnline, subscribeToChannelRaid } from "./eventSubs.js";

export const soggeeboiUserId = process.env.SOGGEEBOI_USERID;
export const soggeebotUserId = process.env.SOGGEEBOT_USERID;
export const soggeebotClientId = process.env.SOGGEEBOT_CLIENTID;

const eventsubWSUrl = "wss://eventsub.wss.twitch.tv/ws";
const twitchChatUrl = "https://api.twitch.tv/helix/chat/messages";
const twitchChannelInfoUrl = "https://api.twitch.tv/helix/channels";
const twitchShoutoutUrl = "https://api.twitch.tv/helix/chat/shoutouts";

export var websocketSessionId;
const commands = {};

export const logLevel = LogLevels.DEBUG;


var first = new Set();
var forceNewAccessToken = false;

for (let arg of process.argv) {
    if (arg == "--forceToken") {
        forceNewAccessToken = true;
    }
}

// run soggeebot
start();

async function start() {
    if (!accessToken() || forceNewAccessToken) {
        await secureToken();
        return;
    } else {
        await attemptRefreshToken();
    }

    await validateToken();
    startWebSocketClient();
}

function startWebSocketClient() {
    registerCommands();

    let wsClient = new WebSocket(eventsubWSUrl);

    wsClient.addEventListener("error", (err) => {
        error(err);
    });

    wsClient.addEventListener("open", () => {
        info("WebSocket connection opened to " + eventsubWSUrl);
    });

    wsClient.addEventListener("message", (event) => {
        handleMessage(JSON.parse(event.data.toString()));
    });

    return wsClient;
}

async function registerEventsubListeners() {
    subscribeToChatMessage();
    subscribeToChannelFollow();
    subscribeToChannelOnline();
    subscribeToChannelRaid();
}

function registerCommands() {
    commands["!vibecheck"] = function(data) {
        const soggeeFactor = Math.round((Math.random() * 100));
        var suffix = "";
        if (soggeeFactor < 10) {
            suffix = ". yikes."
        }
        if (soggeeFactor > 90) {
            suffix = ". DinoDance DinoDance"
        }
        sendChatMessage(`${data.payload.event.chatter_user_login} is ${soggeeFactor}% soggy${suffix}`)
    }

    commands["!first"] = function(data) {
        if (first.size == 0) {
            first.add(data.payload.event.chatter_user_name);
            sendChatMessage(`gg @${data.payload.event.chatter_user_name} wins`);
        } else if (!first.has(data.payload.event.chatter_user_name)) {
            first.add(data.payload.event.chatter_user_name);
            sendChatMessage(`Too slow ${data.payload.event.chatter_user_name}!`);
        }
    }
}

function handleMessage(data) {
    switch (data.metadata.message_type) {
        case "session_welcome":
            websocketSessionId = data.payload.session.id;
            registerEventsubListeners();
            break;

        case "notification":
            switch (data.metadata.subscription_type) {
                case "channel.chat.message":
                    log(`MSG <${data.payload.event.chatter_user_login}>: ${data.payload.event.message.text}`);

                    if (data.payload.event.message.text.trim().includes("soggee") &&
                        data.payload.event.chatter_user_login != "soggeebot") {
                        sendChatMessage("DinoDance");
                    }

                    if (data.payload.event.message.text.startsWith("!") &&
                        data.payload.event.message.text in commands) {
                        commands[data.payload.event.message.text.trim()](data);
                    }

                    // TODO: Remove this block after testing
                    if (data.payload.event.message.text == "testOnline") {
                        log(`ONLINE <${data.payload.event.broadcaster_user_name}> is now live`);
                        getStreamInfo(soggeeboiUserId).then(async (streamData) => {
                            await sendChatMessage(`soggeeboi is now live! Streaming ${streamData.category}: ${streamData.title}.`);
                            sendChatMessage("Welcome to the stream, we will get to the good stuff shortly DinoDance");
                        }).catch(error);
                    }

                    if (data.payload.event.message.text == "testRaid") {
                        log(`RAID <${data.payload.event.from_broadcaster_user_name}> raided`);
                        getStreamInfo(data.payload.event.from_broadcaster_user_id ?? 12826).then(async (streamData) => {
                            sendShoutout(data.payload.event.from_broadcaster_user_id ?? 12826).then(async () => {
                                await sendChatMessage(`It just got a whole lot soggier in here, welcome raiders! PogChamp PogChamp`);
                                sendChatMessage(`${streamData.name} just raided with ${data.payload.event.viewers ?? 69} absolute legends. They were streaming ${streamData.category}`);
                            }).catch(e => error(e.message));
                        }).catch(error);
                    }

                    break;

                case "channel.follow":
                    log(`FOLLOW <${data.payload.event.user_name}> has followed`)
                    sendChatMessage(`Thanks ${data.payload.event.user_name} for the follow! Truly a soggy one.`);
                    break;

                case "stream.online":
                    log(`ONLINE <${data.payload.event.broadcaster_user_name}> is now live`);
                    getStreamInfo(soggeeboiUserId).then(async (streamData) => {
                        await sendChatMessage(`soggeeboi is now live! Streaming ${streamData.category}: ${streamData.title}.`);
                        sendChatMessage("Welcome to the stream, we will get to the good stuff shortly DinoDance");
                    }).catch(error);
                    break;

                case "channel.raid":
                    log(`RAID <${data.payload.event.from_broadcaster_user_name}> raided`);
                    getStreamInfo(data.payload.event.from_broadcaster_user_id).then(async (streamData) => {
                        sendShoutout(data.payload.event.from_broadcaster_id).then(async () => {
                            await sendChatMessage(`It just got a whole lot soggier in here, welcome raiders! PogChamp PogChamp`);
                            sendChatMessage(`${data.payload.event.from_broadcaster_user_name} just raided with ${data.payload.event.viewers} absolute legends. They were streaming ${streamData.category}`);
                        }).catch(e => error(e.message));
                    }).catch(error);
            }
            break;
    }
}

async function sendChatMessage(chatMessage) {
    let response = await sendTwitchAPIRequest(twitchChatUrl, {
        method: "POST",
        headers: {
            "Authorization": "Bearer " + accessToken(),
            "Client-Id": soggeebotClientId,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            "broadcaster_id": soggeeboiUserId,
            "sender_id": soggeebotUserId,
            "message": chatMessage
        })
    });

    if (response.status != 200) {
        let data = await response.json();
        error("Failed to send chat message");
        error(data.message);
        return
    }

    info("Successfully send chat message: " + chatMessage);
}

export async function sendTwitchAPIRequest(url, requestData) {
    let response = await fetch(url, requestData);

    if (response.status == 401) {
        info(`Received 401 response from ${url}; attempting to refresh OAuth access token`);
        await attemptRefreshToken();

        // update auth header in request
        const originalAuthHeader = requestData.headers["Authorization"];
        const originalAuthType = originalAuthHeader.split(" ")[0];
        requestData.headers["Authorization"] = originalAuthType + " " + accessToken();

        response = await fetch(url, requestData);
    }

    return response;
}

async function getStreamInfo(userId) {
    let response = await fetch(twitchChannelInfoUrl + "?broadcaster_id=" + userId, {
        method: "GET",
        headers: {
            "Authorization": "Bearer " + accessToken(),
            "Client-Id": soggeebotClientId
        }
    });

    if (response.status != 200) {
        const errMsg = "Failed to fetch stream info. API call received status code " + response.status;
        error(errMsg);
        throw new Error(errMsg);
    }

    const res = await response.json();
    const streamData = {
        name: res.data[0].broadcaster_name,
        title: res.data[0].title,
        category: res.data[0].game_name
    };
    return streamData;
}

async function sendShoutout(userId) {
    let response = await fetch(`${twitchShoutoutUrl}?from_broadcaster_id=${soggeeboiUserId}&to_broadcaster_id=${userId}&moderator_id=${soggeebotUserId}`, {
        method: "POST",
        headers: {
            "Authorization": "Bearer " + accessToken(),
            "Client-Id": soggeebotClientId
        }
    });

    if (response.status != 204) {
        let data = await response.json();
        const errMsg = "Failed to give shoutout. API call received status code " + response.status + ". Error: " + data.message;
        throw new Error(errMsg);
    }
}

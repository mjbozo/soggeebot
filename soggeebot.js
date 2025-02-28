// soggeebot.js
// bot entry point and setup

import { secureToken, validateToken, attemptRefreshToken, accessToken } from "./auth.js";
import { registerCommands, executeCommand } from "./commands.js";
import * as constants from "./constants.js";
import * as eventSub from "./eventSubs.js";
import { info, log, error } from "./log.js";
import { popPeriodicMessage, updatePeriodicMsgCounts } from "./periodic.js";

export var greeted = new Set();
export var websocketSessionId;

var userMsgs = {};


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

    setInterval(() => {
        userMsgs = {};
    }, constants.TIMEOUT_RESET);


    await validateToken();
    await setChatColour();
    startWebSocketClient();
}


function startWebSocketClient() {
    registerCommands();

    let wsClient = new WebSocket(constants.eventsubWSUrl);

    wsClient.addEventListener("error", (err) => {
        error(err);
    });

    wsClient.addEventListener("open", () => {
        info("WebSocket connection opened to " + constants.eventsubWSUrl);
    });

    wsClient.addEventListener("message", (event) => {
        handleMessage(JSON.parse(event.data.toString()));
    });

    return wsClient;
}

function registerEventsubListeners() {
    eventSub.subscribeToChatMessage();
    eventSub.subscribeToChannelFollow();
    eventSub.subscribeToChannelOnline();
    eventSub.subscribeToChannelRaid();
}

function registerPeriodicMessages() {
    setInterval(() => {
        const msg = popPeriodicMessage();
        if (msg !== null) {
            sendChatMessage(msg.msg);
        }
    }, constants.PERIODIC_DELAY);
}

function handleMessage(data) {
    switch (data.metadata.message_type) {
        case "session_welcome":
            websocketSessionId = data.payload.session.id;
            registerEventsubListeners();
            registerPeriodicMessages();
            break;

        case "notification":
            switch (data.metadata.subscription_type) {
                case "channel.chat.message":
                    log(`MSG <${data.payload.event.chatter_user_login}>: ${data.payload.event.message.text}`);

                    if (data.payload.event.chatter_user_id !== constants.soggeebotUserId) {
                        updatePeriodicMsgCounts();
                    }

                    userMsgs[data.payload.event.chatter_user_id] = (userMsgs[data.payload.event.chatter_user_id] ?? 0) + 1;
                    if (userMsgs[data.payload.event.chatter_user_id] > constants.TIMEOUT_THRESHOLD) {
                        timeoutUser(data.payload.event.chatter_user_id);
                    }

                    if (data.payload.event.message.text.trim().includes("soggee") &&
                        data.payload.event.chatter_user_login != "soggeebot") {
                        sendChatMessage("DinoDance");
                    }

                    if (data.payload.event.message.text.startsWith("!")) {
                        let msgSegments = data.payload.event.message.text.trim().split(" ");
                        executeCommand(msgSegments[0], data);
                    }

                    break;

                case "channel.follow":
                    log(`FOLLOW <${data.payload.event.user_name}> has followed`)
                    sendChatMessage(`Thanks ${data.payload.event.user_name} for the follow! Truly a soggy one.`);
                    break;

                case "stream.online":
                    log(`ONLINE <${data.payload.event.broadcaster_user_name}> is now live`);
                    greeted = new Set();
                    getStreamInfo(constants.soggeeboiUserId).then(async (streamData) => {
                        setTimeout(async () => {
                            await sendAnnouncement(`soggeeboi is now live! Streaming ${streamData.category}: ${streamData.title}.`);
                            sendChatMessage("Welcome to the stream, we will get to the good stuff shortly DinoDance");
                        }, 10000);
                    }).catch(error);
                    break;

                case "channel.raid":
                    log(`RAID <${data.payload.event.from_broadcaster_user_name}> raided with ${data.payload.event.viewers ?? 0} viewers`);
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

export async function sendChatMessage(chatMessage) {
    let response = await sendTwitchAPIRequest(constants.twitchChatUrl, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${accessToken()}`,
            "Client-Id": constants.soggeebotClientId,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            "broadcaster_id": constants.soggeeboiUserId,
            "sender_id": constants.soggeebotUserId,
            "message": chatMessage
        })
    });

    if (response.status != 200) {
        let data = await response.json();
        error("Failed to send chat message");
        error(data.message);
        return;
    }

    info("Successfully send chat message: " + chatMessage);
}

export async function sendChatReply(msgId, chatMessage) {
    let response = await sendTwitchAPIRequest(constants.twitchChatUrl, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${accessToken()}`,
            "Client-Id": constants.soggeebotClientId,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            "broadcaster_id": constants.soggeeboiUserId,
            "sender_id": constants.soggeebotUserId,
            "message": chatMessage,
            "reply_parent_message_id": msgId
        })
    });

    if (response.status != 200) {
        let data = await response.json();
        error("Failed to send chat reply");
        error(data.message);
        return;
    }

    info("Successfully send chat reply: " + chatMessage);
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
    let response = await fetch(constants.twitchChannelInfoUrl + "?broadcaster_id=" + userId, {
        method: "GET",
        headers: {
            "Authorization": `Bearer ${accessToken()}`,
            "Client-Id": constants.soggeebotClientId
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

export async function sendShoutout(userId) {
    let response = await fetch(`${constants.twitchShoutoutUrl}?from_broadcaster_id=${constants.soggeeboiUserId}&to_broadcaster_id=${userId}&moderator_id=${constants.soggeebotUserId}`, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${accessToken()}`,
            "Client-Id": constants.soggeebotClientId
        }
    });

    if (response.status != 204) {
        let data = await response.json();
        const errMsg = "Failed to give shoutout. API call received status code " + response.status + ". Error: " + data.message;
        error(errMsg);
    }
}

async function timeoutUser(userId) {
    let response = await sendTwitchAPIRequest(`${constants.twitchBanUserUrl}?broadcaster_id=${constants.soggeeboiUserId}&moderator_id=${constants.soggeebotUserId}`, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${accessToken()}`,
            "Client-Id": constants.soggeebotClientId,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            data: {
                user_id: userId,
                duration: 60,
                reason: "spam"
            }
        })
    });

    if (response.status != 200) {
        let data = await response.json();
        error("Failed to timeout user");
        error(data.message);
        return;
    }

    info("User timed out");
}

export function hasBadge(badges, badgeToCheck) {
    for (let badge of badges) {
        if (badge.set_id === badgeToCheck || badge.set_id == constants.BROADCASTER) {
            return true;
        }
    }
    return false;
}

async function setChatColour() {
    let response = await sendTwitchAPIRequest(constants.twitchChatColorUrl, {
        method: "PUT",
        body: JSON.stringify({
            user_id: constants.soggeebotUserId,
            color: "blue_violet"
        }),
        headers: {
            "Authorization": `Bearer ${accessToken()}`,
            "Client-Id": constants.soggeebotClientId,
            "Content-Type": "application/json"
        }
    });

    if (response.status != 204) {
        let data = await response.json();
        error("Failed to set chat colour");
        error(data.message);
        return;
    }

    info("Successfully updated chat colour");
}

export async function sendAnnouncement(announcementMsg) {
    let response = await sendTwitchAPIRequest(`${constants.twitchAnnouncementUrl}?broadcaster_id=${constants.soggeeboiUserId}&moderator_id=${constants.soggeebotUserId}`, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${accessToken()}`,
            "Client-Id": constants.soggeebotClientId,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            "message": announcementMsg
        })
    });

    if (response.status != 204) {
        let data = await response.json();
        error("Failed to send chat message");
        error(data.message);
        return;
    }

    info("Successfully send chat message: " + announcementMsg);
}

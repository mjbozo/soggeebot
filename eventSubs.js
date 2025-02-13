// eventSubs.js
// requests to subscribe to Twitch's event sub

import { accessToken } from "./auth.js";
import { soggeeboiUserId, soggeebotUserId, soggeebotClientId, twitchEventsubUrl } from "./constants.js";
import { warn, error, success } from "./log.js";
import {
    sendTwitchAPIRequest,
    websocketSessionId
} from "./soggeebot.js";


async function sendSubscribeRequest(body) {
    let response = await sendTwitchAPIRequest(twitchEventsubUrl, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${accessToken()}`,
            "Client-Id": soggeebotClientId,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
    });

    return response;
}

async function handleResponse(response, sub, exitOnFail = false) {
    let data = await response.json();
    if (response.status != 202) {
        if (exitOnFail) {
            error(`Failed to subscribe to ${sub}. API call returned status code ` + response.status);
            error(data.message);
            process.exit(1);
        } else {
            warn(`Failed to subscribe to ${sub}. API call returned status code ` + response.status);
            warn(data.message);
        }
    } else {
        success(`Subscribed to ${sub}`);
    }
}

export async function subscribeToChatMessage() {
    let chatMessageSubResponse = await sendSubscribeRequest({
        type: "channel.chat.message",
        version: "1",
        condition: {
            broadcaster_user_id: soggeeboiUserId,
            user_id: soggeebotUserId
        },
        transport: {
            method: "websocket",
            session_id: websocketSessionId
        }
    });

    handleResponse(chatMessageSubResponse, "channel.chat.message", true);
}

export async function subscribeToChannelFollow() {
    let channelFollowSubResponse = await sendSubscribeRequest({
        type: "channel.follow",
        version: "2",
        condition: {
            broadcaster_user_id: soggeeboiUserId,
            moderator_user_id: soggeebotUserId
        },
        transport: {
            method: "websocket",
            session_id: websocketSessionId
        }
    });

    handleResponse(channelFollowSubResponse, "channel.follow");
}

export async function subscribeToChannelOnline() {
    let streamOnlineSubResponse = await sendSubscribeRequest({
        type: "stream.online",
        version: "1",
        condition: {
            broadcaster_user_id: soggeeboiUserId
        },
        transport: {
            method: "websocket",
            session_id: websocketSessionId
        }
    });

    handleResponse(streamOnlineSubResponse, "stream.online");
}

export async function subscribeToChannelRaid() {
    let raidSubResponse = await sendSubscribeRequest({
        type: "channel.raid",
        version: "1",
        condition: {
            to_broadcaster_user_id: soggeeboiUserId
        },
        transport: {
            method: "websocket",
            session_id: websocketSessionId
        }
    });

    handleResponse(raidSubResponse, "channel.raid");
}


// commands.js
// manage all commands

import { accessToken } from "./auth.js";
import { ALL, BROADCASTER, CUSTOM, DEFAULT_COOLDOWN, MOD, SIMPLE, soggeebotClientId, twitchGetUsersUrl } from "./constants.js";
import { sendAnnouncement, hasBadge, sendChatMessage, sendShoutout, sendTwitchAPIRequest, greeted, sendChatReply } from "./soggeebot.js";

const commands = {};

export function registerCommands() {
    commands["!today"] = {
        type: SIMPLE,
        allowed: ALL,
        cooldown: DEFAULT_COOLDOWN,
        lastUsedGlobal: Date.now(),
        msg: "I'm working on my twitch chat bot, soggeebot! 🤖"
    };

    commands["!code"] = {
        type: SIMPLE,
        allowed: ALL,
        cooldown: DEFAULT_COOLDOWN,
        lastUsedGlobal: Date.now(),
        msg: "Check out the repo here -> https://github.com/mjbozo/soggeebot"
    }

    commands["!vibecheck"] = {
        type: CUSTOM,
        allowed: ALL,
        cooldown: 60000,
        lastUsedPerUser: {},
        f: function(data) {
            const soggeeFactor = Math.round((Math.random() * 100));
            var suffix = "";
            if (soggeeFactor < 10) {
                suffix = ". yikes."
            }
            if (soggeeFactor > 90) {
                suffix = ". DinoDance DinoDance"
            }
            sendChatMessage(`${data.payload.event.chatter_user_name} is ${soggeeFactor}% soggy${suffix}`)
        }
    };

    commands["!hello"] = {
        type: CUSTOM,
        allowed: ALL,
        cooldown: 0,
        f: function(data) {
            if (!greeted.has(data.payload.event.chatter_user_name)) {
                greeted.add(data.payload.event.chatter_user_name);
                sendChatMessage(`Hi ${data.payload.event.chatter_user_name} :)`);
            }
        }
    };

    commands["!addcmd"] = {
        type: CUSTOM,
        allowed: MOD,
        cooldown: 0,
        f: function(data) {
            let msgSegments = data.payload.event.message.text.trim().split(" ");
            if (msgSegments.length < 3) {
                return;
            }

            const cmdToAdd = msgSegments[1];
            if (!cmdToAdd.startsWith("!")) {
                sendChatReply(data.payload.event.message_id, "u dumb");
                return;
            }

            if (cmdToAdd in commands) {
                sendChatReply(data.payload.event.message_id, `Command ${cmdToAdd} already exists, dummy`);
                return;
            }

            const newResponse = msgSegments.slice(2, msgSegments.length).join(" ");
            commands[cmdToAdd] = {
                type: SIMPLE,
                allowed: ALL,
                msg: newResponse
            };

            sendChatReply(data.payload.event.message_id, `Command ${cmdToAdd} added`);
        }
    };

    commands["!editcmd"] = {
        type: CUSTOM,
        allowed: MOD,
        cooldown: 0,
        f: function(data) {
            let msgSegments = data.payload.event.message.text.trim().split(" ");
            if (msgSegments.length < 3) {
                return;
            }

            const cmdToEdit = msgSegments[1];
            if (!cmdToEdit.startsWith("!")) {
                sendChatReply(data.payload.event.message_id, "u dumb");
                return;
            }

            if (!(cmdToEdit in commands)) {
                sendChatReply(data.payload.event.message_id, `Command ${cmdToEdit} does not exist, dummy`);
                return;
            }

            if (commands[cmdToEdit].type != SIMPLE) {
                sendChatReply(data.payload.event.message_id, "Can only edit simple commands, dummy");
                return;
            }

            const newResponse = msgSegments.slice(2, msgSegments.length).join(" ");
            commands[cmdToEdit].msg = newResponse;
            sendChatReply(data.payload.event.message_id, `Command ${cmdToEdit} updated successfully`);
        }
    };

    commands["!rmcmd"] = {
        type: CUSTOM,
        allowed: MOD,
        cooldown: 0,
        f: function(data) {
            let msgSegments = data.payload.event.message.text.trim().split(" ");
            if (msgSegments.length != 2) {
                return;
            }

            const cmdToDelete = msgSegments[1];
            if (!cmdToDelete.startsWith("!")) {
                sendChatReply(data.payload.event.message_id, "u dumb");
                return;
            }

            if (!(cmdToDelete in commands)) {
                sendChatReply(data.payload.event.message_id, `Command ${cmdToDelete} does not exists, dummy`);
                return;
            }

            if (commands[cmdToDelete].type != SIMPLE) {
                sendChatReply(data.payload.event.message_id, "Can only remove simple commands, dummy");
                return;
            }

            delete commands[cmdToDelete];
            sendChatReply(data.payload.event.message_id, `Command ${cmdToDelete} deleted`);
        }
    }

    commands["!so"] = {
        type: CUSTOM,
        allowed: MOD,
        cooldown: 0,
        f: async function(data) {
            let msgSegments = data.payload.event.message.text.trim().split(" ");
            if (msgSegments.length != 2) {
                return;
            }

            const username = msgSegments[1];
            const response = await sendTwitchAPIRequest(`${twitchGetUsersUrl}?login=${username}`, {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${accessToken()}`,
                    "Client-Id": soggeebotClientId,
                    "Content-Type": "application/json"
                }
            });

            if (response.status != 200) {
                let data = await response.json();
                error("Failed to get user");
                error(data.message);
                return;
            }

            let responseData = await response.json();
            sendShoutout(responseData.id);
            sendChatMessage(`We love ${username}`);
        }
    }

    commands["!announce"] = {
        type: CUSTOM,
        allowed: BROADCASTER,
        cooldown: 0,
        f: async function() {
            console.log("sending announcement");
            sendAnnouncement("sup soggies");
        }
    }
}

export function executeCommand(commandName, data) {
    if (!(commandName in commands)) {
        const shameNames = ["fuckwit", "lil bro", "silly goose"];
        const selectedShame = shameNames[Math.floor(shameNames.length * Math.random())];
        sendChatMessage(`${selectedShame} is making up commands smh`);
        return;
    }

    const command = commands[commandName];
    const userId = data.payload.event.chatter_user_id;
    const now = Date.now();
    const globalCooldownPassed = command.lastUsedGlobal && command.lastUsedGlobal + command.cooldown <= now;
    const userCooldownPassed = command.lastUsedPerUser && ((command.lastUsedPerUser[userId] ?? 0) + command.cooldown <= now);
    if (command.cooldown && !globalCooldownPassed && !userCooldownPassed) {
        return;
    }

    let badges = data.payload.event.badges;
    switch (command.allowed) {
        case MOD:
            if (!hasBadge(badges, MOD)) {
                return;
            }
            break;

        case BROADCASTER:
            if (!hasBadge(badges, BROADCASTER)) {
                return;
            }
            break;
    }

    switch (command.type) {
        case SIMPLE:
            sendChatMessage(commands[commandName].msg);
            break;
        case CUSTOM:
            commands[commandName].f(data);
            break;
    }

    // update last used time
    if (command.lastUsedGlobal) {
        command.lastUsedGlobal = Date.now();
    } else if (command.lastUsedPerUser) {
        command.lastUsedPerUser[userId] = Date.now();
    }
}

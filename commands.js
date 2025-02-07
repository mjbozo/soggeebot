// commands.js
// manage all commands

import { accessToken } from "./auth.js";
import { BROADCASTER, hasBadge, sendChatMessage, sendShoutout, sendTwitchAPIRequest, soggeebotClientId, greeted } from "./soggeebot.js";

const SIMPLE = "simple";
const CUSTOM = "custom";
const ALL = "all";
const MOD = "moderator";

const twitchGetUsersUrl = "https://api.twitch.tv/helix/users";

export const commands = {};
const simpleCommands = {
    "!today": "I'm building my twitch chat bot, soggeebot!"
};

export function registerCommands() {
    commands["!today"] = {
        type: SIMPLE,
        allowed: ALL,
        cooldown: 2000,
        lastUsedGlobal: Date.now()
    };

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
            if (cmdToAdd in commands) {
                sendChatMessage(`Command ${cmdToAdd} already exists, dummy`);
                return;
            }

            commands[cmdToAdd] = {
                type: SIMPLE,
                allowed: ALL
            };

            const newResponse = msgSegments.slice(2, msgSegments.length).join(" ");
            simpleCommands[cmdToAdd] = newResponse;
            sendChatMessage(`Command ${cmdToEdit} added`);
        }
    };

    commands["!editcmd"] = {
        type: CUSTOM,
        allowed: MOD,
        cooldown: 0,
        f: function(data) {
            // !editcmd <cmd> <response>
            let msgSegments = data.payload.event.message.text.trim().split(" ");
            if (msgSegments.length < 3) {
                return;
            }

            const cmdToEdit = msgSegments[1];
            if (!(cmdToEdit in commands)) {
                sendChatMessage(`Command ${cmdToEdit} does not exist, dummy`);
                return;
            }

            if (commands[cmdToEdit].type != SIMPLE) {
                sendChatMessage("Can only edit simple commands, dummy");
                return;
            }

            const newResponse = msgSegments.slice(2, msgSegments.length).join(" ");
            simpleCommands[cmdToEdit] = newResponse;
            sendChatMessage(`Command ${cmdToEdit} updated successfully`);
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
            if (!(cmdToDelete in commands)) {
                sendChatMessage(`Command ${cmdToDelete} does not exists, dummy`);
                return;
            }

            if (commands[cmdToDelete].type != SIMPLE) {
                sendChatMessage("Can only remove simple commands, dummy");
                return;
            }

            delete commands[cmdToDelete];
            delete simpleCommands[cmdToDelete];
            sendChatMessage(`Command ${cmdToDelete} deleted`);
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
}

export function executeCommand(command, data) {
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

    let commandName = data.payload.event.message.text.trim().split(" ")[0];
    switch (command.type) {
        case SIMPLE:
            sendChatMessage(simpleCommands[commandName]);
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

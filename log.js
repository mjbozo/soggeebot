// log.js
// custom logging to terminal

import { logLevel } from "./soggeebot.js";

const DEFAULT = "\u001b[39m"
const RED = "\u001b[91m"
const YELLOW = "\u001b[93m"
const BLUE = "\u001b[94m"
const GREEN = "\u001b[92m"
const CYAN = "\u001b[36m"

export const LogLevels = {
    DEBUG: 0,
    INFO: 1,
    LOG: 2,
    WARN: 3,
    ERROR: 4
};

function timestamp() {
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');

    const hour = now.getHours().toString().padStart(2, '0');
    const minute = now.getMinutes().toString().padStart(2, '0');
    const second = now.getSeconds().toString().padStart(2, '0');
    const millis = now.getMilliseconds().toString().padStart(3, '0');

    const dateString = `[ ${year}.${month}.${day} ${hour}:${minute}:${second}.${millis} ]`
    return dateString;
}

export function debug(message) {
    if (logLevel <= LogLevels.DEBUG) {
        console.log(`${CYAN}${timestamp()} DEBUG > ${message}${DEFAULT}`);
    }
}

export function info(message) {
    if (logLevel <= LogLevels.INFO) {
        console.log(`${BLUE}${timestamp()} INFO  > ${message}${DEFAULT}`);
    }
}

export function log(message) {
    if (logLevel <= LogLevels.LOG) {
        console.log(`${timestamp()} LOG   > ${message}`);
    }
}

export function warn(message) {
    if (logLevel <= LogLevels.WARN) {
        console.log(`${YELLOW}${timestamp()} WARN  > ${message}${DEFAULT}`);
    }
}

export function error(message) {
    if (logLevel <= LogLevels.ERROR) {
        console.log(`${RED}${timestamp()} ERROR > ${message}${DEFAULT}`);
    }
}

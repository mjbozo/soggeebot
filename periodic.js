// periodic.js
// handling for periodic messages via a queue

class Queue {
    constructor(capacity) {
        this.size = 0;
        this.capacity = capacity;
        this.first = null;
        this.last = null;
    }

    enqueue(msg, i) {
        if (this.size === this.capacity) {
            return false;
        }

        const queueMsg = new QueueMessage(msg, i);
        if (this.size === 0) {
            this.first = queueMsg;
        }

        if (this.last !== null) {
            this.last.next = queueMsg;
        }

        this.last = queueMsg;
        this.size++;

        return true;
    }

    dequeue() {
        if (this.size === 0) {
            return null;
        }

        const popped = this.first;

        if (this.first == this.last) {
            this.last = null;
        }

        this.first = this.first.next;
        this.size--;

        periodicMsgs[popped.index].enqueued = false;
        periodicMsgs[popped.index].remainingMsgs = periodicMsgs[popped.index].msgRequiredCount;

        return popped.content;
    }
}

class QueueMessage {
    constructor(msg, i) {
        this.index = i;
        this.content = msg;
        this.next = null;
    }
}

var periodicMsgQueue = new Queue(10);

var periodicMsgs = [
    {
        name: "followPls",
        lastSentTime: Date.now(),
        msg: "Make sure to drop a follow if you're enjoying the stream!",
        waitTime: 1 * 60 * 1000,
        msgRequiredCount: 4,
        remainingMsgs: 4,
        enqueued: false
    }
];

export function updatePeriodicMsgCounts() {
    for (let i in periodicMsgs) {
        const msg = periodicMsgs[i];

        if (msg.enqueued) {
            continue;
        }

        if (msg.remainingMsgs > 0) {
            msg.remainingMsgs--;
        }

        if (msg.remainingMsgs === 0) {
            const now = Date.now();
            if (msg.lastSentTime + msg.waitTime < now) {
                if (periodicMsgQueue.enqueue(msg, i)) {
                    msg.enqueued = true;
                }
            }
        }
    }
}

export function popPeriodicMessage() {
    return periodicMsgQueue.dequeue();
}


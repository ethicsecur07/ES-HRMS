"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.eventBus = void 0;
const events_1 = require("events");
class EventBus {
    emitter;
    static instance;
    constructor() {
        this.emitter = new events_1.EventEmitter();
        this.emitter.setMaxListeners(100); // Prevent memory leak warnings for many subscribers
    }
    static getInstance() {
        if (!EventBus.instance) {
            EventBus.instance = new EventBus();
        }
        return EventBus.instance;
    }
    publish(event, payload) {
        return this.emitter.emit(event, payload);
    }
    subscribe(event, callback) {
        this.emitter.on(event, callback);
        return this;
    }
    unsubscribe(event, callback) {
        this.emitter.off(event, callback);
        return this;
    }
}
exports.eventBus = EventBus.getInstance();

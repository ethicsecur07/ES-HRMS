"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.eventBus = void 0;
const events_1 = require("events");
const logger_js_1 = require("../utils/logger.js");
class EventBus extends events_1.EventEmitter {
    static instance;
    constructor() {
        super();
        this.setMaxListeners(50); // Avoid node limits
    }
    static getInstance() {
        if (!EventBus.instance) {
            EventBus.instance = new EventBus();
        }
        return EventBus.instance;
    }
    /**
     * Publish a domain event asynchronously to avoid blocking the caller.
     */
    publish(event, payload) {
        logger_js_1.logger.info(`[EventBus] Publishing Event: "${event}"`, { payload });
        // Set immediate to execute asynchronously in the next cycle of the event loop
        setImmediate(() => {
            try {
                this.emit(event, payload);
            }
            catch (err) {
                logger_js_1.logger.error(`[EventBus] Error executing handlers for Event: "${event}"`, err);
            }
        });
    }
    /**
     * Subscribe to a domain event.
     */
    subscribe(event, handler) {
        logger_js_1.logger.info(`[EventBus] Subscribing to Event: "${event}"`);
        this.on(event, async (payload) => {
            try {
                await handler(payload);
            }
            catch (err) {
                logger_js_1.logger.error(`[EventBus] Handler failed for Event: "${event}"`, err);
            }
        });
    }
}
exports.eventBus = EventBus.getInstance();

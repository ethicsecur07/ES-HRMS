import { EventEmitter } from 'events';
import { logger } from '../utils/logger.js';

class EventBus extends EventEmitter {
  private static instance: EventBus;

  private constructor() {
    super();
    this.setMaxListeners(50); // Avoid node limits
  }

  public static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  /**
   * Publish a domain event asynchronously to avoid blocking the caller.
   */
  public publish(event: string, payload: any): void {
    logger.info(`[EventBus] Publishing Event: "${event}"`, { payload });
    // Set immediate to execute asynchronously in the next cycle of the event loop
    setImmediate(() => {
      try {
        this.emit(event, payload);
      } catch (err) {
        logger.error(`[EventBus] Error executing handlers for Event: "${event}"`, err);
      }
    });
  }

  /**
   * Subscribe to a domain event.
   */
  public subscribe(event: string, handler: (payload: any) => void | Promise<void>): void {
    logger.info(`[EventBus] Subscribing to Event: "${event}"`);
    this.on(event, async (payload) => {
      try {
        await handler(payload);
      } catch (err) {
        logger.error(`[EventBus] Handler failed for Event: "${event}"`, err);
      }
    });
  }
}

export const eventBus = EventBus.getInstance();

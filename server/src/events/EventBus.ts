import { EventEmitter } from 'events';

class EventBus {
  private emitter: EventEmitter;
  private static instance: EventBus;

  private constructor() {
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(100); // Prevent memory leak warnings for many subscribers
  }

  public static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  public publish(event: string, payload: any): boolean {
    return this.emitter.emit(event, payload);
  }

  public subscribe(event: string, callback: (payload: any) => void): this {
    this.emitter.on(event, callback);
    return this;
  }

  public unsubscribe(event: string, callback: (payload: any) => void): this {
    this.emitter.off(event, callback);
    return this;
  }
}

export const eventBus = EventBus.getInstance();

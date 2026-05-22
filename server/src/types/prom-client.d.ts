declare module 'prom-client' {
  interface Registry {
    /** Returns all collected metrics in Prometheus exposition format */
    metrics(): Promise<string>;
    /** Content-Type header value for the metrics response */
    contentType: string;
  }

  const client: {
    /** Starts collection of default process and OS metrics */
    collectDefaultMetrics(): void;
    /** Registry exposing collected metrics */
    register: Registry;
  };
  export default client;
}

export declare class WebServer {
    private app;
    private server;
    private wss;
    private jobMonitor;
    private jobMatcher;
    private templateEngine;
    private applicationTracker;
    constructor();
    private setupMiddleware;
    private setupRoutes;
    private setupWebSocket;
    private handleWebSocketMessage;
    private getJobs;
    private startMonitoring;
    private stopMonitoring;
    private prepareApplication;
    private trackApplication;
    private getApplications;
    private getTemplates;
    private createTemplate;
    private updateTemplate;
    private deleteTemplate;
    private getStats;
    private broadcastToClients;
    start(port?: number): void;
    stop(): void;
}
//# sourceMappingURL=web-server.d.ts.map
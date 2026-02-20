"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebServer = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const path_1 = __importDefault(require("path"));
const ws_1 = require("ws");
const http_1 = require("http");
const linkedin_scraper_1 = require("./monitors/linkedin-scraper");
const job_matcher_1 = require("./filters/job-matcher");
const resume_engine_1 = require("./templates/resume-engine");
const application_tracker_1 = require("./storage/application-tracker");
class WebServer {
    constructor() {
        this.app = (0, express_1.default)();
        this.server = (0, http_1.createServer)(this.app);
        this.wss = new ws_1.WebSocketServer({ server: this.server });
        this.jobMonitor = new linkedin_scraper_1.LinkedInJobMonitor();
        this.jobMatcher = new job_matcher_1.JobMatcher();
        this.templateEngine = new resume_engine_1.TemplateEngine();
        this.applicationTracker = new application_tracker_1.ApplicationTracker();
        this.setupMiddleware();
        this.setupRoutes();
        this.setupWebSocket();
    }
    setupMiddleware() {
        this.app.use((0, helmet_1.default)());
        this.app.use((0, cors_1.default)());
        this.app.use(express_1.default.json());
        this.app.use(express_1.default.static(path_1.default.join(process.cwd(), 'web-ui')));
    }
    setupRoutes() {
        // API Routes
        this.app.get('/api/jobs', this.getJobs.bind(this));
        this.app.post('/api/jobs/monitor', this.startMonitoring.bind(this));
        this.app.post('/api/jobs/stop', this.stopMonitoring.bind(this));
        this.app.post('/api/applications/prepare', this.prepareApplication.bind(this));
        this.app.post('/api/applications/track', this.trackApplication.bind(this));
        this.app.get('/api/applications', this.getApplications.bind(this));
        this.app.get('/api/templates', this.getTemplates.bind(this));
        this.app.post('/api/templates', this.createTemplate.bind(this));
        this.app.put('/api/templates/:name', this.updateTemplate.bind(this));
        this.app.delete('/api/templates/:name', this.deleteTemplate.bind(this));
        this.app.get('/api/stats', this.getStats.bind(this));
        // Serve the main web UI
        this.app.get('/', (req, res) => {
            res.sendFile(path_1.default.join(process.cwd(), 'web-ui', 'index.html'));
        });
    }
    setupWebSocket() {
        this.wss.on('connection', (ws) => {
            console.log('WebSocket client connected');
            ws.on('message', (message) => {
                try {
                    const data = JSON.parse(message.toString());
                    this.handleWebSocketMessage(ws, data);
                }
                catch (error) {
                    console.error('WebSocket message error:', error);
                }
            });
            ws.on('close', () => {
                console.log('WebSocket client disconnected');
            });
        });
    }
    handleWebSocketMessage(ws, data) {
        switch (data.type) {
            case 'subscribe_jobs':
                // Send job updates to this client
                ws.send(JSON.stringify({ type: 'subscribed', topic: 'jobs' }));
                break;
            default:
                console.log('Unknown WebSocket message type:', data.type);
        }
    }
    async getJobs(req, res) {
        try {
            const limit = parseInt(req.query.limit) || 10;
            const jobs = await this.jobMonitor.getMatchingJobs(limit);
            res.json({
                success: true,
                data: jobs,
                total: this.jobMonitor.getCacheSize()
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    async startMonitoring(req, res) {
        try {
            const criteria = req.body;
            await this.jobMonitor.startMonitoring(criteria);
            res.json({
                success: true,
                message: 'Job monitoring started'
            });
            // Notify WebSocket clients
            this.broadcastToClients({
                type: 'monitoring_started',
                data: criteria
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    async stopMonitoring(req, res) {
        try {
            await this.jobMonitor.stopMonitoring();
            res.json({
                success: true,
                message: 'Job monitoring stopped'
            });
            this.broadcastToClients({
                type: 'monitoring_stopped'
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    async prepareApplication(req, res) {
        try {
            const { jobId, resumeTemplate, coverLetterTemplate } = req.body;
            const job = await this.jobMonitor.getJobById(jobId);
            if (!job) {
                res.status(404).json({
                    success: false,
                    error: 'Job not found'
                });
                return;
            }
            const materials = await this.templateEngine.prepareApplication(job, resumeTemplate, coverLetterTemplate);
            res.json({
                success: true,
                data: materials
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    async trackApplication(req, res) {
        try {
            const applicationData = req.body;
            const application = await this.applicationTracker.trackApplication(applicationData);
            res.json({
                success: true,
                data: application
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    async getApplications(req, res) {
        try {
            const applications = await this.applicationTracker.getAllApplications();
            res.json({
                success: true,
                data: applications
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    async getTemplates(req, res) {
        try {
            const type = req.query.type;
            const templates = await this.templateEngine.listTemplates(type);
            res.json({
                success: true,
                data: templates
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    async createTemplate(req, res) {
        try {
            const { templateType, templateName, content } = req.body;
            await this.templateEngine.createTemplate(templateType, templateName, content);
            res.json({
                success: true,
                message: 'Template created successfully'
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    async updateTemplate(req, res) {
        try {
            const { name } = req.params;
            const { templateType, content } = req.body;
            await this.templateEngine.updateTemplate(templateType, Array.isArray(name) ? name[0] : name, content);
            res.json({
                success: true,
                message: 'Template updated successfully'
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    async deleteTemplate(req, res) {
        try {
            const { name } = req.params;
            const { templateType } = req.body;
            await this.templateEngine.deleteTemplate(templateType, Array.isArray(name) ? name[0] : name);
            res.json({
                success: true,
                message: 'Template deleted successfully'
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    async getStats(req, res) {
        try {
            const stats = this.applicationTracker.getApplicationStats();
            const responseRate = await this.applicationTracker.getResponseRate();
            const avgResponseTime = await this.applicationTracker.getAverageResponseTime();
            res.json({
                success: true,
                data: {
                    ...stats,
                    responseRate,
                    avgResponseTime
                }
            });
        }
        catch (error) {
            res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    broadcastToClients(message) {
        this.wss.clients.forEach((client) => {
            if (client.readyState === 1) { // WebSocket.OPEN
                client.send(JSON.stringify(message));
            }
        });
    }
    start(port = 3000) {
        this.server.listen(port, () => {
            console.log(`LinkedIn Job Assistant web server running on port ${port}`);
            console.log(`Open http://localhost:${port} to access the dashboard`);
        });
    }
    stop() {
        this.server.close();
        this.wss.close();
    }
}
exports.WebServer = WebServer;
//# sourceMappingURL=web-server.js.map
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { LinkedInJobMonitor } from './monitors/linkedin-scraper';
import { JobMatcher } from './filters/job-matcher';
import { TemplateEngine } from './templates/resume-engine';
import { ApplicationTracker } from './storage/application-tracker';
import { JobCriteria, JobListing, UserProfile } from './types/index';

export class WebServer {
  private app: express.Application;
  private server: any;
  private wss: WebSocketServer;
  private jobMonitor: LinkedInJobMonitor;
  private jobMatcher: JobMatcher;
  private templateEngine: TemplateEngine;
  private applicationTracker: ApplicationTracker;

  constructor() {
    this.app = express();
    this.server = createServer(this.app);
    this.wss = new WebSocketServer({ server: this.server });

    this.jobMonitor = new LinkedInJobMonitor();
    this.jobMatcher = new JobMatcher();
    this.templateEngine = new TemplateEngine();
    this.applicationTracker = new ApplicationTracker();

    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();
  }

  private setupMiddleware(): void {
    this.app.use(helmet());
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(express.static(path.join(process.cwd(), 'web-ui')));
  }

  private setupRoutes(): void {
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
      res.sendFile(path.join(process.cwd(), 'web-ui', 'index.html'));
    });
  }

  private setupWebSocket(): void {
    this.wss.on('connection', (ws) => {
      console.log('WebSocket client connected');

      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message.toString());
          this.handleWebSocketMessage(ws, data);
        } catch (error) {
          console.error('WebSocket message error:', error);
        }
      });

      ws.on('close', () => {
        console.log('WebSocket client disconnected');
      });
    });
  }

  private handleWebSocketMessage(ws: any, data: any): void {
    switch (data.type) {
      case 'subscribe_jobs':
        // Send job updates to this client
        ws.send(JSON.stringify({ type: 'subscribed', topic: 'jobs' }));
        break;
      default:
        console.log('Unknown WebSocket message type:', data.type);
    }
  }

  private async getJobs(req: express.Request, res: express.Response): Promise<void> {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const jobs = await this.jobMonitor.getMatchingJobs(limit);
      
      res.json({
        success: true,
        data: jobs,
        total: this.jobMonitor.getCacheSize()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async startMonitoring(req: express.Request, res: express.Response): Promise<void> {
    try {
      const criteria: JobCriteria = req.body;
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
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async stopMonitoring(req: express.Request, res: express.Response): Promise<void> {
    try {
      await this.jobMonitor.stopMonitoring();
      
      res.json({
        success: true,
        message: 'Job monitoring stopped'
      });

      this.broadcastToClients({
        type: 'monitoring_stopped'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async prepareApplication(req: express.Request, res: express.Response): Promise<void> {
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

      const materials = await this.templateEngine.prepareApplication(
        job,
        resumeTemplate,
        coverLetterTemplate
      );

      res.json({
        success: true,
        data: materials
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async trackApplication(req: express.Request, res: express.Response): Promise<void> {
    try {
      const applicationData = req.body;
      const application = await this.applicationTracker.trackApplication(applicationData);
      
      res.json({
        success: true,
        data: application
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async getApplications(req: express.Request, res: express.Response): Promise<void> {
    try {
      const applications = await this.applicationTracker.getAllApplications();
      
      res.json({
        success: true,
        data: applications
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async getTemplates(req: express.Request, res: express.Response): Promise<void> {
    try {
      const type = req.query.type as string;
      const templates = await this.templateEngine.listTemplates(
        type as 'resume' | 'cover-letter' | 'form-answers'
      );
      
      res.json({
        success: true,
        data: templates
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async createTemplate(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { templateType, templateName, content } = req.body;
      await this.templateEngine.createTemplate(
        templateType,
        templateName,
        content
      );
      
      res.json({
        success: true,
        message: 'Template created successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async updateTemplate(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { name } = req.params;
      const { templateType, content } = req.body;
      await this.templateEngine.updateTemplate(
        templateType,
        Array.isArray(name) ? name[0] : name,
        content
      );
      
      res.json({
        success: true,
        message: 'Template updated successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async deleteTemplate(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { name } = req.params;
      const { templateType } = req.body;
      await this.templateEngine.deleteTemplate(
        templateType,
        Array.isArray(name) ? name[0] : name
      );
      
      res.json({
        success: true,
        message: 'Template deleted successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async getStats(req: express.Request, res: express.Response): Promise<void> {
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
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private broadcastToClients(message: any): void {
    this.wss.clients.forEach((client) => {
      if (client.readyState === 1) { // WebSocket.OPEN
        client.send(JSON.stringify(message));
      }
    });
  }

  start(port: number = 3000): void {
    this.server.listen(port, () => {
      console.log(`LinkedIn Job Assistant web server running on port ${port}`);
      console.log(`Open http://localhost:${port} to access the dashboard`);
    });
  }

  stop(): void {
    this.server.close();
    this.wss.close();
  }
}

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { LinkedInJobMonitor } from './monitors/linkedin-scraper';
import { JobMatcher } from './filters/job-matcher';
import { TemplateEngine } from './templates/resume-engine';
import { ApplicationTracker } from './storage/application-tracker';

class LinkedInJobAssistantServer {
  private server: Server;
  private jobMonitor: LinkedInJobMonitor;
  private jobMatcher: JobMatcher;
  private templateEngine: TemplateEngine;
  private applicationTracker: ApplicationTracker;

  constructor() {
    this.server = new Server(
      {
        name: 'linkedin-job-assistant',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.jobMonitor = new LinkedInJobMonitor();
    this.jobMatcher = new JobMatcher();
    this.templateEngine = new TemplateEngine();
    this.applicationTracker = new ApplicationTracker();

    this.setupToolHandlers();
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'monitor_jobs',
            description: 'Start monitoring LinkedIn jobs based on criteria',
            inputSchema: {
              type: 'object',
              properties: {
                keywords: {
                  type: 'string',
                  description: 'Job keywords to search for',
                },
                location: {
                  type: 'string',
                  description: 'Job location',
                },
                jobType: {
                  type: 'string',
                  description: 'Job type (full-time, part-time, contract)',
                },
                experienceLevel: {
                  type: 'string',
                  description: 'Experience level (entry, mid, senior)',
                },
              },
              required: ['keywords'],
            },
          },
          {
            name: 'get_matching_jobs',
            description: 'Get jobs that match your criteria',
            inputSchema: {
              type: 'object',
              properties: {
                limit: {
                  type: 'number',
                  description: 'Maximum number of jobs to return',
                  default: 10,
                },
              },
            },
          },
          {
            name: 'prepare_application',
            description: 'Prepare application materials for a specific job',
            inputSchema: {
              type: 'object',
              properties: {
                jobId: {
                  type: 'string',
                  description: 'ID of the job to prepare application for',
                },
                resumeTemplate: {
                  type: 'string',
                  description: 'Resume template to use',
                },
                coverLetterTemplate: {
                  type: 'string',
                  description: 'Cover letter template to use',
                },
              },
              required: ['jobId'],
            },
          },
          {
            name: 'track_application',
            description: 'Track application status and responses',
            inputSchema: {
              type: 'object',
              properties: {
                jobId: {
                  type: 'string',
                  description: 'ID of the job',
                },
                status: {
                  type: 'string',
                  description: 'Application status (applied, interviewing, rejected, offered)',
                },
                notes: {
                  type: 'string',
                  description: 'Additional notes about the application',
                },
              },
              required: ['jobId', 'status'],
            },
          },
          {
            name: 'manage_templates',
            description: 'Manage resume and cover letter templates',
            inputSchema: {
              type: 'object',
              properties: {
                action: {
                  type: 'string',
                  description: 'Action to perform (create, update, delete, list)',
                },
                templateType: {
                  type: 'string',
                  description: 'Type of template (resume, cover-letter)',
                },
                templateName: {
                  type: 'string',
                  description: 'Name of the template',
                },
                content: {
                  type: 'string',
                  description: 'Template content',
                },
              },
              required: ['action', 'templateType'],
            },
          },
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'monitor_jobs':
            return await this.handleMonitorJobs(args);
          case 'get_matching_jobs':
            return await this.handleGetMatchingJobs(args);
          case 'prepare_application':
            return await this.handlePrepareApplication(args);
          case 'track_application':
            return await this.handleTrackApplication(args);
          case 'manage_templates':
            return await this.handleManageTemplates(args);
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${name}`
            );
        }
      } catch (error) {
        throw new McpError(
          ErrorCode.InternalError,
          `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    });
  }

  private async handleMonitorJobs(args: any) {
    const { keywords, location, jobType, experienceLevel } = args;
    
    await this.jobMonitor.startMonitoring({
      keywords,
      location,
      jobType,
      experienceLevel,
    });

    return {
      content: [
        {
          type: 'text',
          text: `Started monitoring LinkedIn jobs for: ${keywords}${location ? ` in ${location}` : ''}`,
        },
      ],
    };
  }

  private async handleGetMatchingJobs(args: any) {
    const { limit = 10 } = args;
    
    const jobs = await this.jobMonitor.getMatchingJobs(limit);
    
    return {
      content: [
        {
          type: 'text',
          text: `Found ${jobs.length} matching jobs:\n\n${jobs.map(job => 
            `• ${job.title} at ${job.company}\n  Location: ${job.location}\n  Posted: ${job.postedDate}\n  URL: ${job.url}\n`
          ).join('\n')}`,
        },
      ],
    };
  }

  private async handlePrepareApplication(args: any) {
    const { jobId, resumeTemplate, coverLetterTemplate } = args;
    
    const job = await this.jobMonitor.getJobById(jobId);
    if (!job) {
      throw new Error('Job not found');
    }

    const applicationMaterials = await this.templateEngine.prepareApplication(
      job,
      resumeTemplate,
      coverLetterTemplate
    );

    return {
      content: [
        {
          type: 'text',
          text: `Application materials prepared for ${job.title} at ${job.company}:\n\nResume: ${applicationMaterials.resume}\n\nCover Letter: ${applicationMaterials.coverLetter}`,
        },
      ],
    };
  }

  private async handleTrackApplication(args: any) {
    const { jobId, status, notes } = args;
    
    await this.applicationTracker.trackApplication({
      jobId,
      status,
      notes,
    });

    return {
      content: [
        {
          type: 'text',
          text: `Application tracked with status: ${status}`,
        },
      ],
    };
  }

  private async handleManageTemplates(args: any) {
    const { action, templateType, templateName, content } = args;
    
    switch (action) {
      case 'list':
        const templates = await this.templateEngine.listTemplates(templateType);
        return {
          content: [
            {
              type: 'text',
              text: `Available ${templateType} templates:\n${templates.join('\n')}`,
            },
          ],
        };
      case 'create':
        await this.templateEngine.createTemplate(templateType, templateName, content);
        return {
          content: [
            {
              type: 'text',
              text: `Created ${templateType} template: ${templateName}`,
            },
          ],
        };
      case 'update':
        await this.templateEngine.updateTemplate(templateType, templateName, content);
        return {
          content: [
            {
              type: 'text',
              text: `Updated ${templateType} template: ${templateName}`,
            },
          ],
        };
      case 'delete':
        await this.templateEngine.deleteTemplate(templateType, templateName);
        return {
          content: [
            {
              type: 'text',
              text: `Deleted ${templateType} template: ${templateName}`,
            },
          ],
        };
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('LinkedIn Job Assistant MCP server running on stdio');
  }
}

const server = new LinkedInJobAssistantServer();
server.run().catch(console.error);

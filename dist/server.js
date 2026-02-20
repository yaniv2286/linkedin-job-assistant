"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_js_1 = require("@modelcontextprotocol/sdk/server/index.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
const linkedin_scraper_1 = require("./monitors/linkedin-scraper");
const job_matcher_1 = require("./filters/job-matcher");
const resume_engine_1 = require("./templates/resume-engine");
const application_tracker_1 = require("./storage/application-tracker");
class LinkedInJobAssistantServer {
    constructor() {
        this.server = new index_js_1.Server({
            name: 'linkedin-job-assistant',
            version: '1.0.0',
        }, {
            capabilities: {
                tools: {},
            },
        });
        this.jobMonitor = new linkedin_scraper_1.LinkedInJobMonitor();
        this.jobMatcher = new job_matcher_1.JobMatcher();
        this.templateEngine = new resume_engine_1.TemplateEngine();
        this.applicationTracker = new application_tracker_1.ApplicationTracker();
        this.setupToolHandlers();
    }
    setupToolHandlers() {
        this.server.setRequestHandler(types_js_1.ListToolsRequestSchema, async () => {
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
        this.server.setRequestHandler(types_js_1.CallToolRequestSchema, async (request) => {
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
                        throw new types_js_1.McpError(types_js_1.ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
                }
            }
            catch (error) {
                throw new types_js_1.McpError(types_js_1.ErrorCode.InternalError, `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`);
            }
        });
    }
    async handleMonitorJobs(args) {
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
    async handleGetMatchingJobs(args) {
        const { limit = 10 } = args;
        const jobs = await this.jobMonitor.getMatchingJobs(limit);
        return {
            content: [
                {
                    type: 'text',
                    text: `Found ${jobs.length} matching jobs:\n\n${jobs.map(job => `• ${job.title} at ${job.company}\n  Location: ${job.location}\n  Posted: ${job.postedDate}\n  URL: ${job.url}\n`).join('\n')}`,
                },
            ],
        };
    }
    async handlePrepareApplication(args) {
        const { jobId, resumeTemplate, coverLetterTemplate } = args;
        const job = await this.jobMonitor.getJobById(jobId);
        if (!job) {
            throw new Error('Job not found');
        }
        const applicationMaterials = await this.templateEngine.prepareApplication(job, resumeTemplate, coverLetterTemplate);
        return {
            content: [
                {
                    type: 'text',
                    text: `Application materials prepared for ${job.title} at ${job.company}:\n\nResume: ${applicationMaterials.resume}\n\nCover Letter: ${applicationMaterials.coverLetter}`,
                },
            ],
        };
    }
    async handleTrackApplication(args) {
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
    async handleManageTemplates(args) {
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
        const transport = new stdio_js_1.StdioServerTransport();
        await this.server.connect(transport);
        console.error('LinkedIn Job Assistant MCP server running on stdio');
    }
}
const server = new LinkedInJobAssistantServer();
server.run().catch(console.error);
//# sourceMappingURL=server.js.map
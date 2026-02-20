"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.TemplateEngine = void 0;
const uuid_1 = require("uuid");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class TemplateEngine {
    constructor() {
        this.templates = new Map();
        this.templatesDir = path.join(process.cwd(), 'templates');
        this.loadTemplates();
    }
    loadTemplates() {
        try {
            const resumeDir = path.join(this.templatesDir, 'resumes');
            const coverLetterDir = path.join(this.templatesDir, 'cover-letters');
            const formAnswersDir = path.join(this.templatesDir, 'form-answers');
            this.loadTemplatesFromDirectory(resumeDir, 'resume');
            this.loadTemplatesFromDirectory(coverLetterDir, 'cover-letter');
            this.loadTemplatesFromDirectory(formAnswersDir, 'form-answers');
        }
        catch (error) {
            console.error('Error loading templates:', error);
        }
    }
    loadTemplatesFromDirectory(dir, type) {
        if (!fs.existsSync(dir))
            return;
        const files = fs.readdirSync(dir);
        for (const file of files) {
            if (file.endsWith('.md') || file.endsWith('.txt')) {
                const filePath = path.join(dir, file);
                const content = fs.readFileSync(filePath, 'utf-8');
                const templateName = path.basename(file, path.extname(file));
                const template = {
                    id: (0, uuid_1.v4)(),
                    name: templateName,
                    type,
                    content,
                    variables: this.extractVariables(content),
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
                this.templates.set(template.id, template);
            }
        }
    }
    extractVariables(content) {
        const variableRegex = /\{\{(\w+)\}\}/g;
        const variables = [];
        let match;
        while ((match = variableRegex.exec(content)) !== null) {
            variables.push(match[1]);
        }
        return [...new Set(variables)];
    }
    async prepareApplication(job, resumeTemplateName, coverLetterTemplateName) {
        const resumeTemplate = this.getTemplate(resumeTemplateName || 'default', 'resume');
        const coverLetterTemplate = this.getTemplate(coverLetterTemplateName || 'default', 'cover-letter');
        if (!resumeTemplate) {
            throw new Error('Resume template not found');
        }
        const variables = this.buildVariableMap(job);
        const resume = this.replaceVariables(resumeTemplate.content, variables);
        const coverLetter = coverLetterTemplate
            ? this.replaceVariables(coverLetterTemplate.content, variables)
            : '';
        const formAnswers = this.generateFormAnswers(job, variables);
        return {
            resume,
            coverLetter,
            formAnswers
        };
    }
    buildVariableMap(job) {
        return {
            JOB_TITLE: job.title,
            COMPANY_NAME: job.company,
            COMPANY_LOCATION: job.location,
            JOB_DESCRIPTION: job.description,
            JOB_REQUIREMENTS: job.requirements || '',
            JOB_SALARY: job.salary || '',
            POSTED_DATE: job.postedDate,
            CURRENT_DATE: new Date().toLocaleDateString(),
            CURRENT_YEAR: new Date().getFullYear().toString(),
        };
    }
    replaceVariables(template, variables) {
        let result = template;
        for (const [key, value] of Object.entries(variables)) {
            const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
            result = result.replace(regex, value);
        }
        return result;
    }
    generateFormAnswers(job, variables) {
        return {
            'expected_salary': this.generateSalaryAnswer(job),
            'start_date': 'Immediate',
            'relocation_assistance': 'Open to discussion',
            'work_authorization': 'Yes',
            'notice_period': '2 weeks',
            'why_interested': `I'm interested in this ${job.title} position at ${job.company} because it aligns well with my skills and career goals.`,
            'availability': 'Immediate',
            'remote_preference': 'Open to remote, hybrid, or in-office arrangements'
        };
    }
    generateSalaryAnswer(job) {
        // Extract salary information from job posting if available
        if (job.salary) {
            return `Competitive, within the range mentioned in the job posting`;
        }
        return 'Competitive, based on market rates and my experience level';
    }
    getTemplate(name, type) {
        for (const template of this.templates.values()) {
            if (template.name === name && template.type === type) {
                return template;
            }
        }
        return null;
    }
    async createTemplate(type, name, content) {
        const template = {
            id: (0, uuid_1.v4)(),
            name,
            type,
            content,
            variables: this.extractVariables(content),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        this.templates.set(template.id, template);
        await this.saveTemplateToFile(template);
    }
    async updateTemplate(type, name, content) {
        const template = this.getTemplate(name, type);
        if (!template) {
            throw new Error(`Template not found: ${name}`);
        }
        template.content = content;
        template.variables = this.extractVariables(content);
        template.updatedAt = new Date().toISOString();
        await this.saveTemplateToFile(template);
    }
    async deleteTemplate(type, name) {
        const template = this.getTemplate(name, type);
        if (!template) {
            throw new Error(`Template not found: ${name}`);
        }
        this.templates.delete(template.id);
        await this.deleteTemplateFile(template);
    }
    async listTemplates(type) {
        const templates = Array.from(this.templates.values());
        const filtered = type ? templates.filter(t => t.type === type) : templates;
        return filtered.map(t => t.name);
    }
    async saveTemplateToFile(template) {
        const typeDir = path.join(this.templatesDir, `${template.type}s`);
        if (!fs.existsSync(typeDir)) {
            fs.mkdirSync(typeDir, { recursive: true });
        }
        const filePath = path.join(typeDir, `${template.name}.md`);
        fs.writeFileSync(filePath, template.content, 'utf-8');
    }
    async deleteTemplateFile(template) {
        const typeDir = path.join(this.templatesDir, `${template.type}s`);
        const filePath = path.join(typeDir, `${template.name}.md`);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    }
    customizeResumeForJob(baseResume, job, userProfile) {
        // Extract key skills from job description
        const jobSkills = this.extractSkillsFromDescription(job.description);
        const userSkills = userProfile.skills.map(s => s.toLowerCase());
        // Find matching skills to highlight
        const highlightedSkills = jobSkills.filter(skill => userSkills.some(userSkill => userSkill.includes(skill) || skill.includes(userSkill)));
        // Customize summary section
        let customizedResume = baseResume;
        const summarySection = this.generateCustomSummary(job, highlightedSkills, userProfile);
        // Replace summary placeholder
        customizedResume = customizedResume.replace(/\{\{SUMMARY\}\}/g, summarySection);
        // Customize skills section
        const skillsSection = this.generateCustomSkillsSection(highlightedSkills, userProfile);
        customizedResume = customizedResume.replace(/\{\{SKILLS\}\}/g, skillsSection);
        return customizedResume;
    }
    extractSkillsFromDescription(description) {
        const commonSkills = [
            'javascript', 'typescript', 'react', 'node.js', 'python', 'java', 'aws',
            'docker', 'kubernetes', 'sql', 'mongodb', 'postgresql', 'git', 'ci/cd',
            'agile', 'scrum', 'rest api', 'graphql', 'microservices', 'devops',
            'machine learning', 'data analysis', 'product management', 'leadership'
        ];
        const desc = description.toLowerCase();
        return commonSkills.filter(skill => desc.includes(skill));
    }
    generateCustomSummary(job, highlightedSkills, userProfile) {
        const skillsText = highlightedSkills.slice(0, 5).join(', ');
        return `Experienced professional with expertise in ${skillsText}. Seeking to leverage my background in ${userProfile.experience[0]?.position || 'technology'} to contribute to ${job.company}'s ${job.title} position.`;
    }
    generateCustomSkillsSection(highlightedSkills, userProfile) {
        const allSkills = [...new Set([...highlightedSkills, ...userProfile.skills])];
        return allSkills.join(' • ');
    }
}
exports.TemplateEngine = TemplateEngine;
//# sourceMappingURL=resume-engine.js.map
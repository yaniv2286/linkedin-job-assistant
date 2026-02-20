import { JobListing, ApplicationMaterials, Template, UserProfile } from '../types/index';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';

export class TemplateEngine {
  private templatesDir: string;
  private templates: Map<string, Template> = new Map();

  constructor() {
    this.templatesDir = path.join(process.cwd(), 'templates');
    this.loadTemplates();
  }

  private loadTemplates(): void {
    try {
      const resumeDir = path.join(this.templatesDir, 'resumes');
      const coverLetterDir = path.join(this.templatesDir, 'cover-letters');
      const formAnswersDir = path.join(this.templatesDir, 'form-answers');

      this.loadTemplatesFromDirectory(resumeDir, 'resume');
      this.loadTemplatesFromDirectory(coverLetterDir, 'cover-letter');
      this.loadTemplatesFromDirectory(formAnswersDir, 'form-answers');
    } catch (error) {
      console.error('Error loading templates:', error);
    }
  }

  private loadTemplatesFromDirectory(dir: string, type: 'resume' | 'cover-letter' | 'form-answers'): void {
    if (!fs.existsSync(dir)) return;

    const files = fs.readdirSync(dir);
    for (const file of files) {
      if (file.endsWith('.md') || file.endsWith('.txt')) {
        const filePath = path.join(dir, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        const templateName = path.basename(file, path.extname(file));

        const template: Template = {
          id: uuidv4(),
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

  private extractVariables(content: string): string[] {
    const variableRegex = /\{\{(\w+)\}\}/g;
    const variables: string[] = [];
    let match;

    while ((match = variableRegex.exec(content)) !== null) {
      variables.push(match[1]);
    }

    return [...new Set(variables)];
  }

  async prepareApplication(
    job: JobListing,
    resumeTemplateName?: string,
    coverLetterTemplateName?: string
  ): Promise<ApplicationMaterials> {
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

  private buildVariableMap(job: JobListing): Record<string, string> {
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

  private replaceVariables(template: string, variables: Record<string, string>): string {
    let result = template;
    
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      result = result.replace(regex, value);
    }

    return result;
  }

  private generateFormAnswers(job: JobListing, variables: Record<string, string>): Record<string, string> {
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

  private generateSalaryAnswer(job: JobListing): string {
    // Extract salary information from job posting if available
    if (job.salary) {
      return `Competitive, within the range mentioned in the job posting`;
    }
    
    return 'Competitive, based on market rates and my experience level';
  }

  getTemplate(name: string, type: 'resume' | 'cover-letter' | 'form-answers'): Template | null {
    for (const template of this.templates.values()) {
      if (template.name === name && template.type === type) {
        return template;
      }
    }
    return null;
  }

  async createTemplate(type: 'resume' | 'cover-letter' | 'form-answers', name: string, content: string): Promise<void> {
    const template: Template = {
      id: uuidv4(),
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

  async updateTemplate(type: 'resume' | 'cover-letter' | 'form-answers', name: string, content: string): Promise<void> {
    const template = this.getTemplate(name, type);
    if (!template) {
      throw new Error(`Template not found: ${name}`);
    }

    template.content = content;
    template.variables = this.extractVariables(content);
    template.updatedAt = new Date().toISOString();

    await this.saveTemplateToFile(template);
  }

  async deleteTemplate(type: 'resume' | 'cover-letter' | 'form-answers', name: string): Promise<void> {
    const template = this.getTemplate(name, type);
    if (!template) {
      throw new Error(`Template not found: ${name}`);
    }

    this.templates.delete(template.id);
    await this.deleteTemplateFile(template);
  }

  async listTemplates(type?: 'resume' | 'cover-letter' | 'form-answers'): Promise<string[]> {
    const templates = Array.from(this.templates.values());
    const filtered = type ? templates.filter(t => t.type === type) : templates;
    return filtered.map(t => t.name);
  }

  private async saveTemplateToFile(template: Template): Promise<void> {
    const typeDir = path.join(this.templatesDir, `${template.type}s`);
    if (!fs.existsSync(typeDir)) {
      fs.mkdirSync(typeDir, { recursive: true });
    }

    const filePath = path.join(typeDir, `${template.name}.md`);
    fs.writeFileSync(filePath, template.content, 'utf-8');
  }

  private async deleteTemplateFile(template: Template): Promise<void> {
    const typeDir = path.join(this.templatesDir, `${template.type}s`);
    const filePath = path.join(typeDir, `${template.name}.md`);
    
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  customizeResumeForJob(baseResume: string, job: JobListing, userProfile: UserProfile): string {
    // Extract key skills from job description
    const jobSkills = this.extractSkillsFromDescription(job.description);
    const userSkills = userProfile.skills.map(s => s.toLowerCase());

    // Find matching skills to highlight
    const highlightedSkills = jobSkills.filter(skill => 
      userSkills.some(userSkill => userSkill.includes(skill) || skill.includes(userSkill))
    );

    // Customize summary section
    let customizedResume = baseResume;
    const summarySection = this.generateCustomSummary(job, highlightedSkills, userProfile);
    
    // Replace summary placeholder
    customizedResume = customizedResume.replace(
      /\{\{SUMMARY\}\}/g,
      summarySection
    );

    // Customize skills section
    const skillsSection = this.generateCustomSkillsSection(highlightedSkills, userProfile);
    customizedResume = customizedResume.replace(
      /\{\{SKILLS\}\}/g,
      skillsSection
    );

    return customizedResume;
  }

  private extractSkillsFromDescription(description: string): string[] {
    const commonSkills = [
      'javascript', 'typescript', 'react', 'node.js', 'python', 'java', 'aws',
      'docker', 'kubernetes', 'sql', 'mongodb', 'postgresql', 'git', 'ci/cd',
      'agile', 'scrum', 'rest api', 'graphql', 'microservices', 'devops',
      'machine learning', 'data analysis', 'product management', 'leadership'
    ];

    const desc = description.toLowerCase();
    return commonSkills.filter(skill => desc.includes(skill));
  }

  private generateCustomSummary(job: JobListing, highlightedSkills: string[], userProfile: UserProfile): string {
    const skillsText = highlightedSkills.slice(0, 5).join(', ');
    return `Experienced professional with expertise in ${skillsText}. Seeking to leverage my background in ${userProfile.experience[0]?.position || 'technology'} to contribute to ${job.company}'s ${job.title} position.`;
  }

  private generateCustomSkillsSection(highlightedSkills: string[], userProfile: UserProfile): string {
    const allSkills = [...new Set([...highlightedSkills, ...userProfile.skills])];
    return allSkills.join(' • ');
  }
}

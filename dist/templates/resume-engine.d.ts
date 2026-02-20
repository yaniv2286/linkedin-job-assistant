import { JobListing, ApplicationMaterials, Template, UserProfile } from '../types/index';
export declare class TemplateEngine {
    private templatesDir;
    private templates;
    constructor();
    private loadTemplates;
    private loadTemplatesFromDirectory;
    private extractVariables;
    prepareApplication(job: JobListing, resumeTemplateName?: string, coverLetterTemplateName?: string): Promise<ApplicationMaterials>;
    private buildVariableMap;
    private replaceVariables;
    private generateFormAnswers;
    private generateSalaryAnswer;
    getTemplate(name: string, type: 'resume' | 'cover-letter' | 'form-answers'): Template | null;
    createTemplate(type: 'resume' | 'cover-letter' | 'form-answers', name: string, content: string): Promise<void>;
    updateTemplate(type: 'resume' | 'cover-letter' | 'form-answers', name: string, content: string): Promise<void>;
    deleteTemplate(type: 'resume' | 'cover-letter' | 'form-answers', name: string): Promise<void>;
    listTemplates(type?: 'resume' | 'cover-letter' | 'form-answers'): Promise<string[]>;
    private saveTemplateToFile;
    private deleteTemplateFile;
    customizeResumeForJob(baseResume: string, job: JobListing, userProfile: UserProfile): string;
    private extractSkillsFromDescription;
    private generateCustomSummary;
    private generateCustomSkillsSection;
}
//# sourceMappingURL=resume-engine.d.ts.map
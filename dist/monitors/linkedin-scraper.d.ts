import { JobCriteria, JobListing } from '../types/index';
export declare class LinkedInJobMonitor {
    private browser;
    private page;
    private isMonitoring;
    private jobCache;
    private monitoringInterval;
    startMonitoring(criteria: JobCriteria): Promise<void>;
    stopMonitoring(): Promise<void>;
    private initializeBrowser;
    private closeBrowser;
    private scrapeJobs;
    private buildSearchUrl;
    private scrollToLoadJobs;
    private enrichJobData;
    getMatchingJobs(limit?: number): Promise<JobListing[]>;
    getJobById(jobId: string): Promise<JobListing | null>;
    getCacheSize(): number;
    clearCache(): void;
}
//# sourceMappingURL=linkedin-scraper.d.ts.map
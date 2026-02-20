import { JobCriteria, JobListing, UserProfile } from '../types/index';
export declare class JobMatcher {
    private userProfile;
    setUserProfile(profile: UserProfile): void;
    calculateRelevanceScore(job: JobListing, criteria: JobCriteria): number;
    private calculateKeywordScore;
    private calculateLocationScore;
    private calculateJobTypeScore;
    private calculateExperienceScore;
    private calculateSkillsScore;
    filterJobs(jobs: JobListing[], criteria: JobCriteria, minScore?: number): JobListing[];
    getMatchingJobs(jobs: JobListing[], criteria: JobCriteria, limit?: number): Array<{
        job: JobListing;
        score: number;
    }>;
    isDuplicateJob(newJob: JobListing, existingJobs: JobListing[]): boolean;
    extractSalaryRange(job: JobListing): {
        min?: number;
        max?: number;
    } | null;
    isWithinSalaryRange(job: JobListing, criteria: JobCriteria): boolean;
}
//# sourceMappingURL=job-matcher.d.ts.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JobMatcher = void 0;
class JobMatcher {
    constructor() {
        this.userProfile = null;
    }
    setUserProfile(profile) {
        this.userProfile = profile;
    }
    calculateRelevanceScore(job, criteria) {
        let score = 0;
        const maxScore = 100;
        // Keywords matching (40 points)
        const keywordScore = this.calculateKeywordScore(job, criteria.keywords);
        score += keywordScore * 0.4;
        // Location matching (20 points)
        if (criteria.location) {
            const locationScore = this.calculateLocationScore(job, criteria.location);
            score += locationScore * 0.2;
        }
        else {
            score += 20; // Full points if no location preference
        }
        // Job type matching (10 points)
        if (criteria.jobType) {
            const jobTypeScore = this.calculateJobTypeScore(job, criteria.jobType);
            score += jobTypeScore * 0.1;
        }
        else {
            score += 10;
        }
        // Experience level matching (15 points)
        if (criteria.experienceLevel) {
            const experienceScore = this.calculateExperienceScore(job, criteria.experienceLevel);
            score += experienceScore * 0.15;
        }
        else {
            score += 15;
        }
        // Skills matching (15 points)
        if (this.userProfile) {
            const skillsScore = this.calculateSkillsScore(job);
            score += skillsScore * 0.15;
        }
        else {
            score += 7.5; // Half points if no profile
        }
        return Math.min(score, maxScore);
    }
    calculateKeywordScore(job, keywords) {
        const jobText = `${job.title} ${job.description} ${job.requirements || ''}`.toLowerCase();
        const keywordList = keywords.toLowerCase().split(' ').filter(k => k.length > 2);
        let matches = 0;
        for (const keyword of keywordList) {
            if (jobText.includes(keyword)) {
                matches++;
            }
        }
        return keywordList.length > 0 ? (matches / keywordList.length) * 100 : 0;
    }
    calculateLocationScore(job, preferredLocation) {
        const jobLocation = job.location.toLowerCase();
        const preferred = preferredLocation.toLowerCase();
        if (jobLocation.includes(preferred)) {
            return 100;
        }
        // Check for same state/country
        const locationParts = preferred.split(',').map(p => p.trim());
        for (const part of locationParts) {
            if (jobLocation.includes(part)) {
                return 70;
            }
        }
        // Remote jobs get bonus points
        if (jobLocation.includes('remote') || job.remote) {
            return 85;
        }
        return 0;
    }
    calculateJobTypeScore(job, preferredType) {
        // This would need to be extracted from job description or additional scraping
        // For now, return full score as we can't determine job type from current data
        return 100;
    }
    calculateExperienceScore(job, preferredLevel) {
        const jobText = `${job.title} ${job.description}`.toLowerCase();
        const levelKeywords = {
            'entry': ['entry', 'junior', 'associate', '0-1', '1-2'],
            'mid': ['mid', 'intermediate', '2-5', '3-5', 'experienced'],
            'senior': ['senior', 'lead', 'principal', '5+', '7+', '10+']
        };
        const keywords = levelKeywords[preferredLevel] || [];
        let matches = 0;
        for (const keyword of keywords) {
            if (jobText.includes(keyword)) {
                matches++;
            }
        }
        return keywords.length > 0 ? (matches / keywords.length) * 100 : 50;
    }
    calculateSkillsScore(job) {
        if (!this.userProfile)
            return 0;
        const jobText = `${job.title} ${job.description} ${job.requirements || ''}`.toLowerCase();
        const userSkills = this.userProfile.skills.map(s => s.toLowerCase());
        let matches = 0;
        for (const skill of userSkills) {
            if (jobText.includes(skill)) {
                matches++;
            }
        }
        return userSkills.length > 0 ? (matches / userSkills.length) * 100 : 0;
    }
    filterJobs(jobs, criteria, minScore = 60) {
        return jobs
            .map(job => ({
            job,
            score: this.calculateRelevanceScore(job, criteria)
        }))
            .filter(({ score }) => score >= minScore)
            .sort((a, b) => b.score - a.score)
            .map(({ job }) => job);
    }
    getMatchingJobs(jobs, criteria, limit = 10) {
        const scoredJobs = jobs.map(job => ({
            job,
            score: this.calculateRelevanceScore(job, criteria)
        }));
        return scoredJobs
            .filter(({ score }) => score >= 60)
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);
    }
    isDuplicateJob(newJob, existingJobs) {
        return existingJobs.some(existing => existing.title.toLowerCase() === newJob.title.toLowerCase() &&
            existing.company.toLowerCase() === newJob.company.toLowerCase() &&
            existing.location.toLowerCase() === newJob.location.toLowerCase());
    }
    extractSalaryRange(job) {
        const salaryText = job.salary || job.description;
        if (!salaryText)
            return null;
        const salaryRegex = /\$?(\d+(?:,\d+)*)\s*(?:to|-|–)\s*\$?(\d+(?:,\d+)*)\s*(k|thousand|year|annual|hourly)/gi;
        const match = salaryText.match(salaryRegex);
        if (match) {
            const numbers = match[0].match(/\d+/g);
            if (numbers && numbers.length >= 2) {
                const min = parseInt(numbers[0].replace(/,/g, ''));
                const max = parseInt(numbers[1].replace(/,/g, ''));
                // Convert to yearly salary if hourly
                const multiplier = match[0].toLowerCase().includes('hourly') ? 2080 : 1;
                return {
                    min: min * multiplier,
                    max: max * multiplier
                };
            }
        }
        return null;
    }
    isWithinSalaryRange(job, criteria) {
        if (!criteria.salaryRange)
            return true;
        const jobSalary = this.extractSalaryRange(job);
        if (!jobSalary)
            return true;
        const { min, max } = criteria.salaryRange;
        if (min && jobSalary.max && jobSalary.max < min)
            return false;
        if (max && jobSalary.min && jobSalary.min > max)
            return false;
        return true;
    }
}
exports.JobMatcher = JobMatcher;
//# sourceMappingURL=job-matcher.js.map
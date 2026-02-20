"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LinkedInJobMonitor = void 0;
const puppeteer_1 = __importDefault(require("puppeteer"));
class LinkedInJobMonitor {
    constructor() {
        this.browser = null;
        this.page = null;
        this.isMonitoring = false;
        this.jobCache = new Map();
        this.monitoringInterval = null;
    }
    async startMonitoring(criteria) {
        if (this.isMonitoring) {
            throw new Error('Monitoring is already active');
        }
        this.isMonitoring = true;
        await this.initializeBrowser();
        // Start monitoring every 30 minutes
        this.monitoringInterval = setInterval(async () => {
            try {
                await this.scrapeJobs(criteria);
            }
            catch (error) {
                console.error('Error during job scraping:', error);
            }
        }, 30 * 60 * 1000);
        // Initial scrape
        await this.scrapeJobs(criteria);
    }
    async stopMonitoring() {
        this.isMonitoring = false;
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }
        await this.closeBrowser();
    }
    async initializeBrowser() {
        this.browser = await puppeteer_1.default.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu'
            ]
        });
        this.page = await this.browser.newPage();
        // Set user agent and viewport
        await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
        await this.page.setViewport({ width: 1366, height: 768 });
        // Add rate limiting
        await this.page.setDefaultTimeout(30000);
    }
    async closeBrowser() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            this.page = null;
        }
    }
    async scrapeJobs(criteria) {
        if (!this.page) {
            throw new Error('Browser not initialized');
        }
        try {
            // Build LinkedIn job search URL
            const searchUrl = this.buildSearchUrl(criteria);
            // Navigate to the job search page
            await this.page.goto(searchUrl, { waitUntil: 'networkidle2' });
            // Wait for job listings to load
            await this.page.waitForSelector('.jobs-search__results-list', { timeout: 10000 });
            // Scroll to load more jobs
            await this.scrollToLoadJobs();
            // Extract job listings
            const jobs = await this.page.evaluate(() => {
                const jobElements = document.querySelectorAll('.jobs-search__results-list li');
                const jobData = [];
                jobElements.forEach((element) => {
                    const titleElement = element.querySelector('.job-card-list__title');
                    const companyElement = element.querySelector('.job-card-container__primary-description');
                    const locationElement = element.querySelector('.job-card-container__metadata-item');
                    const postedElement = element.querySelector('.job-search-result__posted-date');
                    const linkElement = element.querySelector('a.job-card-container__link');
                    if (titleElement && companyElement && linkElement) {
                        jobData.push({
                            title: titleElement.textContent?.trim() || '',
                            company: companyElement.textContent?.trim() || '',
                            location: locationElement?.textContent?.trim() || '',
                            postedDate: postedElement?.textContent?.trim() || '',
                            url: linkElement.href,
                            id: linkElement.href.split('/').pop() || '',
                        });
                    }
                });
                return jobData;
            });
            // Process and cache jobs
            for (const job of jobs) {
                if (!this.jobCache.has(job.id)) {
                    const fullJob = await this.enrichJobData(job);
                    this.jobCache.set(job.id, fullJob);
                }
            }
            console.log(`Scraped ${jobs.length} jobs. Total cached: ${this.jobCache.size}`);
        }
        catch (error) {
            console.error('Error scraping jobs:', error);
            throw error;
        }
    }
    buildSearchUrl(criteria) {
        const baseUrl = 'https://www.linkedin.com/jobs/search';
        const params = new URLSearchParams();
        if (criteria.keywords) {
            params.append('keywords', criteria.keywords);
        }
        if (criteria.location) {
            params.append('location', criteria.location);
        }
        if (criteria.jobType) {
            const jobTypeMap = {
                'full-time': 'F',
                'part-time': 'P',
                'contract': 'C',
                'internship': 'I',
            };
            params.append('f_JT', jobTypeMap[criteria.jobType] || '');
        }
        if (criteria.experienceLevel) {
            const experienceMap = {
                'entry': '1',
                'mid': '2',
                'senior': '3',
            };
            params.append('f_E', experienceMap[criteria.experienceLevel] || '');
        }
        return `${baseUrl}?${params.toString()}`;
    }
    async scrollToLoadJobs() {
        if (!this.page)
            return;
        let previousHeight = 0;
        let currentHeight = 0;
        let attempts = 0;
        const maxAttempts = 10;
        while (attempts < maxAttempts) {
            currentHeight = await this.page.evaluate(() => document.body.scrollHeight);
            if (currentHeight === previousHeight) {
                break;
            }
            previousHeight = currentHeight;
            await this.page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
            await new Promise(resolve => setTimeout(resolve, 2000));
            attempts++;
        }
    }
    async enrichJobData(job) {
        if (!this.page)
            return job;
        try {
            // Navigate to job page for more details
            await this.page.goto(job.url, { waitUntil: 'networkidle2' });
            // Extract additional details
            const enrichedData = await this.page.evaluate(() => {
                const descriptionElement = document.querySelector('.jobs-description__text');
                const salaryElement = document.querySelector('.job-criteria__text');
                const requirementsElement = document.querySelector('.jobs-description__requirements');
                return {
                    description: descriptionElement?.textContent?.trim() || '',
                    salary: salaryElement?.textContent?.trim() || '',
                    requirements: requirementsElement?.textContent?.trim() || '',
                };
            });
            return {
                ...job,
                ...enrichedData,
                scrapedAt: new Date().toISOString(),
            };
        }
        catch (error) {
            console.error('Error enriching job data:', error);
            return job;
        }
    }
    async getMatchingJobs(limit = 10) {
        const jobs = Array.from(this.jobCache.values());
        // Sort by scraped date (newest first)
        jobs.sort((a, b) => new Date(b.scrapedAt).getTime() - new Date(a.scrapedAt).getTime());
        return jobs.slice(0, limit);
    }
    async getJobById(jobId) {
        return this.jobCache.get(jobId) || null;
    }
    getCacheSize() {
        return this.jobCache.size;
    }
    clearCache() {
        this.jobCache.clear();
    }
}
exports.LinkedInJobMonitor = LinkedInJobMonitor;
//# sourceMappingURL=linkedin-scraper.js.map
import puppeteer, { Browser, Page } from 'puppeteer';
import * as cheerio from 'cheerio';
import { JobCriteria, JobListing } from '../types/index';

export class LinkedInJobMonitor {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private isMonitoring = false;
  private jobCache: Map<string, JobListing> = new Map();
  private monitoringInterval: NodeJS.Timeout | null = null;

  async startMonitoring(criteria: JobCriteria): Promise<void> {
    if (this.isMonitoring) {
      throw new Error('Monitoring is already active');
    }

    this.isMonitoring = true;
    await this.initializeBrowser();
    
    // Start monitoring every 30 minutes
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.scrapeJobs(criteria);
      } catch (error) {
        console.error('Error during job scraping:', error);
      }
    }, 30 * 60 * 1000);

    // Initial scrape
    await this.scrapeJobs(criteria);
  }

  async stopMonitoring(): Promise<void> {
    this.isMonitoring = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    await this.closeBrowser();
  }

  private async initializeBrowser(): Promise<void> {
    this.browser = await puppeteer.launch({
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

  private async closeBrowser(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }

  private async scrapeJobs(criteria: JobCriteria): Promise<void> {
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
        const jobData: any[] = [];
        
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
              url: (linkElement as HTMLAnchorElement).href,
              id: (linkElement as HTMLAnchorElement).href.split('/').pop() || '',
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
      
    } catch (error) {
      console.error('Error scraping jobs:', error);
      throw error;
    }
  }

  private buildSearchUrl(criteria: JobCriteria): string {
    const baseUrl = 'https://www.linkedin.com/jobs/search';
    const params = new URLSearchParams();
    
    if (criteria.keywords) {
      params.append('keywords', criteria.keywords);
    }
    
    if (criteria.location) {
      params.append('location', criteria.location);
    }
    
    if (criteria.jobType) {
      const jobTypeMap: Record<string, string> = {
        'full-time': 'F',
        'part-time': 'P',
        'contract': 'C',
        'internship': 'I',
      };
      params.append('f_JT', jobTypeMap[criteria.jobType] || '');
    }
    
    if (criteria.experienceLevel) {
      const experienceMap: Record<string, string> = {
        'entry': '1',
        'mid': '2',
        'senior': '3',
      };
      params.append('f_E', experienceMap[criteria.experienceLevel] || '');
    }
    
    return `${baseUrl}?${params.toString()}`;
  }

  private async scrollToLoadJobs(): Promise<void> {
    if (!this.page) return;
    
    let previousHeight = 0;
    let currentHeight = 0;
    let attempts = 0;
    const maxAttempts = 10;
    
    while (attempts < maxAttempts) {
      currentHeight = await this.page.evaluate(() => document.body.scrollHeight) as number;
      
      if (currentHeight === previousHeight) {
        break;
      }
      
      previousHeight = currentHeight;
      
      await this.page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
      await new Promise(resolve => setTimeout(resolve, 2000));
      attempts++;
    }
  }

  private async enrichJobData(job: any): Promise<JobListing> {
    if (!this.page) return job;
    
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
      
    } catch (error) {
      console.error('Error enriching job data:', error);
      return job;
    }
  }

  async getMatchingJobs(limit: number = 10): Promise<JobListing[]> {
    const jobs = Array.from(this.jobCache.values());
    
    // Sort by scraped date (newest first)
    jobs.sort((a, b) => new Date(b.scrapedAt).getTime() - new Date(a.scrapedAt).getTime());
    
    return jobs.slice(0, limit);
  }

  async getJobById(jobId: string): Promise<JobListing | null> {
    return this.jobCache.get(jobId) || null;
  }

  getCacheSize(): number {
    return this.jobCache.size;
  }

  clearCache(): void {
    this.jobCache.clear();
  }
}

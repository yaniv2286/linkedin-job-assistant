import { Application, JobListing } from '../types/index';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';

export class ApplicationTracker {
  private dataFile: string;
  private applications: Map<string, Application> = new Map();

  constructor() {
    this.dataFile = path.join(process.cwd(), 'data', 'applications.json');
    this.loadData();
  }

  private loadData(): void {
    try {
      const dataDir = path.dirname(this.dataFile);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      if (fs.existsSync(this.dataFile)) {
        const data = JSON.parse(fs.readFileSync(this.dataFile, 'utf-8'));
        this.applications = new Map(data.map((app: Application) => [app.id, app]));
      }
    } catch (error) {
      console.error('Error loading application data:', error);
    }
  }

  private saveData(): void {
    try {
      const data = Array.from(this.applications.values());
      fs.writeFileSync(this.dataFile, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
      console.error('Error saving application data:', error);
    }
  }

  async trackApplication(applicationData: Omit<Application, 'id' | 'appliedAt'>): Promise<Application> {
    const application: Application = {
      id: uuidv4(),
      ...applicationData,
      appliedAt: new Date().toISOString()
    };

    this.applications.set(application.id, application);
    this.saveData();

    return application;
  }

  async updateApplication(id: string, updates: Partial<Application>): Promise<Application | null> {
    const application = this.applications.get(id);
    if (!application) {
      return null;
    }

    const updatedApplication = { ...application, ...updates };
    this.applications.set(id, updatedApplication);
    this.saveData();

    return updatedApplication;
  }

  async getApplication(id: string): Promise<Application | null> {
    return this.applications.get(id) || null;
  }

  async getAllApplications(): Promise<Application[]> {
    return Array.from(this.applications.values())
      .sort((a, b) => new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime());
  }

  async getApplicationsByStatus(status: Application['status']): Promise<Application[]> {
    return Array.from(this.applications.values())
      .filter(app => app.status === status)
      .sort((a, b) => new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime());
  }

  async getApplicationsByDateRange(startDate: Date, endDate: Date): Promise<Application[]> {
    return Array.from(this.applications.values())
      .filter(app => {
        const appliedDate = new Date(app.appliedAt);
        return appliedDate >= startDate && appliedDate <= endDate;
      })
      .sort((a, b) => new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime());
  }

  async deleteApplication(id: string): Promise<boolean> {
    const deleted = this.applications.delete(id);
    if (deleted) {
      this.saveData();
    }
    return deleted;
  }

  getApplicationStats(): {
    total: number;
    byStatus: Record<Application['status'], number>;
    thisWeek: number;
    thisMonth: number;
  } {
    const applications = Array.from(this.applications.values());
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const byStatus: Record<Application['status'], number> = {
      pending: 0,
      applied: 0,
      interviewing: 0,
      rejected: 0,
      offered: 0,
      withdrawn: 0
    };

    for (const app of applications) {
      byStatus[app.status]++;
    }

    const thisWeek = applications.filter(app => new Date(app.appliedAt) >= weekAgo).length;
    const thisMonth = applications.filter(app => new Date(app.appliedAt) >= monthAgo).length;

    return {
      total: applications.length,
      byStatus,
      thisWeek,
      thisMonth
    };
  }

  async getApplicationsByCompany(company: string): Promise<Application[]> {
    return Array.from(this.applications.values())
      .filter(app => app.jobId.toLowerCase().includes(company.toLowerCase()))
      .sort((a, b) => new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime());
  }

  async addNote(id: string, note: string): Promise<Application | null> {
    const application = this.applications.get(id);
    if (!application) {
      return null;
    }

    const updatedNotes = application.notes 
      ? `${application.notes}\n\n${new Date().toLocaleDateString()}: ${note}`
      : `${new Date().toLocaleDateString()}: ${note}`;

    const updatedApplication = { ...application, notes: updatedNotes };
    this.applications.set(id, updatedApplication);
    this.saveData();

    return updatedApplication;
  }

  async searchApplications(query: string): Promise<Application[]> {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.applications.values())
      .filter(app => 
        app.jobId.toLowerCase().includes(lowerQuery) ||
        (app.notes && app.notes.toLowerCase().includes(lowerQuery))
      )
      .sort((a, b) => new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime());
  }

  exportApplications(): string {
    const applications = Array.from(this.applications.values());
    return JSON.stringify(applications, null, 2);
  }

  async importApplications(data: string): Promise<number> {
    try {
      const applications: Application[] = JSON.parse(data);
      let imported = 0;

      for (const app of applications) {
        if (!this.applications.has(app.id)) {
          this.applications.set(app.id, app);
          imported++;
        }
      }

      if (imported > 0) {
        this.saveData();
      }

      return imported;
    } catch (error) {
      console.error('Error importing applications:', error);
      throw new Error('Invalid application data format');
    }
  }

  async getResponseRate(): Promise<number> {
    const applications = Array.from(this.applications.values());
    const totalApplications = applications.length;
    
    if (totalApplications === 0) {
      return 0;
    }

    const responses = applications.filter(app => 
      app.status === 'interviewing' || app.status === 'offered'
    ).length;

    return Math.round((responses / totalApplications) * 100);
  }

  async getAverageResponseTime(): Promise<number> {
    const applications = Array.from(this.applications.values());
    const responses = applications.filter(app => 
      app.status === 'interviewing' || app.status === 'offered'
    );

    if (responses.length === 0) {
      return 0;
    }

    const totalDays = responses.reduce((sum, app) => {
      const appliedDate = new Date(app.appliedAt);
      const now = new Date();
      const daysDiff = Math.floor((now.getTime() - appliedDate.getTime()) / (1000 * 60 * 60 * 24));
      return sum + daysDiff;
    }, 0);

    return Math.round(totalDays / responses.length);
  }
}

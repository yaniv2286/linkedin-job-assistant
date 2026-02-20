import { Application } from '../types/index';
export declare class ApplicationTracker {
    private dataFile;
    private applications;
    constructor();
    private loadData;
    private saveData;
    trackApplication(applicationData: Omit<Application, 'id' | 'appliedAt'>): Promise<Application>;
    updateApplication(id: string, updates: Partial<Application>): Promise<Application | null>;
    getApplication(id: string): Promise<Application | null>;
    getAllApplications(): Promise<Application[]>;
    getApplicationsByStatus(status: Application['status']): Promise<Application[]>;
    getApplicationsByDateRange(startDate: Date, endDate: Date): Promise<Application[]>;
    deleteApplication(id: string): Promise<boolean>;
    getApplicationStats(): {
        total: number;
        byStatus: Record<Application['status'], number>;
        thisWeek: number;
        thisMonth: number;
    };
    getApplicationsByCompany(company: string): Promise<Application[]>;
    addNote(id: string, note: string): Promise<Application | null>;
    searchApplications(query: string): Promise<Application[]>;
    exportApplications(): string;
    importApplications(data: string): Promise<number>;
    getResponseRate(): Promise<number>;
    getAverageResponseTime(): Promise<number>;
}
//# sourceMappingURL=application-tracker.d.ts.map
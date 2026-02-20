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
exports.ApplicationTracker = void 0;
const uuid_1 = require("uuid");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class ApplicationTracker {
    constructor() {
        this.applications = new Map();
        this.dataFile = path.join(process.cwd(), 'data', 'applications.json');
        this.loadData();
    }
    loadData() {
        try {
            const dataDir = path.dirname(this.dataFile);
            if (!fs.existsSync(dataDir)) {
                fs.mkdirSync(dataDir, { recursive: true });
            }
            if (fs.existsSync(this.dataFile)) {
                const data = JSON.parse(fs.readFileSync(this.dataFile, 'utf-8'));
                this.applications = new Map(data.map((app) => [app.id, app]));
            }
        }
        catch (error) {
            console.error('Error loading application data:', error);
        }
    }
    saveData() {
        try {
            const data = Array.from(this.applications.values());
            fs.writeFileSync(this.dataFile, JSON.stringify(data, null, 2), 'utf-8');
        }
        catch (error) {
            console.error('Error saving application data:', error);
        }
    }
    async trackApplication(applicationData) {
        const application = {
            id: (0, uuid_1.v4)(),
            ...applicationData,
            appliedAt: new Date().toISOString()
        };
        this.applications.set(application.id, application);
        this.saveData();
        return application;
    }
    async updateApplication(id, updates) {
        const application = this.applications.get(id);
        if (!application) {
            return null;
        }
        const updatedApplication = { ...application, ...updates };
        this.applications.set(id, updatedApplication);
        this.saveData();
        return updatedApplication;
    }
    async getApplication(id) {
        return this.applications.get(id) || null;
    }
    async getAllApplications() {
        return Array.from(this.applications.values())
            .sort((a, b) => new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime());
    }
    async getApplicationsByStatus(status) {
        return Array.from(this.applications.values())
            .filter(app => app.status === status)
            .sort((a, b) => new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime());
    }
    async getApplicationsByDateRange(startDate, endDate) {
        return Array.from(this.applications.values())
            .filter(app => {
            const appliedDate = new Date(app.appliedAt);
            return appliedDate >= startDate && appliedDate <= endDate;
        })
            .sort((a, b) => new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime());
    }
    async deleteApplication(id) {
        const deleted = this.applications.delete(id);
        if (deleted) {
            this.saveData();
        }
        return deleted;
    }
    getApplicationStats() {
        const applications = Array.from(this.applications.values());
        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const byStatus = {
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
    async getApplicationsByCompany(company) {
        return Array.from(this.applications.values())
            .filter(app => app.jobId.toLowerCase().includes(company.toLowerCase()))
            .sort((a, b) => new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime());
    }
    async addNote(id, note) {
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
    async searchApplications(query) {
        const lowerQuery = query.toLowerCase();
        return Array.from(this.applications.values())
            .filter(app => app.jobId.toLowerCase().includes(lowerQuery) ||
            (app.notes && app.notes.toLowerCase().includes(lowerQuery)))
            .sort((a, b) => new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime());
    }
    exportApplications() {
        const applications = Array.from(this.applications.values());
        return JSON.stringify(applications, null, 2);
    }
    async importApplications(data) {
        try {
            const applications = JSON.parse(data);
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
        }
        catch (error) {
            console.error('Error importing applications:', error);
            throw new Error('Invalid application data format');
        }
    }
    async getResponseRate() {
        const applications = Array.from(this.applications.values());
        const totalApplications = applications.length;
        if (totalApplications === 0) {
            return 0;
        }
        const responses = applications.filter(app => app.status === 'interviewing' || app.status === 'offered').length;
        return Math.round((responses / totalApplications) * 100);
    }
    async getAverageResponseTime() {
        const applications = Array.from(this.applications.values());
        const responses = applications.filter(app => app.status === 'interviewing' || app.status === 'offered');
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
exports.ApplicationTracker = ApplicationTracker;
//# sourceMappingURL=application-tracker.js.map
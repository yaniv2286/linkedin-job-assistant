export interface JobCriteria {
  keywords: string;
  location?: string;
  jobType?: 'full-time' | 'part-time' | 'contract' | 'internship';
  experienceLevel?: 'entry' | 'mid' | 'senior';
  salaryRange?: {
    min?: number;
    max?: number;
  };
  companySize?: string;
  industry?: string;
  remote?: boolean;
}

export interface JobListing {
  id: string;
  title: string;
  company: string;
  location: string;
  description: string;
  requirements?: string;
  salary?: string;
  postedDate: string;
  url: string;
  scrapedAt: string;
  companySize?: string;
  industry?: string;
  remote?: boolean;
}

export interface ApplicationMaterials {
  resume: string;
  coverLetter: string;
  formAnswers: Record<string, string>;
}

export interface Application {
  id: string;
  jobId: string;
  status: 'pending' | 'applied' | 'interviewing' | 'rejected' | 'offered' | 'withdrawn';
  appliedAt: string;
  notes?: string;
  materials?: ApplicationMaterials;
}

export interface Template {
  id: string;
  name: string;
  type: 'resume' | 'cover-letter' | 'form-answers';
  content: string;
  variables: string[];
  createdAt: string;
  updatedAt: string;
}

export interface UserProfile {
  name: string;
  email: string;
  phone: string;
  location: string;
  summary: string;
  experience: WorkExperience[];
  education: Education[];
  skills: string[];
  portfolio?: string;
  linkedin?: string;
  github?: string;
}

export interface WorkExperience {
  company: string;
  position: string;
  startDate: string;
  endDate?: string;
  description: string[];
}

export interface Education {
  institution: string;
  degree: string;
  field: string;
  startDate: string;
  endDate?: string;
  gpa?: string;
}

import mongoose, { Schema, Document } from 'mongoose';

export interface IOrganization extends Document {
  name: string;
  slug: string; // e.g., 'techcorp' used for subdomains or initial routing
  domain?: string; // custom domains
  sector: 'IT' | 'Startups' | 'Manufacturing' | 'Hospitals' | 'Schools' | 'Logistics' | 'Agencies' | 'Enterprises';
  isActive: boolean;
  settings: {
    theme?: string;
    logoUrl?: string;
    fiscalYearStart?: string;
    timezone?: string;
    locale?: string;
    currency?: string;
    activeWorkdays?: string[];
    customHolidays?: Array<{ date: string; name: string }>;
    monthlyLeaveLimit?: number;
    monthlyWFHLimit?: number;
    monthlyPermissionHours?: number;
    salaryCycleStartDay?: number;
    allowedIPs?: string[];
    adminEmail?: string;
    loginApprovalRoles?: string[];
    visibleDepartments?: string[];
  };
  createdAt: Date;
  updatedAt: Date;
}

const organizationSchema = new Schema<IOrganization>(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    domain: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
    sector: {
      type: String,
      enum: ['IT', 'Startups', 'Manufacturing', 'Hospitals', 'Schools', 'Logistics', 'Agencies', 'Enterprises'],
      required: true,
    },
    isActive: { type: Boolean, default: true },
    settings: {
      theme: { type: String, default: 'dark' },
      logoUrl: { type: String },
      fiscalYearStart: { type: String, default: '04-01' },
      timezone: { type: String, default: 'UTC' },
      locale: { type: String, default: 'en-US' },
      currency: { type: String, default: 'USD' },
      activeWorkdays: { type: [String], default: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] },
      customHolidays: [
        {
          date: { type: String, required: true },
          name: { type: String, required: true }
        }
      ],
      monthlyLeaveLimit: { type: Number, default: 2 },
      monthlyWFHLimit: { type: Number, default: 1 },
      monthlyPermissionHours: { type: Number, default: 3 },
      salaryCycleStartDay: { type: Number, default: 1, min: 1, max: 31 },
      allowedIPs: { type: [String], default: ['127.0.0.1', '::1'] },
      adminEmail: { type: String },
      loginApprovalRoles: { type: [String], default: ['ADMIN'] },
      visibleDepartments: { type: [String], default: ['Development', 'Digital Marketing', 'HR', 'BA', 'BDA'] },
    },
  },
  { timestamps: true }
);

export const Organization = mongoose.model<IOrganization>('Organization', organizationSchema);


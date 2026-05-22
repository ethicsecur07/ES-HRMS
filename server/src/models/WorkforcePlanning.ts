import mongoose, { Schema, Document } from 'mongoose';
import { softDeletePlugin } from '../utils/softDeletePlugin.js';

// --- MANPOWER FORECAST MODEL ---
export interface IManpowerForecast extends Document {
  organizationId: mongoose.Types.ObjectId;
  department: string;
  year: number;
  quarter: number; // 1, 2, 3, 4
  currentHeadcount: number;
  targetHeadcount: number;
  estimatedBudget: number;
  isActive: boolean;
}

const manpowerForecastSchema = new Schema<IManpowerForecast>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    department: { type: String, required: true },
    year: { type: Number, required: true },
    quarter: { type: Number, required: true, min: 1, max: 4 },
    currentHeadcount: { type: Number, required: true, default: 0 },
    targetHeadcount: { type: Number, required: true },
    estimatedBudget: { type: Number, required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);
manpowerForecastSchema.index({ organizationId: 1, department: 1, year: 1, quarter: 1 }, { unique: true });
manpowerForecastSchema.plugin(softDeletePlugin);

export const ManpowerForecast = mongoose.model<IManpowerForecast>('ManpowerForecast', manpowerForecastSchema);

// --- VACANCY PLANNING MODEL ---
export interface IVacancyPlanning extends Document {
  organizationId: mongoose.Types.ObjectId;
  title: string;
  department: string;
  designation: string;
  status: 'DRAFT' | 'OPEN' | 'FILLED' | 'CANCELLED';
  budgetAmount: number;
  targetDate: Date;
  hiredEmployeeId?: mongoose.Types.ObjectId;
  isActive: boolean;
}

const vacancyPlanningSchema = new Schema<IVacancyPlanning>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    title: { type: String, required: true },
    department: { type: String, required: true },
    designation: { type: String, required: true },
    status: { type: String, enum: ['DRAFT', 'OPEN', 'FILLED', 'CANCELLED'], default: 'OPEN' },
    budgetAmount: { type: Number, required: true },
    targetDate: { type: Date, required: true },
    hiredEmployeeId: { type: Schema.Types.ObjectId, ref: 'Employee' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);
vacancyPlanningSchema.plugin(softDeletePlugin);

export const VacancyPlanning = mongoose.model<IVacancyPlanning>('VacancyPlanning', vacancyPlanningSchema);

// --- ATTRITION PREDICTION MODEL ---
export interface IAttritionPrediction extends Document {
  organizationId: mongoose.Types.ObjectId;
  employeeId: mongoose.Types.ObjectId;
  attritionRiskScore: number; // 0 to 100
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  factors: string[]; // e.g. ["Overtime excess", "Salary below industry benchmark"]
  lastEvaluated: Date;
  isActive: boolean;
}

const attritionPredictionSchema = new Schema<IAttritionPrediction>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    attritionRiskScore: { type: Number, required: true, min: 0, max: 100 },
    riskLevel: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH'], required: true },
    factors: [{ type: String }],
    lastEvaluated: { type: Date, default: Date.now },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);
attritionPredictionSchema.index({ organizationId: 1, employeeId: 1 }, { unique: true });
attritionPredictionSchema.plugin(softDeletePlugin);

export const AttritionPrediction = mongoose.model<IAttritionPrediction>('AttritionPrediction', attritionPredictionSchema);

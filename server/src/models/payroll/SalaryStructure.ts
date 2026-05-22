import mongoose, { Schema, Document } from 'mongoose';

export interface ISalaryStructure extends Document {
  organizationId: mongoose.Types.ObjectId;
  employeeId: mongoose.Types.ObjectId;
  components: {
    componentId: mongoose.Types.ObjectId;
    fixedValue?: number; // Used if component is FIXED calculation type
  }[];
  effectiveDate: Date;
  status: 'ACTIVE' | 'ARCHIVED' | 'DRAFT';
  revisionNote?: string;
  baseSalary: number; // For easy referencing in formulas (e.g. "Basic" placeholder)
}

const salaryStructureSchema = new Schema<ISalaryStructure>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    components: [
      {
        componentId: { type: Schema.Types.ObjectId, ref: 'SalaryComponent', required: true },
        fixedValue: { type: Number }
      }
    ],
    effectiveDate: { type: Date, required: true, default: Date.now },
    status: { type: String, enum: ['ACTIVE', 'ARCHIVED', 'DRAFT'], default: 'DRAFT' },
    revisionNote: { type: String },
    baseSalary: { type: Number, required: true, default: 0 }
  },
  { timestamps: true }
);

// We want fast retrieval of an employee's active salary structure
salaryStructureSchema.index({ employeeId: 1, status: 1 });

export const SalaryStructure = mongoose.model<ISalaryStructure>('SalaryStructure', salaryStructureSchema);

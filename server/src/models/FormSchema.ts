import mongoose, { Schema, Document } from 'mongoose';

export interface IFormField {
  name: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'date' | 'boolean';
  required: boolean;
  options?: string[]; // For 'select' field type
  validationRegex?: string;
  defaultValue?: string;
  dependsOnField?: string; // Conditional logic: name of field it depends on
  dependsOnValue?: string; // Conditional logic: value to show this field
}

export interface IFormSchema extends Document {
  organizationId: mongoose.Types.ObjectId;
  formCode: string; // e.g., 'EMPLOYEE_PROFILE', 'EXPENSE_FORM'
  fields: IFormField[];
  createdAt: Date;
  updatedAt: Date;
}

const formFieldSchema = new Schema<IFormField>({
  name: { type: String, required: true, trim: true },
  label: { type: String, required: true },
  type: { type: String, enum: ['text', 'number', 'select', 'date', 'boolean'], required: true },
  required: { type: Boolean, default: false },
  options: { type: [String], default: [] },
  validationRegex: { type: String, default: '' },
  defaultValue: { type: String, default: '' },
  dependsOnField: { type: String, default: '' },
  dependsOnValue: { type: String, default: '' },
});

const formSchemaDefinition = new Schema<IFormSchema>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    formCode: { type: String, required: true, uppercase: true, trim: true },
    fields: { type: [formFieldSchema], default: [] },
  },
  { timestamps: true }
);

formSchemaDefinition.index({ organizationId: 1, formCode: 1 }, { unique: true });

export const FormSchema = mongoose.model<IFormSchema>('FormSchema', formSchemaDefinition);

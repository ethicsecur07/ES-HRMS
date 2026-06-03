import React, { useState, useEffect } from 'react';

export interface FormFieldData {
  name: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'date' | 'boolean';
  required: boolean;
  options?: string[];
  validationRegex?: string;
  defaultValue?: string;
  dependsOnField?: string;
  dependsOnValue?: string;
}

export interface FormSchemaData {
  formCode: string;
  fields: FormFieldData[];
}

interface DynamicFormBuilderProps {
  schema: FormSchemaData;
  onSubmit: (data: Record<string, any>) => void;
  initialValues?: Record<string, any>;
  submitLabel?: string;
}

export const DynamicFormBuilder: React.FC<DynamicFormBuilderProps> = ({
  schema,
  onSubmit,
  initialValues = {},
  submitLabel = 'Submit'
}) => {
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Initialize values
  useEffect(() => {
    const defaultData: Record<string, any> = {};
    schema.fields.forEach(field => {
      defaultData[field.name] = initialValues[field.name] ?? field.defaultValue ?? (field.type === 'boolean' ? false : '');
    });
    setFormData(defaultData);
  }, [schema, initialValues]);

  const handleChange = (name: string, value: any) => {
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear field-level error
    if (errors[name]) {
      setErrors(prev => {
        const copy = { ...prev };
        delete copy[name];
        return copy;
      });
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    schema.fields.forEach(field => {
      // Evaluate if field is active/visible
      const isVisible = !field.dependsOnField || String(formData[field.dependsOnField]) === field.dependsOnValue;
      if (!isVisible) return;

      const val = formData[field.name];

      // Check required
      if (field.required && (val === undefined || val === null || val === '')) {
        newErrors[field.name] = `${field.label} is required`;
        return;
      }

      // Check Regex Validation
      if (val && field.validationRegex) {
        try {
          const regex = new RegExp(field.validationRegex);
          if (!regex.test(String(val))) {
            newErrors[field.name] = `Invalid format for ${field.label}`;
          }
        } catch (e) {
          console.error('Invalid regex pattern:', field.validationRegex, e);
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      // Filter out fields that were hidden due to unmet conditions
      const submissionData: Record<string, any> = {};
      schema.fields.forEach(field => {
        const isVisible = !field.dependsOnField || String(formData[field.dependsOnField]) === field.dependsOnValue;
        if (isVisible) {
          submissionData[field.name] = formData[field.name];
        }
      });
      onSubmit(submissionData);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 w-full max-w-lg mx-auto bg-card border border-border p-6 sm:p-8 rounded-3xl shadow-xl backdrop-blur-md bg-opacity-95">
      <div className="text-left mb-6">
        <h2 className="text-xl font-bold tracking-tight text-foreground">{schema.formCode.replace(/_/g, ' ')}</h2>
        <p className="text-xs text-muted-foreground mt-1">Please fill in the dynamic details below.</p>
      </div>

      <div className="space-y-4 px-4">
        {schema.fields.map(field => {
          // Conditional check
          const isVisible = !field.dependsOnField || String(formData[field.dependsOnField]) === field.dependsOnValue;
          if (!isVisible) return null;

          const error = errors[field.name];

          return (
            <div key={field.name} className="flex flex-col text-left space-y-1.5 animate-in fade-in duration-300">
              <label htmlFor={field.name} className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {field.label} {field.required && <span className="text-destructive">*</span>}
              </label>

              {field.type === 'select' ? (
                <select
                  id={field.name}
                  value={formData[field.name] ?? ''}
                  onChange={e => handleChange(field.name, e.target.value)}
                  className={`w-full px-4 py-3 rounded-xl border bg-background text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-primary/20 ${
                    error ? 'border-destructive focus:border-destructive' : 'border-border focus:border-primary'
                  }`}
                >
                  <option value="">Select option</option>
                  {field.options?.map(opt => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              ) : field.type === 'boolean' ? (
                <div className="flex items-center space-x-3 py-1">
                  <input
                    id={field.name}
                    type="checkbox"
                    checked={!!formData[field.name]}
                    onChange={e => handleChange(field.name, e.target.checked)}
                    className="h-4.5 w-4.5 rounded border-border text-primary focus:ring-primary/20 cursor-pointer"
                  />
                  <span className="text-sm font-medium text-foreground">{field.label}</span>
                </div>
              ) : (
                <input
                  id={field.name}
                  type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                  value={formData[field.name] ?? ''}
                  onChange={e => handleChange(field.name, e.target.value)}
                  className={`w-full px-4 py-3 rounded-xl border bg-background text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-primary/20 ${
                    error ? 'border-destructive focus:border-destructive' : 'border-border focus:border-primary'
                  }`}
                  placeholder={`Enter ${field.label.toLowerCase()}`}
                />
              )}

              {error && <span className="text-xs font-semibold text-destructive">{error}</span>}
            </div>
          );
        })}
      </div>

      <button
        type="submit"
        className="w-full mt-2 py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm tracking-wide shadow-md shadow-primary/20 hover:opacity-90 active:scale-[0.99] transition-all duration-200"
      >
        {submitLabel.toUpperCase()}
      </button>
    </form>
  );
};

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { leaveApi } from '../../api_service/leaveApi';
import { wfhApi } from '../../api_service/wfhApi';
import { permissionApi } from '../../api_service/permissionApi';
import { useAuthStore } from '../../store/useAuthStore';
import { useNotificationStore } from '../../store/useNotificationStore';
import { Modal } from '../WrapperComponents/Modal';
import { Button } from '../WrapperComponents/Button';
import { Input, Select, Textarea } from '../WrapperComponents/Input';
import type { LeaveType } from '../../types';

const baseSchema = z.object({
  leaveType: z.enum(['Casual Leave', 'Sick Leave', 'WFH', 'Permission']),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
  reason: z.string().min(5, 'Please provide a detailed reason'),
  expectedTasks: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
});

type LeaveFormValues = z.infer<typeof baseSchema>;

interface LeaveApplyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LeaveApplyModal: React.FC<LeaveApplyModalProps> = ({ isOpen, onClose }) => {
  const { user } = useAuthStore();
  const { addToast } = useNotificationStore();
  const queryClient = useQueryClient();

  const [selectedType, setSelectedType] = useState<LeaveType>('Casual Leave');

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<LeaveFormValues>({
    resolver: zodResolver(baseSchema),
    defaultValues: {
      leaveType: 'Casual Leave',
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0],
      reason: '',
      expectedTasks: '',
      startTime: '10:00',
      endTime: '13:00',
    },
  });

  const watchType = watch('leaveType');
  React.useEffect(() => {
    setSelectedType(watchType as LeaveType);
  }, [watchType]);

  const applyMutation = useMutation({
    mutationFn: async (values: LeaveFormValues) => {
      const empId = user?.employeeId || user?._id;

      if (!empId) {
        throw new Error('Employee profile not found. Please contact HR.');
      }

      if (values.leaveType === 'WFH') {
        return wfhApi.applyWFH({
          employeeId: empId,
          date: values.startDate,
          reason: values.reason,
          expectedTasks: values.expectedTasks || 'Standard daily tasks',
        });
      } else if (values.leaveType === 'Permission') {
        // Calculate hours from time inputs (do NOT send hardcoded value)
        const startParts = (values.startTime || '10:00').split(':').map(Number);
        const endParts = (values.endTime || '13:00').split(':').map(Number);
        const startMinutes = startParts[0] * 60 + startParts[1];
        const endMinutes = endParts[0] * 60 + endParts[1];
        const calculatedHours = parseFloat(((endMinutes - startMinutes) / 60).toFixed(2));
        
        if (calculatedHours <= 0) {
          throw new Error('End time must be after start time.');
        }

        return permissionApi.applyPermission({
          employeeId: empId,
          date: values.startDate,
          startTime: values.startTime || '10:00',
          endTime: values.endTime || '13:00',
          totalHours: calculatedHours, // Calculated from times, validated server-side too
          reason: values.reason,
        });
      } else {
        return leaveApi.applyLeave({
          employeeId: empId,
          leaveType: values.leaveType as any,
          startDate: values.startDate,
          endDate: values.endDate,
          // Note: totalDays is recalculated server-side — this is just a hint
          totalDays: Math.max(1, Math.ceil((new Date(values.endDate).getTime() - new Date(values.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1),
          reason: values.reason,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leaves'] });
      queryClient.invalidateQueries({ queryKey: ['wfh'] });
      queryClient.invalidateQueries({ queryKey: ['permissions'] });
      addToast('Application Submitted', 'Your request has been forwarded to HR for approval.', 'success');
      reset();
      onClose();
    },
    onError: (err: any) => {
      const errMsg = err.response?.data?.message || 'Could not submit application. Please try again.';
      addToast('Submission Failed', errMsg, 'error');
    },
  });

  const onSubmit = (values: LeaveFormValues) => {
    applyMutation.mutate(values);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Apply Leave / WFH / Permission" maxWidth="max-w-xl">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-2  px-2 text-left">
        <Select
          label="Request Type *"
          {...register('leaveType')}
          error={errors.leaveType?.message}
          options={[
            { value: 'Casual Leave', label: 'Casual Leave' },
            { value: 'Sick Leave', label: 'Sick Leave' },
            { value: 'WFH', label: 'Work From Home (WFH)' },
            { value: 'Permission', label: 'Permission Hours' },
          ]}
        />

        {selectedType === 'Permission' ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input label="Date *" type="date" {...register('startDate')} error={errors.startDate?.message} />
            <Input label="Start Time *" type="time" {...register('startTime')} error={errors.startTime?.message} />
            <Input label="End Time *" type="time" {...register('endTime')} error={errors.endTime?.message} />
          </div>
        ) : selectedType === 'WFH' ? (
          <Input label="WFH Date *" type="date" {...register('startDate')} error={errors.startDate?.message} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Start Date *" type="date" {...register('startDate')} error={errors.startDate?.message} />
            <Input label="End Date *" type="date" {...register('endDate')} error={errors.endDate?.message} />
          </div>
        )}

        {selectedType === 'WFH' && (
          <Textarea
            label="Expected Tasks / Work Plan *"
            placeholder="Outline what tasks you will accomplish during WFH..."
            {...register('expectedTasks')}
            error={errors.expectedTasks?.message}
          />
        )}

        <Textarea
          label="Reason for Request *"
          placeholder="Provide a clear reason for your request..."
          {...register('reason')}
          error={errors.reason?.message}
        />

        <div className="flex justify-end gap-3 pt-4 border-t border-border">
          <Button variant="outline" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSubmitting || applyMutation.isPending}>
            Submit Application
          </Button>
        </div>
      </form>
    </Modal>
  );
};

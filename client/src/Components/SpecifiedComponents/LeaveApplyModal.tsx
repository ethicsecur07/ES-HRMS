import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { leaveApi } from '../../api_service/leaveApi';
import { wfhApi } from '../../api_service/wfhApi';
import { permissionApi } from '../../api_service/permissionApi';
import { holidayCalendarApi } from '../../api_service/holidayCalendarApi';
import { useAuthStore } from '../../store/useAuthStore';
import { useNotificationStore } from '../../store/useNotificationStore';
import { Modal } from '../WrapperComponents/Modal';
import { Button } from '../WrapperComponents/Button';
import { Input, Select, Textarea } from '../WrapperComponents/Input';
import { formatDate } from '../../utils/formatters';
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

  const currentYear = new Date().getFullYear();
  const { data: holidays = [] } = useQuery({
    queryKey: ['holidays', currentYear],
    queryFn: () => holidayCalendarApi.getAll(currentYear),
    staleTime: 10 * 60 * 1000,
  });

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

  const [holidayError, setHolidayError] = useState<string | null>(null);

  const watchType = watch('leaveType');
  const watchStartDate = watch('startDate');
  const watchEndDate = watch('endDate');

  React.useEffect(() => {
    setSelectedType(watchType as LeaveType);
    setHolidayError(null);
  }, [watchType, watchStartDate, watchEndDate]);

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
      const errMsg = err.response?.data?.message || err.message || 'Could not submit application. Please try again.';
      addToast('Submission Failed', errMsg, 'error');
    },
  });

  const onSubmit = (values: LeaveFormValues) => {
    // Check if the selected date or date range falls on a holiday
    if (values.leaveType === 'Permission' || values.leaveType === 'WFH') {
      const holiday = holidays.find(h => h.date === values.startDate);
      if (holiday) {
        setHolidayError(`You cannot request ${values.leaveType} on ${holiday.name} (${formatDate(holiday.date)}), which is a holiday.`);
        return;
      }
    } else {
      // For leaves, check each date in the range [startDate, endDate]
      const rangeDates: string[] = [];
      const curr = new Date(values.startDate);
      const last = new Date(values.endDate);
      while (curr <= last) {
        rangeDates.push(curr.toISOString().split('T')[0]);
        curr.setDate(curr.getDate() + 1);
      }

      const holiday = holidays.find(h => rangeDates.includes(h.date));
      if (holiday) {
        setHolidayError(`Your selected leave range includes ${holiday.name} (${formatDate(holiday.date)}), which is a holiday.`);
        return;
      }
    }

    applyMutation.mutate(values);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Apply Leave / WFH / Permission" maxWidth="max-w-xl">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-2 px-4 text-left">
        {applyMutation.isError && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs font-bold space-y-1 mb-2 animate-in fade-in duration-200">
            <p className="uppercase tracking-wider font-extrabold text-[10px]">Submission Failed</p>
            <p className="font-semibold leading-relaxed">
              {applyMutation.error?.response?.data?.message || applyMutation.error?.message || 'Could not submit application.'}
            </p>
          </div>
        )}

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

        {holidayError && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs font-bold space-y-1 mb-2 animate-in fade-in duration-200">
            <p className="uppercase tracking-wider font-extrabold text-[10px]">Cannot Apply on Holiday</p>
            <p className="font-semibold leading-relaxed">{holidayError}</p>
          </div>
        )}

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

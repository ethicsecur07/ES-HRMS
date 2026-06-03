import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { permissionApi } from '../../api_service/permissionApi';
import { holidayCalendarApi } from '../../api_service/holidayCalendarApi';
import { useAuthStore } from '../../store/useAuthStore';
import { useNotificationStore } from '../../store/useNotificationStore';
import { Modal } from '../WrapperComponents/Modal';
import { Button } from '../WrapperComponents/Button';
import { Input, Textarea } from '../WrapperComponents/Input';
import { formatDate } from '../../utils/formatters';

const permSchema = z.object({
  date: z.string().min(1, 'Date is required'),
  startTime: z.string().min(1, 'Start time is required'),
  endTime: z.string().min(1, 'End time is required'),
  reason: z.string().min(5, 'Please provide a detailed reason'),
});

type PermFormValues = z.infer<typeof permSchema>;

interface PermissionRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PermissionRequestModal: React.FC<PermissionRequestModalProps> = ({ isOpen, onClose }) => {
  const { user } = useAuthStore();
  const { addToast } = useNotificationStore();
  const queryClient = useQueryClient();

  const currentYear = new Date().getFullYear();
  const { data: holidays = [] } = useQuery({
    queryKey: ['holidays', currentYear],
    queryFn: () => holidayCalendarApi.getAll(currentYear),
    staleTime: 10 * 60 * 1000,
  });

  const [holidayError, setHolidayError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<PermFormValues>({
    resolver: zodResolver(permSchema),
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
      startTime: '15:00',
      endTime: '18:00',
      reason: '',
    },
  });

  const watchDate = watch('date');
  React.useEffect(() => {
    setHolidayError(null);
  }, [watchDate]);

  const applyMutation = useMutation({
    mutationFn: (values: PermFormValues) => {
      const start = new Date(`1970-01-01T${values.startTime}:00`).getTime();
      const end = new Date(`1970-01-01T${values.endTime}:00`).getTime();
      const totalHours = Math.max(0.5, parseFloat(((end - start) / (1000 * 60 * 60)).toFixed(1)));

      return permissionApi.applyPermission({
        employeeId: user?.employeeId || user?._id || 'emp-dev-001',
        date: values.date,
        startTime: values.startTime,
        endTime: values.endTime,
        totalHours,
        reason: values.reason,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permissions'] });
      addToast('Permission Requested', 'Your 3-hour monthly permission request has been submitted.', 'success');
      reset();
      onClose();
    },
    onError: (err: any) => {
      const errMsg = err.response?.data?.message || err.message || 'Could not submit permission request.';
      addToast('Submission Failed', errMsg, 'error');
    },
  });

  const onSubmit = (values: PermFormValues) => {
    const holiday = holidays.find(h => h.date === values.date);
    if (holiday) {
      setHolidayError(`You cannot request Permission on ${holiday.name} (${formatDate(holiday.date)}), which is a holiday.`);
      return;
    }
    applyMutation.mutate(values);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Request Permission Hours" maxWidth="max-w-xl">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 px-4 text-left px-4">
        <div className="p-3 bg-muted rounded-xl text-xs text-muted-foreground leading-relaxed">
          <span className="font-bold text-foreground">Company Policy:</span> Employees are eligible for up to 3 hours of permission per month for personal errands.
        </div>

        {applyMutation.isError && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs font-bold space-y-1 animate-in fade-in duration-200">
            <p className="uppercase tracking-wider font-extrabold text-[10px]">Submission Failed</p>
            <p className="font-semibold leading-relaxed">
              {applyMutation.error?.response?.data?.message || applyMutation.error?.message || 'Could not submit permission request.'}
            </p>
          </div>
        )}

        <Input label="Permission Date *" type="date" {...register('date')} error={errors.date?.message} />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="Start Time *" type="time" {...register('startTime')} error={errors.startTime?.message} />
          <Input label="End Time *" type="time" {...register('endTime')} error={errors.endTime?.message} />
        </div>

        <Textarea
          label="Reason for Permission *"
          placeholder="State the reason for requesting permission hours..."
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
            Submit Request
          </Button>
        </div>
      </form>
    </Modal>
  );
};

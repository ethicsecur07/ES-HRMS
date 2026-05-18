import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { permissionApi } from '../../api_service/permissionApi';
import { useAuthStore } from '../../store/useAuthStore';
import { useNotificationStore } from '../../store/useNotificationStore';
import { Modal } from '../WrapperComponents/Modal';
import { Button } from '../WrapperComponents/Button';
import { Input, Textarea } from '../WrapperComponents/Input';

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

  const {
    register,
    handleSubmit,
    reset,
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
    onError: () => {
      addToast('Submission Failed', 'Could not submit permission request.', 'error');
    },
  });

  const onSubmit = (values: PermFormValues) => {
    applyMutation.mutate(values);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Request Permission Hours" maxWidth="max-w-lg">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 text-left">
        <div className="p-3 bg-muted rounded-xl text-xs text-muted-foreground leading-relaxed">
          <span className="font-bold text-foreground">Company Policy:</span> Employees are eligible for up to 3 hours of permission per month for personal errands.
        </div>

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

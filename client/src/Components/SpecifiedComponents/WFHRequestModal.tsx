import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { wfhApi } from '../../api_service/wfhApi';
import { useAuthStore } from '../../store/useAuthStore';
import { useNotificationStore } from '../../store/useNotificationStore';
import { Modal } from '../WrapperComponents/Modal';
import { Button } from '../WrapperComponents/Button';
import { Input, Textarea } from '../WrapperComponents/Input';

const wfhSchema = z.object({
  date: z.string().min(1, 'Date is required'),
  reason: z.string().min(5, 'Please provide a detailed reason'),
  expectedTasks: z.string().min(5, 'Please outline your expected tasks'),
});

type WFHFormValues = z.infer<typeof wfhSchema>;

interface WFHRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WFHRequestModal: React.FC<WFHRequestModalProps> = ({ isOpen, onClose }) => {
  const { user } = useAuthStore();
  const { addToast } = useNotificationStore();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<WFHFormValues>({
    resolver: zodResolver(wfhSchema),
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
      reason: '',
      expectedTasks: '',
    },
  });

  const applyMutation = useMutation({
    mutationFn: (values: WFHFormValues) =>
      wfhApi.applyWFH({
        employeeId: user?.employeeId || user?._id || 'emp-dev-001',
        date: values.date,
        reason: values.reason,
        expectedTasks: values.expectedTasks,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wfh'] });
      addToast('WFH Request Submitted', 'Your WFH request has been sent to HR for approval.', 'success');
      reset();
      onClose();
    },
    onError: (err: any) => {
      const errMsg = err.response?.data?.message || err.message || 'Could not submit WFH request.';
      addToast('Submission Failed', errMsg, 'error');
    },
  });

  const onSubmit = (values: WFHFormValues) => {
    applyMutation.mutate(values);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Request Work From Home (WFH)" maxWidth="max-w-lg">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 text-left">
        <div className="p-3 bg-muted rounded-xl text-xs text-muted-foreground leading-relaxed">
          <span className="font-bold text-foreground">Company Policy:</span> 1 WFH is permitted per month. Minimum 8 working hours and daily task reporting are mandatory upon check-out.
        </div>

        {applyMutation.isError && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs font-bold space-y-1 animate-in fade-in duration-200">
            <p className="uppercase tracking-wider font-extrabold text-[10px]">Submission Failed</p>
            <p className="font-semibold leading-relaxed">
              {applyMutation.error?.response?.data?.message || applyMutation.error?.message || 'Could not submit WFH request.'}
            </p>
          </div>
        )}

        <Input label="WFH Date *" type="date" {...register('date')} error={errors.date?.message} />

        <Textarea
          label="Expected Tasks *"
          placeholder="List the deliverables you will complete during WFH..."
          {...register('expectedTasks')}
          error={errors.expectedTasks?.message}
        />

        <Textarea
          label="Reason for WFH *"
          placeholder="Explain why you require WFH on this date..."
          {...register('reason')}
          error={errors.reason?.message}
        />

        <div className="flex justify-end gap-3 pt-4 border-t border-border">
          <Button variant="outline" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSubmitting || applyMutation.isPending}>
            Submit WFH Request
          </Button>
        </div>
      </form>
    </Modal>
  );
};

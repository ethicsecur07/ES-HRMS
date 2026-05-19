import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { taskApi } from '../../api_service/taskApi';
import { attendanceApi } from '../../api_service/attendanceApi';
import { useAuthStore } from '../../store/useAuthStore';
import { useNotificationStore } from '../../store/useNotificationStore';
import { Button } from '../WrapperComponents/Button';
import { Textarea } from '../WrapperComponents/Input';
import { CheckCircle2, AlertCircle } from 'lucide-react';

const taskSchema = z.object({
  inProgressTasks: z.string().optional(),
  completedTasks: z.string().min(5, 'Please list what you completed today.'),
  pendingTasks: z.string().optional(),
  blockers: z.string().optional(),
  tomorrowPlan: z.string().optional(),
});

type TaskFormValues = z.infer<typeof taskSchema>;

interface TaskReportFormProps {
  attendanceId: string;
  onCompleted: () => void;
}

export const TaskReportForm: React.FC<TaskReportFormProps> = ({ attendanceId, onCompleted }) => {
  const { user } = useAuthStore();
  const { addToast } = useNotificationStore();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      inProgressTasks: '',
      completedTasks: '',
      pendingTasks: '',
      blockers: '',
      tomorrowPlan: '',
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (values: TaskFormValues) => {
      // 1. Submit task report
      const task = await taskApi.submitDailyReport({
        employeeId: user?.employeeId || user?._id || 'emp-dev-001',
        date: new Date().toISOString().split('T')[0],
        inProgressTasks: values.inProgressTasks || '',
        completedTasks: values.completedTasks || '',
        pendingTasks: values.pendingTasks || '',
        blockers: values.blockers || 'None',
        tomorrowPlan: values.tomorrowPlan || '',
      });

      // 2. Trigger check-out with task ID
      await attendanceApi.checkOut(attendanceId, task._id);
      return task;
    },
    onSuccess: () => {
      addToast('Check-Out & Task Submitted', 'Your daily report has been archived successfully.', 'success');
      onCompleted();
    },
    onError: () => {
      addToast('Submission Failed', 'An error occurred while submitting your task report.', 'error');
    },
  });

  const onSubmit = (values: TaskFormValues) => {
    submitMutation.mutate(values);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 space-x-1 text-left">
      <div className="p-3.5 rounded-xl bg-primary/10 border border-primary/20 flex items-center gap-3 text-primary text-xs font-semibold">
        <AlertCircle className="w-4 h-4 flex-shrink-0" />
        <span>Submitting your daily task report is mandatory before checking out. Only Completed Tasks is required.</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Textarea
          label="Completed Tasks *"
          placeholder="List tasks fully completed today..."
          {...register('completedTasks')}
          error={errors.completedTasks?.message}
        />

        <Textarea
          label="In Progress Tasks (Optional)"
          placeholder="Tasks currently in progress..."
          {...register('inProgressTasks')}
          error={errors.inProgressTasks?.message}
        />

        <Textarea
          label="Pending Tasks (Optional)"
          placeholder="Tasks yet to be started..."
          {...register('pendingTasks')}
          error={errors.pendingTasks?.message}
        />

        <Textarea
          label="Plan for Tomorrow (Optional)"
          placeholder="Outline what you will work on tomorrow..."
          {...register('tomorrowPlan')}
          error={errors.tomorrowPlan?.message}
        />
      </div>

      <Textarea
        label="Issues / Blockers (Optional)"
        placeholder="Mention any dependencies or roadblocks (or write None)..."
        {...register('blockers')}
        error={errors.blockers?.message}
      />

      <div className="flex justify-end gap-3 pt-4 border-t border-border">
        <Button
          type="submit"
          isLoading={isSubmitting || submitMutation.isPending}
          className="w-full sm:w-auto bg-gradient-to-r from-primary to-accent text-white font-bold tracking-wider shadow-lg shadow-primary/20"
        >
          <CheckCircle2 className="w-5 h-5 mr-2" />
          CONFIRM CHECK OUT & SUBMIT
        </Button>
      </div>
    </form>
  );
};

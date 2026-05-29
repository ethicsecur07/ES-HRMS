import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { recruitmentApi } from '../../api_service/recruitmentApi';
import type { Candidate, RecruitmentStage, StageEvaluation } from '../../types';
import { useNotificationStore } from '../../store/useNotificationStore';
import { Modal } from '../WrapperComponents/Modal';
import { Button } from '../WrapperComponents/Button';
import { 
  CheckCircle2, 
  Circle, 
  Star, 
  MessageSquare, 
  Wrench, 
  UserCheck, 
  Loader2,
  Calendar,
  Layers
} from 'lucide-react';

interface EvaluationModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidate: Candidate | null;
}

const STAGES: RecruitmentStage[] = ['NEW', 'SCREENING', 'INTERVIEW', 'TECHNICAL', 'HR', 'OFFER', 'HIRED'];

const STAGE_LABELS: Record<RecruitmentStage, string> = {
  NEW: 'New Applied',
  SCREENING: 'Screening',
  INTERVIEW: 'First Interview',
  TECHNICAL: 'Technical Round',
  HR: 'HR Round',
  OFFER: 'Offer Extended',
  HIRED: 'Hired'
};

export const EvaluationModal: React.FC<EvaluationModalProps> = ({ isOpen, onClose, candidate }) => {
  const { addToast } = useNotificationStore();
  const queryClient = useQueryClient();

  const [selectedStage, setSelectedStage] = useState<RecruitmentStage>('SCREENING');
  
  // Local state to store evaluations array temporarily before saving
  const [evaluations, setEvaluations] = useState<Record<RecruitmentStage, StageEvaluation>>({
    NEW: { stage: 'NEW', completed: false, comments: '', ratingCommunication: 0, ratingTechnical: 0, toolsExperiences: '' },
    SCREENING: { stage: 'SCREENING', completed: false, comments: '', ratingCommunication: 0, ratingTechnical: 0, toolsExperiences: '' },
    INTERVIEW: { stage: 'INTERVIEW', completed: false, comments: '', ratingCommunication: 0, ratingTechnical: 0, toolsExperiences: '' },
    TECHNICAL: { stage: 'TECHNICAL', completed: false, comments: '', ratingCommunication: 0, ratingTechnical: 0, toolsExperiences: '' },
    HR: { stage: 'HR', completed: false, comments: '', ratingCommunication: 0, ratingTechnical: 0, toolsExperiences: '' },
    OFFER: { stage: 'OFFER', completed: false, comments: '', ratingCommunication: 0, ratingTechnical: 0, toolsExperiences: '' },
    HIRED: { stage: 'HIRED', completed: false, comments: '', ratingCommunication: 0, ratingTechnical: 0, toolsExperiences: '' },
  });

  // Load candidate's evaluations when modal opens or candidate changes
  useEffect(() => {
    if (candidate) {
      // Set the active selected stage to the candidate's current stage (if it exists in STAGES)
      if (STAGES.includes(candidate.stage)) {
        setSelectedStage(candidate.stage);
      }

      const initialEvaluations: Record<RecruitmentStage, StageEvaluation> = {
        NEW: { stage: 'NEW', completed: false, comments: '', ratingCommunication: 0, ratingTechnical: 0, toolsExperiences: '' },
        SCREENING: { stage: 'SCREENING', completed: false, comments: '', ratingCommunication: 0, ratingTechnical: 0, toolsExperiences: '' },
        INTERVIEW: { stage: 'INTERVIEW', completed: false, comments: '', ratingCommunication: 0, ratingTechnical: 0, toolsExperiences: '' },
        TECHNICAL: { stage: 'TECHNICAL', completed: false, comments: '', ratingCommunication: 0, ratingTechnical: 0, toolsExperiences: '' },
        HR: { stage: 'HR', completed: false, comments: '', ratingCommunication: 0, ratingTechnical: 0, toolsExperiences: '' },
        OFFER: { stage: 'OFFER', completed: false, comments: '', ratingCommunication: 0, ratingTechnical: 0, toolsExperiences: '' },
        HIRED: { stage: 'HIRED', completed: false, comments: '', ratingCommunication: 0, ratingTechnical: 0, toolsExperiences: '' },
      };

      // Merge saved evaluations from DB
      if (candidate.evaluations && Array.isArray(candidate.evaluations)) {
        candidate.evaluations.forEach((evalItem) => {
          if (evalItem.stage && initialEvaluations[evalItem.stage]) {
            initialEvaluations[evalItem.stage] = {
              ...evalItem,
              ratingCommunication: evalItem.ratingCommunication || 0,
              ratingTechnical: evalItem.ratingTechnical || 0,
              comments: evalItem.comments || '',
              toolsExperiences: evalItem.toolsExperiences || '',
              completed: !!evalItem.completed,
              completedAt: evalItem.completedAt || undefined
            };
          }
        });
      }

      setEvaluations(initialEvaluations);
    }
  }, [candidate, isOpen]);

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Candidate> }) => recruitmentApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['candidates'] });
      addToast('Evaluations Saved', 'Candidate evaluation feedback has been saved successfully.', 'success');
      onClose();
    },
    onError: (error: any) => {
      const errMsg = error?.response?.data?.message || error.message || 'Could not save evaluation.';
      addToast('Save Failed', errMsg, 'error');
    }
  });

  if (!isOpen || !candidate) return null;

  const currentEval = evaluations[selectedStage];

  const handleFieldChange = (field: keyof StageEvaluation, value: any) => {
    setEvaluations((prev) => ({
      ...prev,
      [selectedStage]: {
        ...prev[selectedStage],
        [field]: value,
        ...(field === 'completed' && value === true ? { completedAt: new Date().toISOString() } : {})
      }
    }));
  };

  const handleSave = () => {
    // Transform evaluations map back to list format for database submission
    const evaluationsList = Object.values(evaluations).filter(
      (item) => item.completed || item.comments || item.ratingCommunication || item.ratingTechnical || item.toolsExperiences
    );

    updateMutation.mutate({
      id: candidate._id,
      data: {
        evaluations: evaluationsList
      }
    });
  };

  // Component to render Star Selector
  const StarRatingSelector: React.FC<{
    rating: number;
    onChange: (rating: number) => void;
    label: string;
  }> = ({ rating, onChange, label }) => {
    const [hoverRating, setHoverRating] = useState<number | null>(null);

    return (
      <div className="space-y-1.5 text-left">
        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider">{label}</label>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((star) => {
            const isActive = hoverRating !== null ? star <= hoverRating : star <= rating;
            return (
              <button
                type="button"
                key={star}
                onClick={() => onChange(star)}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(null)}
                className="p-0.5 rounded-md hover:bg-muted/80 transition-colors cursor-pointer group"
              >
                <Star 
                  className={`w-7 h-7 stroke-[1.5] transition-all transform group-hover:scale-110 ${
                    isActive 
                      ? 'fill-amber-400 stroke-amber-400 drop-shadow-[0_0_4px_rgba(251,191,36,0.3)]' 
                      : 'stroke-muted-foreground/40 hover:stroke-muted-foreground/80'
                  }`}
                />
              </button>
            );
          })}
          {rating > 0 && (
            <span className="ml-2 text-sm font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded">
              {rating}.0 / 5.0
            </span>
          )}
        </div>
      </div>
    );
  };

  // Completed steps details count
  const completedCount = Object.values(evaluations).filter(e => e.completed).length;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Review & Performance Evaluation"
      maxWidth="max-w-4xl"
    >
      <div className="flex flex-col h-[70vh]">
        {/* Candidate Summary Header */}
        <div className="shrink-0 flex items-center justify-between bg-muted/20 border border-border p-4 rounded-xl mb-4 text-left">
          <div>
            <h4 className="text-lg font-bold text-foreground">
              {candidate.firstName} {candidate.lastName}
            </h4>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-muted-foreground font-medium">
              <span className="flex items-center gap-1 text-primary">
                <Layers className="w-3.5 h-3.5" />
                Applied for: <strong className="text-foreground">{candidate.appliedRole}</strong>
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                Joined: {new Date(candidate.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>

          <div className="flex flex-col items-end">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
              Workflow Status
            </span>
            <span className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-sm">
              <UserCheck className="w-3.5 h-3.5 animate-pulse" />
              {completedCount} / {STAGES.length} Steps Completed
            </span>
          </div>
        </div>

        {/* Workspace Panels */}
        <div className="flex-1 flex overflow-hidden min-h-0 gap-6">
          
          {/* Left panel: Pipeline Stepper */}
          <div className="w-[35%] overflow-y-auto border-r border-border pr-4 space-y-2 text-left">
            <h5 className="text-xs font-extrabold uppercase tracking-widest text-muted-foreground/80 mb-3 ml-1">
              Interview Stages
            </h5>
            <div className="relative border-l border-border pl-4 ml-3.5 space-y-4 py-2">
              {STAGES.map((stage) => {
                const stepEval = evaluations[stage];
                const isSelected = selectedStage === stage;
                const isCompleted = !!stepEval?.completed;
                const hasFeedback = stepEval && (stepEval.comments || (stepEval.ratingCommunication || 0) > 0 || (stepEval.ratingTechnical || 0) > 0);

                return (
                  <button
                    key={stage}
                    type="button"
                    onClick={() => setSelectedStage(stage)}
                    className={`w-full relative flex items-start text-left p-2.5 rounded-xl border transition-all cursor-pointer ${
                      isSelected 
                        ? 'bg-primary/10 border-primary/30 ring-1 ring-primary/20 text-foreground' 
                        : 'bg-background hover:bg-muted/30 border-transparent text-muted-foreground'
                    }`}
                  >
                    {/* Visual dot positioned on the left timeline line */}
                    <div className="absolute -left-[27px] top-4 z-10 flex items-center justify-center bg-card rounded-full p-0.5">
                      {isCompleted ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-500 fill-emerald-500/10 stroke-[2]" />
                      ) : isSelected ? (
                        <Circle className="w-5 h-5 text-primary fill-primary/10 stroke-[2.5]" />
                      ) : (
                        <Circle className="w-5 h-5 text-muted-foreground/30 stroke-[1.5]" />
                      )}
                    </div>

                    <div className="space-y-0.5 flex-1 min-w-0 pr-1">
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-bold leading-none ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                          {STAGE_LABELS[stage]}
                        </span>
                        {isCompleted && (
                          <span className="text-[9px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-1.5 py-0.5 rounded leading-none">
                            Done
                          </span>
                        )}
                      </div>
                      
                      {/* Short summary of rating/eval if completed/evaluated */}
                      {hasFeedback ? (
                        <div className="flex items-center gap-2 mt-1.5">
                          {((stepEval.ratingTechnical || 0) > 0 || (stepEval.ratingCommunication || 0) > 0) && (
                            <div className="flex items-center text-[10px] text-amber-500 font-bold bg-amber-500/5 border border-amber-500/10 rounded px-1 flex-shrink-0">
                              <Star className="w-2.5 h-2.5 fill-amber-500 stroke-amber-500 mr-0.5" />
                              {Math.round(((stepEval.ratingTechnical || 0) + (stepEval.ratingCommunication || 0)) / 2)}.0
                            </div>
                          )}
                          {stepEval.comments && (
                            <span className="text-[10px] text-muted-foreground truncate leading-normal">
                              {stepEval.comments}
                            </span>
                          )}
                        </div>
                      ) : (
                        <p className="text-[10px] text-muted-foreground/60 italic leading-none pt-0.5">No evaluation yet</p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right panel: Evaluation Details Form */}
          <div className="flex-1 overflow-y-auto px-1 flex flex-col justify-between">
            <div className="space-y-6">
              {/* Header inside Form */}
              <div className="flex items-center justify-between border-b border-border pb-3 text-left">
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-primary font-mono">
                    Evaluation Details
                  </span>
                  <h4 className="text-md font-bold text-foreground mt-0.5">
                    {STAGE_LABELS[selectedStage]}
                  </h4>
                </div>

                {/* Custom Sleek Completed Toggle */}
                <button
                  type="button"
                  onClick={() => handleFieldChange('completed', !currentEval.completed)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold tracking-tight cursor-pointer transition-all ${
                    currentEval.completed
                      ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30 shadow-sm'
                      : 'bg-background hover:bg-muted/50 border-border text-muted-foreground'
                  }`}
                >
                  <CheckCircle2 className={`w-4 h-4 transition-all ${currentEval.completed ? 'fill-emerald-500 text-white' : 'stroke-[1.5]'}`} />
                  {currentEval.completed ? 'Stage Completed' : 'Mark as Completed'}
                </button>
              </div>

              {/* Ratings grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-muted/10 border border-border p-4 rounded-xl">
                <StarRatingSelector
                  label="Communication Skills"
                  rating={currentEval.ratingCommunication || 0}
                  onChange={(val) => handleFieldChange('ratingCommunication', val)}
                />
                
                <StarRatingSelector
                  label="Technical Skills"
                  rating={currentEval.ratingTechnical || 0}
                  onChange={(val) => handleFieldChange('ratingTechnical', val)}
                />
              </div>

              {/* Comments Textarea */}
              <div className="space-y-1.5 text-left">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-primary" />
                  Performance Comments
                </label>
                <textarea
                  rows={4}
                  placeholder={`Write candidate interview performance notes for the ${STAGE_LABELS[selectedStage]} stage...`}
                  value={currentEval.comments || ''}
                  onChange={(e) => handleFieldChange('comments', e.target.value)}
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary leading-relaxed shadow-sm transition-all"
                />
              </div>

              {/* Tools & Experiences Textarea */}
              <div className="space-y-1.5 text-left">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Wrench className="w-3.5 h-3.5 text-primary" />
                  Tools & Technologies Experiences
                </label>
                <input
                  type="text"
                  placeholder="e.g., React, Node.js, AWS, Git, Docker"
                  value={currentEval.toolsExperiences || ''}
                  onChange={(e) => handleFieldChange('toolsExperiences', e.target.value)}
                  className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary shadow-sm transition-all font-medium text-foreground"
                />
              </div>
            </div>

            {/* Sub-form action button or save tips */}
            <div className="border-t border-border pt-4 mt-6 flex justify-end gap-3 shrink-0">
              <Button 
                variant="outline" 
                type="button" 
                onClick={onClose}
                className="px-4 py-2 cursor-pointer"
              >
                Close
              </Button>
              <Button 
                onClick={handleSave} 
                isLoading={updateMutation.isPending}
                className="bg-primary text-white font-bold flex items-center gap-1.5 px-5 py-2 shadow-md shadow-primary/10 cursor-pointer"
              >
                {updateMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    Save & Apply Evaluations
                  </>
                )}
              </Button>
            </div>

          </div>

        </div>
      </div>
    </Modal>
  );
};

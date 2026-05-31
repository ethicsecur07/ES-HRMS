import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  Layers,
  FileText,
  ExternalLink
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

  const { data: templateData } = useQuery({
    queryKey: ['offerTemplate'],
    queryFn: recruitmentApi.getDefaultTemplate,
    enabled: isOpen && !!candidate
  });

  const roundsNeeded: RecruitmentStage[] = templateData?.template?.roundsNeeded || STAGES;
  
  // Local state to store evaluations array temporarily before saving
  const [evaluations, setEvaluations] = useState<Record<RecruitmentStage, StageEvaluation>>({
    NEW: { stage: 'NEW', completed: false, comments: '', ratingCommunication: 0, ratingTechnical: 0, toolsExperiences: '', documentVerified: false },
    SCREENING: { stage: 'SCREENING', completed: false, comments: '', ratingCommunication: 0, ratingTechnical: 0, toolsExperiences: '', documentVerified: false },
    INTERVIEW: { stage: 'INTERVIEW', completed: false, comments: '', ratingCommunication: 0, ratingTechnical: 0, toolsExperiences: '', documentVerified: false },
    TECHNICAL: { stage: 'TECHNICAL', completed: false, comments: '', ratingCommunication: 0, ratingTechnical: 0, toolsExperiences: '', documentVerified: false },
    HR: { stage: 'HR', completed: false, comments: '', ratingCommunication: 0, ratingTechnical: 0, toolsExperiences: '', documentVerified: false },
    OFFER: { stage: 'OFFER', completed: false, comments: '', ratingCommunication: 0, ratingTechnical: 0, toolsExperiences: '', documentVerified: false },
    HIRED: { stage: 'HIRED', completed: false, comments: '', ratingCommunication: 0, ratingTechnical: 0, toolsExperiences: '', documentVerified: false },
  });

  // Load candidate's evaluations when modal opens, candidate changes, or roundsNeeded changes
  useEffect(() => {
    if (candidate) {
      // Set the active selected stage to candidate's stage if active, else default to first active round
      if (roundsNeeded.includes(candidate.stage)) {
        setSelectedStage(candidate.stage);
      } else if (roundsNeeded.length > 0) {
        setSelectedStage(roundsNeeded[0]);
      }

      const initialEvaluations: Record<RecruitmentStage, StageEvaluation> = {
        NEW: { stage: 'NEW', completed: false, comments: '', ratingCommunication: 0, ratingTechnical: 0, toolsExperiences: '', documentVerified: false },
        SCREENING: { stage: 'SCREENING', completed: false, comments: '', ratingCommunication: 0, ratingTechnical: 0, toolsExperiences: '', documentVerified: false },
        INTERVIEW: { stage: 'INTERVIEW', completed: false, comments: '', ratingCommunication: 0, ratingTechnical: 0, toolsExperiences: '', documentVerified: false },
        TECHNICAL: { stage: 'TECHNICAL', completed: false, comments: '', ratingCommunication: 0, ratingTechnical: 0, toolsExperiences: '', documentVerified: false },
        HR: { stage: 'HR', completed: false, comments: '', ratingCommunication: 0, ratingTechnical: 0, toolsExperiences: '', documentVerified: false },
        OFFER: { stage: 'OFFER', completed: false, comments: '', ratingCommunication: 0, ratingTechnical: 0, toolsExperiences: '', documentVerified: false },
        HIRED: { stage: 'HIRED', completed: false, comments: '', ratingCommunication: 0, ratingTechnical: 0, toolsExperiences: '', documentVerified: false },
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
              completedAt: evalItem.completedAt || undefined,
              documentVerified: !!evalItem.documentVerified
            };
          }
        });
      }

      setEvaluations(initialEvaluations);
    }
  }, [candidate, isOpen, roundsNeeded]);

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
  const completedCount = Object.values(evaluations).filter(e => e.completed && roundsNeeded.includes(e.stage)).length;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Review & Performance Evaluation"
      maxWidth="max-w-4xl"
    >
      <div className="flex flex-col h-[70vh]">
        {/* Horizontal Stage Progress Tracker Bar */}
        <div className="shrink-0 flex items-center justify-between bg-muted/10 border border-border p-3.5 rounded-xl mb-4 text-xs font-bold select-none overflow-x-auto gap-2">
          {STAGES.map((stg, idx) => {
            const isCompleted = !!evaluations[stg]?.completed || (STAGES.indexOf(candidate.stage) > STAGES.indexOf(stg));
            const isCurrent = candidate.stage === stg;
            const isSelected = selectedStage === stg;
            
            let bgClass = 'bg-muted/30 border-border/50 text-muted-foreground';
            let dotClass = 'bg-muted-foreground/30';
            
            if (isCompleted) {
              bgClass = 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400';
              dotClass = 'bg-emerald-500';
            } else if (isCurrent) {
              bgClass = 'bg-primary/10 border-primary/30 text-primary';
              dotClass = 'bg-primary';
            }

            if (isSelected) {
              bgClass += ' ring-2 ring-primary/40 ring-offset-2 dark:ring-offset-card';
            }

            return (
              <React.Fragment key={stg}>
                <button
                  type="button"
                  onClick={() => roundsNeeded.includes(stg) && setSelectedStage(stg)}
                  disabled={!roundsNeeded.includes(stg)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${bgClass}`}
                  title={`${STAGE_LABELS[stg]}${!roundsNeeded.includes(stg) ? ' (Not in pipeline)' : ' - Click to review'}`}
                >
                  <span className={`w-2 h-2 rounded-full ${dotClass} ${isCurrent ? 'animate-pulse' : ''}`} />
                  <span>{STAGE_LABELS[stg]}</span>
                </button>

                {idx < STAGES.length - 1 && (
                  <span className="text-muted-foreground/30 font-light text-sm select-none font-mono">
                    ➔
                  </span>
                )}
              </React.Fragment>
            );
          })}
        </div>

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
              {completedCount} / {roundsNeeded.length} Steps Completed
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
              {roundsNeeded.map((stage) => {
                const stepEval = evaluations[stage];
                const isSelected = selectedStage === stage;
                const isRequired = roundsNeeded.includes(stage);
                const isCompleted = isRequired && !!stepEval?.completed;
                const hasFeedback = isRequired && stepEval && (stepEval.comments || (stepEval.ratingCommunication || 0) > 0 || (stepEval.ratingTechnical || 0) > 0);

                return (
                  <button
                    key={stage}
                    type="button"
                    onClick={() => setSelectedStage(stage)}
                    className={`w-full relative flex items-start text-left p-2.5 rounded-xl border transition-all cursor-pointer ${
                      isSelected 
                        ? 'bg-primary/10 border-primary/30 ring-1 ring-primary/20 text-foreground' 
                        : isRequired
                        ? 'bg-background hover:bg-muted/30 border-transparent text-muted-foreground'
                        : 'bg-muted/10 opacity-55 border-dashed border-border/40 text-muted-foreground/45 hover:bg-muted/20'
                    }`}
                  >
                    {/* Visual dot positioned on the left timeline line */}
                    <div className="absolute -left-[27px] top-4 z-10 flex items-center justify-center bg-card rounded-full p-0.5">
                      {isCompleted ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-500 fill-emerald-500/10 stroke-[2]" />
                      ) : isSelected ? (
                        <Circle className="w-5 h-5 text-primary fill-primary/10 stroke-[2.5]" />
                      ) : (
                        <Circle className={`w-5 h-5 stroke-[1.5] ${isRequired ? 'text-muted-foreground/30' : 'text-muted-foreground/10'}`} />
                      )}
                    </div>

                    <div className="space-y-0.5 flex-1 min-w-0 pr-1">
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-bold leading-none ${isSelected ? 'text-primary' : isRequired ? 'text-foreground' : 'text-muted-foreground/50'}`}>
                          {STAGE_LABELS[stage]}
                        </span>
                        {!isRequired && (
                          <span className="text-[8px] font-extrabold bg-muted text-muted-foreground/55 border border-border px-1.5 py-0.5 rounded leading-none uppercase tracking-wider">
                            Skipped
                          </span>
                        )}
                        {isRequired && isCompleted && (
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

              {/* Conditional Ratings grid */}
              {selectedStage !== 'SCREENING' && (selectedStage === 'TECHNICAL' || selectedStage === 'HR' || selectedStage === 'INTERVIEW') && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-muted/10 border border-border p-4 rounded-xl">
                  {(selectedStage === 'HR' || selectedStage === 'INTERVIEW') && (
                    <StarRatingSelector
                      label="Communication Skills"
                      rating={currentEval.ratingCommunication || 0}
                      onChange={(val) => handleFieldChange('ratingCommunication', val)}
                    />
                  )}
                  
                  {(selectedStage === 'TECHNICAL' || selectedStage === 'INTERVIEW') && (
                    <StarRatingSelector
                      label="Technical Skills"
                      rating={currentEval.ratingTechnical || 0}
                      onChange={(val) => handleFieldChange('ratingTechnical', val)}
                    />
                  )}
                </div>
              )}

              {/* Conditional Comments/BG Notes Textarea */}
              {selectedStage === 'SCREENING' ? (
                <div className="space-y-5 text-left">
                  {/* Marksheet document verification banner */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 font-mono">
                      <FileText className="w-3.5 h-3.5 text-primary" />
                      Academic Marksheet Verification
                    </label>
                    {candidate.marksheetUrl ? (
                      <div className="p-4 rounded-xl border border-indigo-500/20 bg-indigo-500/5 hover:bg-indigo-500/10 hover:border-indigo-500/30 flex flex-col gap-3.5 shadow-sm transition-all duration-300">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-indigo-500/10 text-indigo-500 rounded-xl">
                              <FileText className="w-5 h-5" />
                            </div>
                            <div>
                              <h5 className="text-sm font-bold text-foreground tracking-tight">
                                Candidate's Marksheet Document
                              </h5>
                              <p className="text-xs text-muted-foreground/80 mt-0.5">
                                Uploaded and ready for educational screening and compliance check
                              </p>
                            </div>
                          </div>
                          <a
                            href={candidate.marksheetUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-500 hover:text-indigo-600 bg-indigo-500/10 hover:bg-indigo-500/20 px-4 py-2 rounded-xl border border-indigo-500/20 hover:border-indigo-500/30 shadow-sm cursor-pointer transition-all duration-200"
                          >
                            <ExternalLink className="w-3.5 h-3.5" /> View Marksheet
                          </a>
                        </div>
                        
                        {/* Checkbox to confirm document verification */}
                        <div className="pt-3 border-t border-indigo-500/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                          <label className="flex items-center gap-2.5 text-xs font-bold text-foreground cursor-pointer select-none group">
                            <input
                              type="checkbox"
                              checked={!!currentEval.documentVerified}
                              onChange={(e) => handleFieldChange('documentVerified', e.target.checked)}
                              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-indigo-500/30 bg-background cursor-pointer accent-indigo-500"
                            />
                            <span className="group-hover:text-indigo-600 transition-colors">
                              I confirm that I have viewed and verified this candidate's marksheet document
                            </span>
                          </label>
                          {currentEval.documentVerified && (
                            <span className="text-[10px] font-extrabold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-2.5 py-1 rounded-full uppercase tracking-wider flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 fill-emerald-500/10" /> Document Verified
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 rounded-xl border border-dashed border-border/80 bg-muted/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm text-left">
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 bg-muted/40 text-muted-foreground/60 rounded-xl">
                            <FileText className="w-5 h-5" />
                          </div>
                          <div>
                            <h5 className="text-sm font-bold text-muted-foreground/90 tracking-tight">
                              No Marksheet URL Attached
                            </h5>
                            <p className="text-xs text-muted-foreground/60 mt-0.5">
                              No marksheet document has been submitted or uploaded for this candidate yet.
                            </p>
                          </div>
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50 border border-border/50 bg-background/50 px-2.5 py-1 rounded-lg">
                          Pending Upload
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 font-mono">
                      <UserCheck className="w-3.5 h-3.5 text-primary animate-pulse" />
                      Background Verification & Screening Notes
                    </label>
                    <textarea
                      rows={6}
                      placeholder="Enter background verification details, references check feedback, and screening compliance notes..."
                      value={currentEval.comments || ''}
                      onChange={(e) => handleFieldChange('comments', e.target.value)}
                      className="w-full bg-background border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary leading-relaxed shadow-sm transition-all"
                    />
                  </div>
                </div>
              ) : (
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
              )}

              {/* Conditional Tools & Experiences input */}
              {selectedStage !== 'SCREENING' && selectedStage !== 'HR' && selectedStage !== 'OFFER' && selectedStage !== 'HIRED' && selectedStage !== 'NEW' && (
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
              )}
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

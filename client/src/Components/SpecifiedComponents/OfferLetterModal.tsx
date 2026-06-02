import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { recruitmentApi } from '../../api_service/recruitmentApi';
import type { Candidate } from '../../types';
import { useNotificationStore } from '../../store/useNotificationStore';
import ESLogo from '../../assets/ES_Logo.png';
import ESSign from '../../assets/ES_Sign.png';
import { Button } from '../WrapperComponents/Button';
import axiosInstance from '../../api_service/axiosInstance';

import { 
  X, 
  Mail, 
  Phone, 
  Globe, 
  Send, 
  Edit3, 
  FileText,
  Eye,
  Save,
  Loader2,
  Upload
} from 'lucide-react';

interface OfferLetterModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidate: Candidate | null;
}

export const OfferLetterModal: React.FC<OfferLetterModalProps> = ({ isOpen, onClose, candidate }) => {
  const { addToast } = useNotificationStore();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');
  const [isEditingTemplate, setIsEditingTemplate] = useState(false);
  const [useCustomPdf, setUseCustomPdf] = useState(false);
  const [customPdfUrl, setCustomPdfUrl] = useState('');
  const [customPdfName, setCustomPdfName] = useState('');
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);
  const [customPdfBase64, setCustomPdfBase64] = useState('');
  const [offerType, setOfferType] = useState<'FULL_TIME' | 'INTERN_6M'>('INTERN_6M');

  // Store both the editable copy and the raw template body loaded from DB
  const [rawTemplateBody, setRawTemplateBody] = useState('');
  const [rawTemplateSubject, setRawTemplateSubject] = useState('');
  const [rawTemplateEmailBody, setRawTemplateEmailBody] = useState('');
  const [rawTemplatePdfSubject, setRawTemplatePdfSubject] = useState('');
  const [rawTemplatePdfTitle, setRawTemplatePdfTitle] = useState('');

  const calculateEndDate = (start: string, dur: string) => {
    try {
      const match = dur.match(/(\d+)\s*month/i);
      const months = match ? parseInt(match[1]) : 3;
      const d = new Date(start);
      d.setMonth(d.getMonth() + months);
      return d.toISOString().split('T')[0];
    } catch {
      return new Date(Date.now() + 97 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    }
  };

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    candidateName: '',
    address: 'Door no: 1/5-9-1 Thanda main road\nmarriyappan (ST), Kolathur (PO),\nMettur (TK), Salem (DT) - 636303',
    appliedRole: '',
    duration: '3 months',
    startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date(Date.now() + (7 + 90) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    stipendDetails: 'non-stipend',
    technologies: 'MongoDB, Express.js, React.js, and Node.js',
    pdfTitle: 'Internship Offer Letter',
    pdfSubject: 'Subject: Intern Offer letter- {{appliedRole}}',
    emailSubject: 'Intern Offer letter- {{appliedRole}}',
    emailBody: '',
    footerPhone: '755028487',
    footerEmail: 'info@ethicsecur.com',
    footerWebsite: 'www.ethicsecur.com',
    footerAddress: '2nd floor , nv arcade building, near 5 roads, next to reliance mall, salem-636004',
    signatoryName: 'ES EthicSecur SofTec Private Limited',
    signatoryTitle: 'HR Department',
    bodyText: '',
    customPdfUrl: '',
    customPdfBase64: '',
    customPdfName: '',
    salaryOffered: 0
  });

  // 1. Fetch persistent Offer Template from MongoDB
  const { data: templateData, isLoading: isTemplateLoading } = useQuery({
    queryKey: ['offerTemplate'],
    queryFn: recruitmentApi.getDefaultTemplate,
    enabled: isOpen && !!candidate
  });

  // Helper function to replace place holders dynamically
  const replacePlaceholders = (templateText: string, dataState = formData) => {
    if (!templateText) return '';
    try {
      const formattedStart = dataState.startDate ? new Date(dataState.startDate).toLocaleDateString('en-GB') : '';
      const formattedEnd = dataState.endDate ? new Date(dataState.endDate).toLocaleDateString('en-GB') : '';
      return templateText
        .replace(/\{\{candidateName\}\}/g, dataState.candidateName || '')
        .replace(/\{\{appliedRole\}\}/g, dataState.appliedRole || '')
        .replace(/\{\{duration\}\}/g, dataState.duration || '')
        .replace(/\{\{startDate\}\}/g, formattedStart)
        .replace(/\{\{endDate\}\}/g, formattedEnd)
        .replace(/\{\{stipendDetails\}\}/g, dataState.stipendDetails || '')
        .replace(/\{\{technologies\}\}/g, dataState.technologies || '');
    } catch {
      return templateText;
    }
  };

  // Auto-detect default Offer Type based on candidate's appliedRole
  useEffect(() => {
    if (candidate) {
      const isIntern = candidate.appliedRole?.toLowerCase().includes('intern');
      setOfferType(isIntern ? 'INTERN_6M' : 'FULL_TIME');
    }
  }, [candidate]);

  // Pre-populate form data when candidate, templateData, or offerType changes
  useEffect(() => {
    if (candidate && templateData?.template) {
      const name = `${candidate.firstName} ${candidate.lastName}`;
      const t = templateData.template;
      const roleName = candidate.appliedRole;
      const salary = candidate.offerDetails?.salaryOffered || 0;
      
      const start = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      let durationVal = '6 months';
      let stipendVal = 'unpaid first 3 months, then paid based on performance';
      let pdfTitleVal = 'Internship Offer Letter';
      let pdfSubjectVal = 'Subject: Intern Offer letter- {{appliedRole}}';
      let emailSubjectVal = 'Internship Offer letter- {{appliedRole}}';
      let emailBodyVal = `Dear {{candidateName}},\n\nWe are pleased to extend a formal offer for a 6-Month Internship at ES EthicSecur SofTec Pvt Ltd. Please find the attached PDF containing details of your internship terms, starting date, and unpaid/paid structure.\n\nTo accept this offer, please sign the letter and return it by replying to this email.`;
      
      let bodyTextVal = `We are pleased to offer you an opportunity to join ES EthicSecur SofTec Pvt Ltd., as an Intern for a period of {{duration}} (6 months total) from {{startDate}} to {{endDate}}.\n\nYour internship will follow our 6-month timeline structure:\n- Unpaid Phase (Months 1-3): Focuses on practical skill development, technical training, and department task execution. No stipend or monetary allowance is paid.\n- Paid Phase (Months 4-6): Transition is performance-based. Upon successful HR evaluation and approval at month 3, you will receive a monthly stipend of {{stipendDetails}}.\n\nThis internship does not guarantee permanent employment. You must follow company hours, code of conduct, and disciplinary policies at all times.`;

      if (offerType === 'FULL_TIME') {
        durationVal = 'Permanent';
        stipendVal = salary > 0 ? `Rs. ${salary.toLocaleString('en-IN')}` : 'competitive market salary';
        pdfTitleVal = 'Offer of Employment';
        pdfSubjectVal = 'Subject: Offer of Employment - {{appliedRole}}';
        emailSubjectVal = 'Job Offer: {{appliedRole}} - ES EthicSecur SofTec';
        emailBodyVal = `Dear {{candidateName}},\n\nWe are pleased to extend a formal offer of employment for the position of {{appliedRole}} at ES EthicSecur SofTec Pvt Ltd. Please find the attached PDF containing details of your employment terms, base salary, and joining date.\n\nTo accept this offer, please sign the letter and return it by replying to this email.`;
        
        bodyTextVal = `We are pleased to extend a formal offer of employment to you for the position of {{appliedRole}} at ES EthicSecur SofTec Pvt Ltd. Your employment will commence on {{startDate}}.\n\nYou will receive a monthly base salary of {{stipendDetails}} payable in monthly installments, subject to standard taxes and deductions. Your salary details and CTC breakup are managed securely in the HRMS.\n\nThis offer is contingent upon successful reference checks and background verification. You are required to follow all company regulations, office hours, and code of professional conduct.\n\nPlease sign and return the duplicate copy of this letter as a token of your acceptance of this offer.`;
      }

      setRawTemplateBody(bodyTextVal);
      setRawTemplateSubject(emailSubjectVal);
      setRawTemplateEmailBody(emailBodyVal);
      setRawTemplatePdfSubject(pdfSubjectVal);
      setRawTemplatePdfTitle(pdfTitleVal);

      const end = calculateEndDate(start, durationVal);

      const initialForm = {
        date: new Date().toISOString().split('T')[0],
        candidateName: name,
        address: candidate.notes || 'Door no: 1/5-9-1 Thanda main road\nmarriyappan (ST), Kolathur (PO),\nMettur (TK), Salem (DT) - 636303',
        appliedRole: candidate.appliedRole,
        duration: durationVal,
        startDate: start,
        endDate: end,
        stipendDetails: stipendVal,
        technologies: t.technologies || 'MongoDB, Express.js, React.js, and Node.js',
        pdfTitle: pdfTitleVal,
        pdfSubject: '',
        emailSubject: '',
        emailBody: '',
        footerPhone: t.footerPhone || '755028487',
        footerEmail: t.footerEmail || 'info@ethicsecur.com',
        footerWebsite: t.footerWebsite || 'www.ethicsecur.com',
        footerAddress: t.footerAddress || '2nd floor , nv arcade building, near 5 roads, next to reliance mall, salem-636004',
        signatoryName: t.signatoryName || 'ES EthicSecur SofTec Private Limited',
        signatoryTitle: t.signatoryTitle || 'HR Department',
        bodyText: '',
        customPdfUrl: '',
        customPdfBase64: '',
        customPdfName: '',
        salaryOffered: salary
      };

      initialForm.bodyText = replacePlaceholders(bodyTextVal, initialForm);
      initialForm.pdfSubject = replacePlaceholders(pdfSubjectVal, initialForm);
      initialForm.emailSubject = replacePlaceholders(emailSubjectVal, initialForm);
      initialForm.emailBody = replacePlaceholders(emailBodyVal, initialForm);
      setFormData(initialForm);
    }
  }, [candidate, templateData, offerType]);

  // 2. Mutation to send the final generated PDF offer letter via email
  const sendOfferMutation = useMutation({
    mutationFn: (data: typeof formData) => {
      if (!candidate) throw new Error('No candidate selected');
      return recruitmentApi.sendOffer(candidate._id, data);
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['candidates'] });
      if (data?.warning) {
        addToast(
          'Offer Generated (Email Error)',
          'The offer letter PDF was generated and uploaded successfully, but email delivery failed. You can view/download the PDF directly from the candidate card.',
          'warning'
        );
      } else {
        addToast('Offer Sent Successfully', `PDF offer letter has been dispatched to ${candidate?.email} using Microsoft OAuth2.`, 'success');
      }
      onClose();
    },
    onError: (error: any) => {
      addToast('Dispatch Failed', error?.response?.data?.message || error.message || 'Could not send offer letter.', 'error');
    }
  });

  // 3. Mutation to save the template settings/text back to the DB as default
  const saveTemplateMutation = useMutation({
    mutationFn: () => {
      return recruitmentApi.updateDefaultTemplate({
        bodyText: rawTemplateBody,
        subject: rawTemplateSubject,
        emailBody: rawTemplateEmailBody,
        pdfTitle: rawTemplatePdfTitle,
        pdfSubject: rawTemplatePdfSubject,
        footerPhone: formData.footerPhone,
        footerEmail: formData.footerEmail,
        footerWebsite: formData.footerWebsite,
        footerAddress: formData.footerAddress,
        signatoryName: formData.signatoryName,
        signatoryTitle: formData.signatoryTitle,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['offerTemplate'] });
      addToast('Template Saved', 'Offer letter template and configurations saved to database.', 'success');
      setIsEditingTemplate(false);
    },
    onError: (error: any) => {
      addToast('Save Failed', error?.response?.data?.message || error.message || 'Could not save template settings.', 'error');
    }
  });

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      addToast('Invalid File Type', 'Please upload a valid PDF document.', 'error');
      return;
    }

    setIsUploadingPdf(true);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const base64String = (reader.result as string).split(',')[1];
        setCustomPdfBase64(base64String);
        setCustomPdfName(file.name);
        setFormData(prev => ({ 
          ...prev, 
          customPdfBase64: base64String,
          customPdfName: file.name
        }));
        addToast('File Loaded', `Custom PDF "${file.name}" loaded successfully!`, 'success');
      } catch (err: any) {
        addToast('Read Failed', 'Could not read PDF file.', 'error');
      } finally {
        setIsUploadingPdf(false);
      }
    };
    reader.onerror = () => {
      addToast('Read Failed', 'Could not read PDF file.', 'error');
      setIsUploadingPdf(false);
    };
    reader.readAsDataURL(file);
  };

  if (!isOpen || !candidate) return null;

  const handleTextChange = (field: string, value: string) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };
      
      // Auto-recalculate endDate if startDate or duration changes
      if (field === 'startDate' || field === 'duration') {
        updated.endDate = calculateEndDate(updated.startDate, updated.duration);
      }

      // Auto-update the bodies copy if core parameters are edited, unless HR has modified the body copy manually
      if (!isEditingTemplate && (field === 'appliedRole' || field === 'duration' || field === 'startDate' || field === 'endDate' || field === 'stipendDetails' || field === 'technologies' || field === 'candidateName')) {
        updated.bodyText = replacePlaceholders(rawTemplateBody, updated);
        updated.pdfSubject = replacePlaceholders(rawTemplatePdfSubject, updated);
        updated.emailSubject = replacePlaceholders(rawTemplateSubject, updated);
        updated.emailBody = replacePlaceholders(rawTemplateEmailBody, updated);
      }
      return updated;
    });
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    sendOfferMutation.mutate(formData);
  };

  const formattedDate = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return new Date(dateStr).toLocaleDateString('en-GB');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-card border border-border w-full max-w-5xl rounded-2xl shadow-2xl flex flex-col h-[90vh] animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div>
            <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Prepare Branded PDF Offer Letter
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Customize candidate parameters, preview the visual letter, and email secure PDF using Microsoft Graph SMTP OAuth2
            </p>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switcher for mobile/split view toggle */}
        <div className="flex border-b border-border px-6 py-2 bg-muted/20 md:hidden shrink-0">
          <button
            onClick={() => setActiveTab('edit')}
            className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-lg flex items-center justify-center gap-1.5 ${
              activeTab === 'edit' ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            <Edit3 className="w-3.5 h-3.5" /> Edit Template
          </button>
          <button
            onClick={() => setActiveTab('preview')}
            className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-lg flex items-center justify-center gap-1.5 ${
              activeTab === 'preview' ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            <Eye className="w-3.5 h-3.5" /> Live Preview
          </button>
        </div>

        {/* Content Container (Two column layout on desktop) */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          
          {/* LEFT: Editor Panel */}
          <div className={`w-full md:w-[45%] flex flex-col border-r border-border min-h-0 bg-background ${
            activeTab === 'edit' ? 'block' : 'hidden md:block'
          }`}>
            <form onSubmit={handleSend} className="flex-1 flex flex-col min-h-0">
              <div className="flex-1 overflow-y-auto p-6 space-y-4 text-left">
                
                {isTemplateLoading ? (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                    <Loader2 className="w-8 h-8 text-primary animate-spin mb-3" />
                    <p className="text-xs font-semibold uppercase tracking-wider">Loading Database Template...</p>
                  </div>
                ) : (
                  <>
                    {candidate?.offerDetails?.offerLetterUrl && (
                      <div className="bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 rounded-xl p-3.5 mb-4 flex items-start gap-2.5 text-xs font-semibold">
                        <span className="text-sm">⚠️</span>
                        <div>
                          <p className="font-bold">Offer Letter Already Sent</p>
                          <p className="text-[10px] text-amber-700/80 dark:text-amber-400/80 mt-0.5 leading-normal">
                            An offer letter has already been sent to this candidate. You may customize parameters and send it again if terms have changed.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Mode Toggle */}
                    <div className="flex border border-border rounded-xl p-1 bg-muted/20 shrink-0 mb-4">
                      <button
                        type="button"
                        onClick={() => setUseCustomPdf(false)}
                        className={`flex-1 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                          !useCustomPdf ? 'bg-primary text-white shadow' : 'text-muted-foreground hover:bg-muted'
                        }`}
                      >
                        📝 Generate Branded PDF
                      </button>
                      <button
                        type="button"
                        onClick={() => setUseCustomPdf(true)}
                        className={`flex-1 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                          useCustomPdf ? 'bg-primary text-white shadow' : 'text-muted-foreground hover:bg-muted'
                        }`}
                      >
                        📤 Upload Custom PDF
                      </button>
                    </div>

                    {useCustomPdf && (
                      <div className="bg-primary/5 border border-dashed border-primary/30 rounded-2xl p-6 text-center space-y-3 mb-4">
                        <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                          <Upload className="w-6 h-6" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-foreground">Upload Custom Offer Letter PDF</p>
                          <p className="text-xs text-muted-foreground mt-0.5">Drag & drop or click to upload a PDF (Max 10MB)</p>
                        </div>
                        <input
                          type="file"
                          accept="application/pdf"
                          onChange={handlePdfUpload}
                          className="hidden"
                          id="custom-pdf-upload"
                          disabled={isUploadingPdf}
                        />
                        <label
                          htmlFor="custom-pdf-upload"
                          className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-xl text-xs font-bold cursor-pointer hover:bg-primary-hover shadow-md transition-colors"
                        >
                          {isUploadingPdf ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading...
                            </>
                          ) : (
                            <>Select PDF Document</>
                          )}
                        </label>

                        {customPdfName && (
                          <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-xl px-3 py-2 text-xs font-semibold flex items-center justify-between mt-3">
                            <span className="truncate max-w-[80%]">📄 {customPdfName}</span>
                            <button
                              type="button"
                              onClick={() => {
                                setCustomPdfName('');
                                setCustomPdfUrl('');
                                setFormData(prev => ({ ...prev, customPdfUrl: '' }));
                              }}
                              className="text-emerald-500 hover:text-red-500 font-bold ml-2 shrink-0 cursor-pointer"
                            >
                              Remove
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex items-center justify-between border-b border-primary/20 pb-1.5">
                      <h4 className="text-xs font-extrabold uppercase tracking-wider text-primary">
                        1. Candidate Details
                      </h4>
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditingTemplate(!isEditingTemplate);
                          if (!isEditingTemplate) {
                            // Pre-fill body copy with raw template texts so HR can edit placeholders raw
                            setFormData(prev => ({ 
                              ...prev, 
                              bodyText: rawTemplateBody,
                              pdfTitle: rawTemplatePdfTitle,
                              pdfSubject: rawTemplatePdfSubject,
                              emailSubject: rawTemplateSubject,
                              emailBody: rawTemplateEmailBody
                            }));
                          } else {
                            // Return back to dynamic variable representation
                            setFormData(prev => ({ 
                              ...prev, 
                              bodyText: replacePlaceholders(rawTemplateBody, prev),
                              pdfSubject: replacePlaceholders(rawTemplatePdfSubject, prev),
                              emailSubject: replacePlaceholders(rawTemplateSubject, prev),
                              emailBody: replacePlaceholders(rawTemplateEmailBody, prev)
                            }));
                          }
                        }}
                        className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                          isEditingTemplate 
                            ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' 
                            : 'bg-primary/10 text-primary border-primary/20 hover:bg-primary/20'
                        }`}
                        title={isEditingTemplate ? "Switch back to Candidate view" : "Edit template placeholders (e.g. {{candidateName}})"}
                      >
                        {isEditingTemplate ? "✍ Back to Candidate Mode" : "⚙ Edit Raw Template"}
                      </button>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-xs font-bold text-muted-foreground mb-1">Employment / Offer Type</label>
                      <select 
                        value={offerType}
                        onChange={(e) => setOfferType(e.target.value as any)}
                        className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary font-semibold"
                      >
                        <option value="FULL_TIME">💼 Full-time with Salary</option>
                        <option value="INTERN_6M">🎓 6-Month Internship (3m Unpaid + 3m Performance-based Paid)</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-muted-foreground mb-1">Candidate Name</label>
                        <input 
                          type="text" 
                          value={formData.candidateName}
                          onChange={(e) => handleTextChange('candidateName', e.target.value)}
                          className="w-full bg-muted/30 border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary font-semibold"
                          required
                          disabled={isEditingTemplate}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-muted-foreground mb-1">Offer Date</label>
                        <input 
                          type="date" 
                          value={formData.date}
                          onChange={(e) => handleTextChange('date', e.target.value)}
                          className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-muted-foreground mb-1">Candidate Address</label>
                      <textarea 
                        rows={3}
                        value={formData.address}
                        onChange={(e) => handleTextChange('address', e.target.value)}
                        className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary font-mono leading-normal text-xs"
                        required
                        disabled={isEditingTemplate}
                      />
                    </div>

                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-primary border-b border-primary/20 pb-1.5 pt-2">
                      2. Position & Terms
                    </h4>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-muted-foreground mb-1">Role / Position</label>
                        <input 
                          type="text" 
                          value={formData.appliedRole}
                          onChange={(e) => handleTextChange('appliedRole', e.target.value)}
                          className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary font-semibold"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-muted-foreground mb-1">Duration</label>
                        <input 
                          type="text" 
                          value={formData.duration}
                          onChange={(e) => handleTextChange('duration', e.target.value)}
                          className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-muted-foreground mb-1">Start Date</label>
                        <input 
                          type="date" 
                          value={formData.startDate}
                          onChange={(e) => handleTextChange('startDate', e.target.value)}
                          className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-muted-foreground mb-1">End Date</label>
                        <input 
                          type="date" 
                          value={formData.endDate}
                          onChange={(e) => handleTextChange('endDate', e.target.value)}
                          className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-muted-foreground mb-1">Stipend / Salary Type</label>
                        <input 
                          type="text" 
                          value={formData.stipendDetails}
                          onChange={(e) => handleTextChange('stipendDetails', e.target.value)}
                          className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-muted-foreground mb-1">
                          {offerType === 'FULL_TIME' ? 'Base Salary Offered (INR)' : 'Monthly Stipend Offered (Paid Phase) (INR)'}
                        </label>
                        <input 
                          type="number" 
                          value={formData.salaryOffered}
                          onChange={(e) => handleTextChange('salaryOffered', e.target.value)}
                          className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                          placeholder="e.g. 15000"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-muted-foreground mb-1">Technologies Used</label>
                      <input 
                        type="text" 
                        value={formData.technologies}
                        onChange={(e) => handleTextChange('technologies', e.target.value)}
                        className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                        required
                      />
                    </div>

                    {!useCustomPdf && (
                      <>
                        <h4 className="text-xs font-extrabold uppercase tracking-wider text-primary border-b border-primary/20 pb-1.5 pt-2">
                          3. Branded PDF Copy
                        </h4>

                        <div>
                          <label className="block text-xs font-bold text-muted-foreground mb-1">PDF Title (Header)</label>
                          <input 
                            type="text" 
                            value={isEditingTemplate ? rawTemplatePdfTitle : formData.pdfTitle}
                            onChange={(e) => {
                              if (isEditingTemplate) {
                                setRawTemplatePdfTitle(e.target.value);
                              } else {
                                handleTextChange('pdfTitle', e.target.value);
                              }
                            }}
                            className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary font-bold"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-muted-foreground mb-1">PDF Subject Line</label>
                          <input 
                            type="text" 
                            value={isEditingTemplate ? rawTemplatePdfSubject : formData.pdfSubject}
                            onChange={(e) => {
                              if (isEditingTemplate) {
                                setRawTemplatePdfSubject(e.target.value);
                              } else {
                                handleTextChange('pdfSubject', e.target.value);
                              }
                            }}
                            className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary font-semibold"
                            required
                          />
                        </div>

                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <label className="text-xs font-bold text-muted-foreground">
                              {isEditingTemplate ? "PDF Template Body (with Placeholders)" : "Edit PDF Body Text"}
                            </label>
                            {isEditingTemplate && (
                              <span className="text-[10px] text-amber-500 font-mono italic">
                                Supports variables: {"{{candidateName}}"}, {"{{appliedRole}}"}, etc.
                              </span>
                            )}
                          </div>
                          <textarea 
                            rows={6}
                            value={isEditingTemplate ? rawTemplateBody : formData.bodyText}
                            onChange={(e) => {
                              if (isEditingTemplate) {
                                setRawTemplateBody(e.target.value);
                              } else {
                                handleTextChange('bodyText', e.target.value);
                              }
                            }}
                            className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary leading-normal text-xs"
                            required
                          />
                        </div>
                      </>
                    )}

                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-primary border-b border-primary/20 pb-1.5 pt-2">
                      4. Email Template Copy (Sent to Candidate)
                    </h4>

                    <div>
                      <label className="block text-xs font-bold text-muted-foreground mb-1">Email Subject Line</label>
                      <input 
                        type="text" 
                        value={isEditingTemplate ? rawTemplateSubject : formData.emailSubject}
                        onChange={(e) => {
                          if (isEditingTemplate) {
                            setRawTemplateSubject(e.target.value);
                          } else {
                            handleTextChange('emailSubject', e.target.value);
                          }
                        }}
                        className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary font-semibold"
                        required
                      />
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-xs font-bold text-muted-foreground">
                          {isEditingTemplate ? "Email Body Template (with Placeholders)" : "Edit Email Body Text"}
                        </label>
                      </div>
                      <textarea 
                        rows={5}
                        value={isEditingTemplate ? rawTemplateEmailBody : formData.emailBody}
                        onChange={(e) => {
                          if (isEditingTemplate) {
                            setRawTemplateEmailBody(e.target.value);
                          } else {
                            handleTextChange('emailBody', e.target.value);
                          }
                        }}
                        className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary leading-normal text-xs"
                        required
                      />
                    </div>

                    {!useCustomPdf && (
                      <>
                        <h4 className="text-xs font-extrabold uppercase tracking-wider text-primary border-b border-primary/20 pb-1.5 pt-2">
                          5. Signatory & Footers
                        </h4>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-bold text-muted-foreground mb-1">Signatory Title</label>
                            <input 
                              type="text" 
                              value={formData.signatoryTitle}
                              onChange={(e) => handleTextChange('signatoryTitle', e.target.value)}
                              className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary font-medium"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-muted-foreground mb-1">Signatory Company</label>
                            <input 
                              type="text" 
                              value={formData.signatoryName}
                              onChange={(e) => handleTextChange('signatoryName', e.target.value)}
                              className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                              required
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-bold text-muted-foreground mb-1">Footer Phone</label>
                            <input 
                              type="text" 
                              value={formData.footerPhone}
                              onChange={(e) => handleTextChange('footerPhone', e.target.value)}
                              className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-muted-foreground mb-1">Footer Email</label>
                            <input 
                              type="text" 
                              value={formData.footerEmail}
                              onChange={(e) => handleTextChange('footerEmail', e.target.value)}
                              className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-muted-foreground mb-1">Footer Website</label>
                          <input 
                            type="text" 
                            value={formData.footerWebsite}
                            onChange={(e) => handleTextChange('footerWebsite', e.target.value)}
                            className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-muted-foreground mb-1">Footer Office Address</label>
                          <textarea 
                            rows={2}
                            value={formData.footerAddress}
                            onChange={(e) => handleTextChange('footerAddress', e.target.value)}
                            className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary text-xs"
                          />
                        </div>
                      </>
                    )}
                  </>
                )}

              </div>

              {/* Actions Footer */}
              <div className="shrink-0 p-4 border-t border-border bg-card flex items-center justify-between gap-3">
                {isEditingTemplate ? (
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => saveTemplateMutation.mutate()}
                    isLoading={saveTemplateMutation.isPending}
                    className="border-primary text-primary flex items-center gap-1 hover:bg-primary/5"
                  >
                    <Save className="w-4 h-4" /> Save Template as Default
                  </Button>
                ) : (
                  <div />
                )}
                
                <div className="flex gap-3">
                  <Button variant="outline" type="button" onClick={onClose}>
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    isLoading={sendOfferMutation.isPending}
                    disabled={isEditingTemplate}
                    className="bg-primary text-white font-bold flex items-center gap-1.5 shadow-md shadow-primary/20"
                  >
                    <Send className="w-4 h-4" /> Send Offer Letter
                  </Button>
                </div>
              </div>
            </form>
          </div>

          {/* RIGHT: High-Fidelity Premium Page Live Preview */}
          <div className={`flex-1 flex flex-col bg-muted/40 overflow-y-auto p-8 justify-start items-center select-none ${
            activeTab === 'preview' ? 'block' : 'hidden md:flex'
          }`}>
            {useCustomPdf ? (
              <div className="w-[100%] max-w-[620px] bg-white text-slate-800 shadow-xl border border-slate-200 rounded-lg p-10 flex flex-col items-center justify-center text-center py-16 space-y-6 animate-in fade-in zoom-in-95 duration-200 text-left">
                <div className="w-20 h-20 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center animate-bounce">
                  <FileText className="w-10 h-10" />
                </div>
                <div>
                  <h4 className="text-lg font-bold text-slate-900">Custom PDF Offer Letter Active</h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
                    You have selected to deliver a custom uploaded PDF document directly to the candidate. The standard letter template generator will be bypassed.
                  </p>
                </div>

                {customPdfName ? (
                  <div className="bg-emerald-500/5 border border-emerald-500/20 text-emerald-500 rounded-2xl px-6 py-4 flex items-center gap-3 max-w-md w-full shadow-sm text-left">
                    <div className="p-2 rounded-xl bg-emerald-500/10 shrink-0">
                      <FileText className="w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-slate-900 truncate">{customPdfName}</div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">Uploaded & Secured</div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-amber-500/5 border border-amber-500/20 text-amber-500 rounded-2xl px-6 py-4 flex items-center gap-3 max-w-md w-full text-left font-semibold text-xs leading-normal">
                    ⚠️ Please select and upload a custom PDF document on the left panel to complete the dispatch.
                  </div>
                )}

                {/* Email visual preview block */}
                <div className="w-full border-t border-slate-100 pt-8 mt-4 text-left">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-4">
                    Visual Email Attachment Delivery Preview:
                  </span>
                  
                  <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm bg-slate-50">
                    <div className="bg-[#D35400] p-4 text-white">
                      <div className="text-xs font-bold">{formData.emailSubject || 'Intern Offer letter - dev'}</div>
                      <div className="text-[9px] opacity-80 mt-0.5">To: {candidate?.email}</div>
                    </div>
                    <div className="p-5 text-[10px] text-slate-600 leading-relaxed font-sans whitespace-pre-line bg-white max-h-[150px] overflow-y-auto">
                      {formData.emailBody || 'Dear Suseendra Kumar,\n\nWe are pleased to extend...'}
                    </div>
                    <div className="bg-slate-50 border-t border-slate-200 p-3 flex items-center gap-2.5">
                      <div className="p-1.5 rounded bg-red-500/10 text-red-500 shrink-0">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0 text-[9px] font-bold text-slate-700 truncate">
                        {customPdfName || 'Attached_Offer_Letter.pdf'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* The Branded A4 paper mock sheet container */
              <div className="w-[100%] max-w-[620px] min-h-[877px] bg-white text-slate-800 shadow-xl border border-slate-200 rounded-lg p-10 flex flex-col relative text-left mb-6 leading-relaxed select-text" style={{ fontSize: '12px' }}>
                
                {/* Colored diagonal gradient top header banner */}
                <div className="absolute top-0 right-0 left-0 h-1 bg-[#D35400] shrink-0" />
                
                {/* Header Grid */}
                <div className="flex justify-between items-start mb-10 shrink-0">
                  {/* Brand Logo Left */}
                  <div className="h-12 flex items-center">
                    <img src={ESLogo} alt="ES Logo" className="h-11 w-11 object-contain" />
                  </div>

                  {/* Right Trapezoid Slanted Colored Banner */}
                  <div className="relative h-10 w-52 shrink-0">
                    <div 
                      className="absolute inset-0 bg-[#D35400] flex items-center justify-end pr-5 text-white font-bold tracking-wide"
                      style={{ 
                        clipPath: 'polygon(15% 0%, 100% 0%, 100% 100%, 0% 100%)',
                        fontSize: '8.5px'
                      }}
                    >
                      ES EthicSecur SofTec Pvt Ltd
                    </div>
                    <div 
                      className="absolute top-0 bottom-0 left-3 w-1.5 bg-[#E74C3C]"
                      style={{ transform: 'skewX(-15deg)' }}
                    />
                  </div>
                </div>

                {/* Offer Title */}
                <div className="text-center font-extrabold text-[13.5px] uppercase tracking-wide text-slate-900 border-b border-slate-100 pb-3 mb-6 shrink-0">
                  {isEditingTemplate ? rawTemplatePdfTitle : (formData.pdfTitle || 'Internship Offer Letter')}
                </div>

                {/* Recipient Details & Date */}
                <div className="mb-5 space-y-3 shrink-0" style={{ fontSize: '10.5px' }}>
                  <div className="font-extrabold">DATE: {formattedDate(formData.date)}</div>
                  
                  <div className="space-y-0.5">
                    <div className="font-extrabold">TO,</div>
                    <div className="font-extrabold text-[11px] text-slate-900">{formData.candidateName || 'Candidate Name'}</div>
                    {candidate?.email && (
                      <div className="font-extrabold text-slate-900 text-[10.5px]">
                        Email: <span className="font-normal text-slate-600 font-sans">{candidate.email}</span>
                      </div>
                    )}
                    <div className="text-slate-500 whitespace-pre-line leading-tight font-mono text-[9px]">{formData.address}</div>
                  </div>
                </div>

                {/* PDF Subject Line (if provided) */}
                {(isEditingTemplate ? replacePlaceholders(rawTemplatePdfSubject) : formData.pdfSubject) && (
                  <div className="font-extrabold text-slate-900 mb-4 shrink-0 text-left" style={{ fontSize: '10.5px' }}>
                    {isEditingTemplate ? replacePlaceholders(rawTemplatePdfSubject) : formData.pdfSubject}
                  </div>
                )}

                {/* Salutation */}
                {/* Skip manual salutation if body text already starts with 'Dear' to prevent duplicate salutations */}
                {!((isEditingTemplate ? replacePlaceholders(rawTemplateBody) : formData.bodyText) || '').trim().toLowerCase().startsWith('dear') && (
                  <div className="font-extrabold text-slate-900 mb-3 shrink-0" style={{ fontSize: '10.5px' }}>
                    Dear {formData.candidateName || 'Candidate Name'},
                  </div>
                )}

                {/* Body text paragraphs */}
                <div className="space-y-3.5 text-slate-600 text-justify leading-relaxed font-sans text-[10.5px] pr-1 mb-6">
                  {(isEditingTemplate ? replacePlaceholders(rawTemplateBody) : formData.bodyText).split('\n\n').map((para, i) => (
                    <p key={i} className="whitespace-pre-line">
                      {para.trim()}
                    </p>
                  ))}
                </div>

                {/* Signatory & Candidate Sign sections */}
                <div className="mt-auto border-t border-slate-100 pt-6 shrink-0 relative flex justify-between items-start">
                  {/* Left side authorized signatory */}
                  <div className="w-1/2 flex flex-col">
                    <span className="font-extrabold text-slate-900 text-[9.5px]">Authorized Signatory</span>
                    
                    {/* Real signature image */}
                    <div className="h-16 flex items-center relative my-1 select-none">
                      <img src={ESSign} alt="Oviya Signature" className="h-14 object-contain select-none" />
                    </div>

                    <span className="text-[9px] font-semibold text-slate-500">{formData.signatoryTitle}</span>
                    <span className="text-[9.5px] font-extrabold text-slate-900">{formData.signatoryName}</span>
                  </div>

                  {/* Right side candidate signature line */}
                  <div className="w-1/2 flex flex-col items-end text-right">
                    <span className="font-extrabold text-slate-900 text-[9.5px]">CANDIDATE SIGNATURE</span>
                    <div className="h-12 border-b border-dashed border-slate-300 w-36 mt-2" />
                  </div>
                </div>

                {/* Branded Footer section */}
                <div className="mt-auto pt-6 shrink-0 flex flex-col items-center">
                  {/* Double Border Line */}
                  <div className="w-full flex flex-col gap-[1.5px] mb-3">
                    <div className="w-full h-[0.5px] bg-slate-300" />
                    <div className="w-full h-[1.2px] bg-[#E67E22]" />
                  </div>

                  {/* Contacts */}
                  <div className="flex items-center gap-4 text-slate-400 font-mono text-[8px] mb-1 leading-none">
                    <span className="flex items-center gap-1"><Phone className="w-2.5 h-2.5 text-[#E67E22]" /> {formData.footerPhone}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1"><Mail className="w-2.5 h-2.5 text-[#E67E22]" /> {formData.footerEmail}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1"><Globe className="w-2.5 h-2.5 text-[#E67E22]" /> {formData.footerWebsite}</span>
                  </div>

                  {/* Company & address */}
                  <span className="font-extrabold text-slate-700 text-[8.5px] mb-0.5 leading-none">ES EthicSecur SofTec Pvt Ltd</span>
                  <span className="text-slate-400 text-[7px] text-center font-mono leading-tight">{formData.footerAddress}</span>

                  {/* Bottom colored bar */}
                  <div className="w-full h-1 bg-[#D35400] rounded mt-3" />
                </div>

              </div>
            )}
            
            <p className="text-[10px] text-muted-foreground select-none italic">
              Live Interactive A4 Letterhead Preview (rendered content exactly matches the output PDF layout)
            </p>

          </div>

        </div>

      </div>
    </div>
  );
};

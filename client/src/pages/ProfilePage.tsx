import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../store/useAuthStore';
import { useNotificationStore } from '../store/useNotificationStore';
import { authApi } from '../api_service/authApi';
import { employeeApi } from '../api_service/employeeApi';
import { Card } from '../Components/WrapperComponents/Card';
import { Button } from '../Components/WrapperComponents/Button';
import { Input, Textarea } from '../Components/WrapperComponents/Input';
import { formatCurrency } from '../utils/formatters';
import { Camera, Loader2, Save, User as UserIcon, Mail, Shield, Briefcase, Calendar, HeartPulse, DollarSign, Award } from 'lucide-react';

export const ProfilePage: React.FC = () => {
  const { user, role, updateUser } = useAuthStore();
  const { addToast } = useNotificationStore();
  const queryClient = useQueryClient();

  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [ecName, setEcName] = useState('');
  const [ecRel, setEcRel] = useState('');
  const [ecPhone, setEcPhone] = useState('');

  const [isUploadingImg, setIsUploadingImg] = useState(false);

  // Fetch employee details if user has employeeId
  const { data: employeeData } = useQuery({
    queryKey: ['employeeProfile', user?.employeeId],
    queryFn: () => employeeApi.getById(user?.employeeId as string),
    enabled: !!user?.employeeId,
  });

  useEffect(() => {
    if (user?.name) setName(user.name);
    if (employeeData) {
      setPhone(employeeData.phone || '');
      setAddress(employeeData.address || '');
      if (employeeData.emergencyContact) {
        setEcName(employeeData.emergencyContact.name || '');
        setEcRel(employeeData.emergencyContact.relationship || '');
        setEcPhone(employeeData.emergencyContact.phone || '');
      }
      if (employeeData.profileImage && employeeData.profileImage !== user?.profileImage) {
        updateUser({ profileImage: employeeData.profileImage });
      }
    }
  }, [user, employeeData, updateUser]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingImg(true);
    try {
      const url = await authApi.uploadImage(file);
      await authApi.updateMe({ profileImage: url });
      updateUser({ profileImage: url });
      queryClient.invalidateQueries({ queryKey: ['employeeProfile', user?.employeeId] });
      addToast('Profile Image Updated', 'Your profile picture has been successfully updated via Cloudinary.', 'success');
    } catch (error: any) {
      addToast('Upload Failed', error.message || 'Could not upload image.', 'error');
    } finally {
      setIsUploadingImg(false);
    }
  };

  const updateProfileMutation = useMutation({
    mutationFn: async () => {
      const updatePayload: any = { name };
      if (user?.employeeId) {
        updatePayload.phone = phone;
        updatePayload.address = address;
        updatePayload.emergencyContact = {
          name: ecName,
          relationship: ecRel,
          phone: ecPhone,
        };
      }
      return authApi.updateMe(updatePayload);
    },
    onSuccess: (resData) => {
      updateUser({ name: resData.user.name });
      queryClient.invalidateQueries({ queryKey: ['employeeProfile', user?.employeeId] });
      addToast('Profile Updated', 'Your personal details have been saved successfully.', 'success');
    },
    onError: (error: any) => {
      addToast('Update Failed', error.message || 'Could not update profile details.', 'error');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfileMutation.mutate();
  };

  return (
    <div className="space-y-8 text-left animate-in fade-in duration-300 pb-12">
      {/* Top Banner / Header */}
      <div className="relative rounded-3xl bg-gradient-to-r from-primary/90 via-primary to-accent p-8 text-white shadow-xl overflow-hidden">
        <div className="absolute -right-10 -top-10 w-60 h-60 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -left-10 -bottom-10 w-60 h-60 bg-black/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
          {/* Profile Avatar Box */}
          <div className="relative group w-32 h-32 md:w-40 md:h-40 rounded-3xl bg-card border-4 border-white/20 shadow-2xl overflow-hidden flex-shrink-0 cursor-pointer">
            {user?.profileImage || employeeData?.profileImage ? (
              <img src={user?.profileImage || employeeData?.profileImage} alt={user?.name || 'Profile'} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-tr from-accent to-primary flex items-center justify-center text-white font-black text-5xl">
                {user?.name?.charAt(0) || 'U'}
              </div>
            )}
            <label className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer backdrop-blur-sm" title="Click to change profile image">
              <Camera className="w-8 h-8 text-white mb-1" />
              <span className="text-[10px] font-bold text-white uppercase tracking-wider bg-primary/80 px-2 py-0.5 rounded-full">Change Photo</span>
              <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
            </label>
            {isUploadingImg && (
              <div className="absolute inset-0 bg-black/75 flex flex-col items-center justify-center backdrop-blur-sm">
                <Loader2 className="w-8 h-8 text-white animate-spin mb-2" />
                <span className="text-xs font-bold text-white tracking-wider animate-pulse">Uploading...</span>
              </div>
            )}
          </div>

          <div className="space-y-2 text-center md:text-left flex-1">
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
              <h1 className="text-3xl md:text-4xl font-black tracking-tight drop-shadow-md">{user?.name}</h1>
              <span className="px-3.5 py-1 rounded-full bg-white/20 backdrop-blur-md text-xs font-black uppercase tracking-widest border border-white/30 shadow-inner">
                {role || 'EMPLOYEE'}
              </span>
            </div>
            <p className="text-white/90 text-sm md:text-base font-medium flex items-center justify-center md:justify-start gap-2">
              <Mail className="w-4 h-4 opacity-80" /> {user?.email}
            </p>
            {employeeData && (
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 pt-2 text-xs font-semibold text-white/90 border-t border-white/20 mt-3">
                <span className="flex items-center gap-1 bg-black/20 px-3 py-1 rounded-lg backdrop-blur-sm">
                  <Shield className="w-3.5 h-3.5 text-accent-foreground" /> Code: {employeeData.employeeCode}
                </span>
                <span className="flex items-center gap-1 bg-black/20 px-3 py-1 rounded-lg backdrop-blur-sm">
                  <Briefcase className="w-3.5 h-3.5 text-accent-foreground" /> {employeeData.designation} ({employeeData.department})
                </span>
                <span className="flex items-center gap-1 bg-black/20 px-3 py-1 rounded-lg backdrop-blur-sm">
                  <Calendar className="w-3.5 h-3.5 text-accent-foreground" /> Joined: {new Date(employeeData.joiningDate).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Quick Stats & Balances (If Employee) */}
        <div className="space-y-8">
          {employeeData ? (
            <>
              <Card className="p-6 border-2 border-primary/20 shadow-lg bg-gradient-to-b from-card to-primary/5 space-y-6">
                <h3 className="text-lg font-black text-foreground flex items-center gap-2 border-b border-border pb-3 tracking-tight">
                  <Award className="w-5 h-5 text-primary" /> Compensation & Benefits
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-background border border-border shadow-sm">
                    <span className="text-xs font-bold text-muted-foreground flex items-center gap-2 uppercase tracking-wider">
                      <DollarSign className="w-4 h-4 text-primary" /> Base Salary
                    </span>
                    <span className="text-base font-black text-foreground font-mono">
                      {formatCurrency(employeeData.salary)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-background border border-border shadow-sm">
                    <span className="text-xs font-bold text-muted-foreground flex items-center gap-2 uppercase tracking-wider">
                      <Calendar className="w-4 h-4 text-primary" /> Leave Balance
                    </span>
                    <span className="text-base font-black text-primary font-mono">
                      {employeeData.leaveBalance} Days
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-background border border-border shadow-sm">
                    <span className="text-xs font-bold text-muted-foreground flex items-center gap-2 uppercase tracking-wider">
                      <Briefcase className="w-4 h-4 text-primary" /> WFH Balance
                    </span>
                    <span className="text-base font-black text-primary font-mono">
                      {employeeData.wfhBalance} Days
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-background border border-border shadow-sm">
                    <span className="text-xs font-bold text-muted-foreground flex items-center gap-2 uppercase tracking-wider">
                      <Shield className="w-4 h-4 text-primary" /> Permission Hours
                    </span>
                    <span className="text-base font-black text-primary font-mono">
                      {employeeData.permissionHoursBalance} Hours
                    </span>
                  </div>
                </div>
              </Card>

              <Card className="p-6 border border-border shadow-md space-y-6 bg-card">
                <h3 className="text-lg font-black text-foreground flex items-center gap-2 border-b border-border pb-3 tracking-tight">
                  <HeartPulse className="w-5 h-5 text-red-500" /> Emergency Contact
                </h3>
                <div className="space-y-3 p-4 rounded-xl bg-red-500/5 border border-red-500/20 text-xs">
                  <div className="flex justify-between border-b border-border/50 pb-2">
                    <span className="font-bold text-muted-foreground uppercase tracking-wider">Contact Name</span>
                    <span className="font-black text-foreground">{ecName || 'Not Set'}</span>
                  </div>
                  <div className="flex justify-between border-b border-border/50 pb-2">
                    <span className="font-bold text-muted-foreground uppercase tracking-wider">Relationship</span>
                    <span className="font-black text-foreground">{ecRel || 'Not Set'}</span>
                  </div>
                  <div className="flex justify-between pt-1">
                    <span className="font-bold text-muted-foreground uppercase tracking-wider">Phone Number</span>
                    <span className="font-black font-mono text-red-600 dark:text-red-400">{ecPhone || 'Not Set'}</span>
                  </div>
                </div>
              </Card>
            </>
          ) : (
            <Card className="p-6 border border-border shadow-md space-y-6 bg-card">
              <h3 className="text-lg font-black text-foreground flex items-center gap-2 border-b border-border pb-3 tracking-tight">
                <Shield className="w-5 h-5 text-primary" /> System Access Role
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                You are currently logged in with <strong className="text-foreground">{role}</strong> privileges. Your account manages enterprise operations, configurations, and staff oversight.
              </p>
            </Card>
          )}
        </div>

        {/* Right Column: Editable Profile Details Form */}
        <div className="lg:col-span-2 space-y-8">
          <Card className="p-8 border border-border shadow-xl bg-card space-y-6">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <h3 className="text-xl font-black text-foreground tracking-tight flex items-center gap-2">
                  <UserIcon className="w-6 h-6 text-primary" /> Personal Details & Settings
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5 font-medium">Update your profile name, residential address, and emergency contact details</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Input
                  label="Full Name *"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your full name"
                  required
                />
                <Input
                  label="Email Address (Static)"
                  value={user?.email || ''}
                  disabled
                  className="bg-muted/50 cursor-not-allowed font-mono text-xs"
                />
                {employeeData && (
                  <>
                    <Input
                      label="Phone Number *"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="Enter your mobile number"
                      required
                    />
                    <Input
                      label="Employee Code (Static)"
                      value={employeeData.employeeCode}
                      disabled
                      className="bg-muted/50 cursor-not-allowed font-mono text-xs"
                    />
                  </>
                )}
              </div>

              {employeeData && (
                <Textarea
                  label="Residential Address *"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Enter your full permanent address"
                  rows={3}
                  required
                />
              )}

              {employeeData && (
                <div className="p-6 rounded-2xl bg-muted/30 border border-border space-y-6">
                  <h4 className="text-sm font-black text-foreground flex items-center gap-2 tracking-tight">
                    <HeartPulse className="w-4 h-4 text-red-500" /> Emergency Contact Details
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Input
                      label="Contact Name *"
                      value={ecName}
                      onChange={(e) => setEcName(e.target.value)}
                      placeholder="Contact person name"
                      required
                    />
                    <Input
                      label="Relationship *"
                      value={ecRel}
                      onChange={(e) => setEcRel(e.target.value)}
                      placeholder="e.g. Father, Spouse"
                      required
                    />
                    <Input
                      label="Contact Phone *"
                      value={ecPhone}
                      onChange={(e) => setEcPhone(e.target.value)}
                      placeholder="Emergency mobile number"
                      required
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-4 border-t border-border">
                <Button
                  type="submit"
                  isLoading={updateProfileMutation.isPending}
                  className="bg-primary text-primary-foreground font-black tracking-wider py-3 px-8 rounded-xl shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all scale-[1.02]"
                >
                  <Save className="w-5 h-5 mr-2" />
                  SAVE PROFILE CHANGES
                </Button>
              </div>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
};

import React from 'react';

// Base pulse block
export const Skeleton: React.FC<{ className?: string; style?: React.CSSProperties }> = ({ className = '', style }) => (
  <div
    style={style}
    className={`animate-pulse bg-gradient-to-r from-muted/30 via-muted/65 to-muted/30 rounded-xl ${className}`}
  />
);

// Helper for multiple skeletons
export const SkeletonList: React.FC<{ count: number; className?: string }> = ({ count, className = 'h-4 w-full' }) => (
  <div className="space-y-3 w-full">
    {Array.from({ length: count }).map((_, i) => (
      <Skeleton key={i} className={className} />
    ))}
  </div>
);

// 1. Dashboard Skeleton Layout
export const DashboardSkeleton: React.FC = () => {
  return (
    <div className="space-y-8 text-left animate-in fade-in duration-300">
      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-card border border-border p-6 rounded-2xl flex justify-between items-center shadow-sm">
            <div className="space-y-2 flex-1">
              <Skeleton className="h-3.5 w-1/2" />
              <Skeleton className="h-8 w-1/3" />
              <Skeleton className="h-3 w-2/3" />
            </div>
            <Skeleton className="w-12 h-12 rounded-2xl shrink-0 ml-4" />
          </div>
        ))}
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column (Wide) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex justify-between items-center">
              <Skeleton className="h-5 w-1/3" />
              <Skeleton className="h-8 w-24" />
            </div>
            <Skeleton className="h-64 w-full" />
          </div>
          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
            <Skeleton className="h-5 w-1/4" />
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          </div>
        </div>

        {/* Right Column (Narrow) */}
        <div className="lg:col-span-1">
          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
            <Skeleton className="h-5 w-1/2" />
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex gap-3 items-center">
                  <Skeleton className="w-9 h-9 rounded-full shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// 2. Table Page Skeleton Layout
export const TableSkeleton: React.FC<{ rows?: number; cols?: number }> = ({ rows = 6, cols = 5 }) => {
  return (
    <div className="space-y-6 text-left animate-in fade-in duration-300 w-full">
      {/* Header and filters */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-6 rounded-2xl bg-card border border-border shadow-sm">
        <div className="space-y-2 flex-1">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-3 w-2/3" />
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-32" />
        </div>
      </div>

      {/* Table block */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
        {/* Search bar skeleton */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 w-full sm:w-48" />
        </div>

        {/* Table representation */}
        <div className="border border-border rounded-xl overflow-hidden">
          {/* Table Header */}
          <div className="bg-muted/40 p-4 border-b border-border flex justify-between">
            {Array.from({ length: cols }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-20" />
            ))}
          </div>
          {/* Table Rows */}
          <div className="divide-y divide-border">
            {Array.from({ length: rows }).map((_, r) => (
              <div key={r} className="p-4 flex justify-between items-center hover:bg-muted/5 transition-colors">
                {Array.from({ length: cols }).map((_, c) => (
                  <div key={c} className="w-20">
                    {c === 0 ? (
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-7 w-7 rounded-full shrink-0" />
                        <Skeleton className="h-3 w-12" />
                      </div>
                    ) : (
                      <Skeleton className="h-3 w-16" />
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// 3. Profile / Detail Page Skeleton
export const ProfileSkeleton: React.FC = () => {
  return (
    <div className="space-y-6 text-left animate-in fade-in duration-300">
      {/* Cover / Avatar Header Card */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
        <Skeleton className="h-32 w-full rounded-none" />
        <div className="p-6 relative flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-10">
          <div className="flex flex-col sm:flex-row items-center sm:items-end gap-4 text-center sm:text-left">
            <Skeleton className="w-24 h-24 rounded-full border-4 border-card shrink-0 shadow-md" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-48 mx-auto sm:mx-0" />
              <Skeleton className="h-3.5 w-64 mx-auto sm:mx-0" />
            </div>
          </div>
          <Skeleton className="h-9 w-28 mx-auto sm:mx-0" />
        </div>
      </div>

      {/* Tabs list */}
      <div className="flex gap-2 border-b border-border pb-1 overflow-x-auto">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-9 w-24 shrink-0" />
        ))}
      </div>

      {/* Layout content split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sidebar details */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
            <Skeleton className="h-4 w-1/3" />
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="space-y-1.5">
                  <Skeleton className="h-3 w-1/4" />
                  <Skeleton className="h-3.5 w-2/3" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Main Tab Details */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
            <Skeleton className="h-5 w-1/4" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="space-y-1.5 p-3 bg-muted/20 rounded-xl">
                  <Skeleton className="h-3 w-1/3" />
                  <Skeleton className="h-3.5 w-2/3" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// 4. Chat Page Skeleton
export const ChatSkeleton: React.FC = () => {
  return (
    <div className="flex h-[calc(100vh-8rem)] gap-3 font-sans animate-in fade-in duration-300">
      {/* Sidebar */}
      <div className="flex flex-col w-80 shrink-0 rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border space-y-3 bg-card">
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="h-9 w-full" />
          <div className="flex gap-2">
            <Skeleton className="h-7 flex-1" />
            <Skeleton className="h-7 flex-1" />
            <Skeleton className="h-7 flex-1" />
          </div>
        </div>
        <div className="flex-1 p-3 space-y-3 overflow-y-auto">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="flex gap-3 items-center p-2 rounded-xl">
              <Skeleton className="w-9 h-9 rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-2/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chat Room Area */}
      <div className="flex-1 flex flex-col rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
        {/* Chat header */}
        <div className="p-4 border-b border-border flex justify-between items-center bg-card">
          <div className="flex items-center gap-3">
            <Skeleton className="w-9 h-9 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
          <Skeleton className="h-8 w-24" />
        </div>

        {/* Bubbles Area */}
        <div className="flex-1 bg-muted/20 p-6 space-y-4 overflow-y-auto">
          {[
            { align: 'start', w: 'w-1/3' },
            { align: 'end', w: 'w-1/4' },
            { align: 'start', w: 'w-1/2' },
            { align: 'end', w: 'w-1/3' },
            { align: 'start', w: 'w-1/5' },
          ].map((item, idx) => (
            <div key={idx} className={`flex ${item.align === 'end' ? 'justify-end' : 'justify-start'}`}>
              <div className={`space-y-1.5 ${item.align === 'end' ? 'items-end' : 'items-start'} flex flex-col max-w-[70%]`}>
                <div className={`p-4 rounded-2xl ${item.align === 'end' ? 'bg-primary/20 rounded-br-none' : 'bg-muted rounded-bl-none'} w-64`}>
                  <Skeleton className="h-3 w-full mb-2" />
                  <Skeleton className="h-3 w-4/5" />
                </div>
                <Skeleton className="h-2 w-12" />
              </div>
            </div>
          ))}
        </div>

        {/* Input box */}
        <div className="p-4 border-t border-border bg-card">
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    </div>
  );
};

// 5. Settings / Permissions Matrix Layout Skeleton
export const SettingsSkeleton: React.FC = () => {
  return (
    <div className="space-y-6 text-left animate-in fade-in duration-300">
      {/* Title */}
      <div className="p-6 rounded-2xl bg-card border border-border shadow-sm">
        <Skeleton className="h-6 w-1/4 mb-2" />
        <Skeleton className="h-3.5 w-1/2" />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border pb-1 overflow-x-auto">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-9 w-28 shrink-0" />
        ))}
      </div>

      {/* Main card */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-6">
        <div className="flex justify-between items-center pb-4 border-b border-border">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-9 w-24" />
        </div>

        {/* Grid forms */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3 w-1/4" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        </div>

        {/* Save button */}
        <div className="flex justify-end pt-4 border-t border-border">
          <Skeleton className="h-10 w-32" />
        </div>
      </div>
    </div>
  );
};

// 6. Card Grid Skeleton (for Projects / Files / Organization tree folders)
export const CardGridSkeleton: React.FC<{ count?: number }> = ({ count = 6 }) => {
  return (
    <div className="space-y-6 text-left animate-in fade-in duration-300 w-full">
      {/* Header card */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-6 rounded-2xl bg-card border border-border shadow-sm">
        <div className="space-y-2 flex-1">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-3.5 w-2/3" />
        </div>
        <Skeleton className="h-10 w-28 shrink-0" />
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex justify-between items-start">
              <Skeleton className="w-10 h-10 rounded-xl" />
              <Skeleton className="w-16 h-5 rounded-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4.5 w-3/4" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-5/6" />
            </div>
            <div className="border-t border-border pt-4 mt-4 flex items-center justify-between">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// 7. Notification / Feed List Loader
export const NotificationSkeleton: React.FC = () => {
  return (
    <div className="space-y-6 max-w-4xl mx-auto text-left animate-in fade-in duration-300">
      {/* Title */}
      <div className="flex justify-between items-center p-6 rounded-2xl bg-card border border-border shadow-sm">
        <div className="space-y-2 flex-1">
          <Skeleton className="h-6 w-1/4" />
          <Skeleton className="h-3.5 w-1/2" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-16" />
        </div>
      </div>

      {/* Filter pills */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-7 w-16 rounded-full shrink-0" />
        ))}
      </div>

      {/* List */}
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="bg-card border border-border p-5 rounded-xl shadow-sm space-y-3">
            <div className="flex justify-between items-start">
              <div className="flex gap-2 items-center">
                <Skeleton className="h-5 w-12 rounded" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="h-3 w-16" />
            </div>
            <Skeleton className="h-4.5 w-1/3" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        ))}
      </div>
    </div>
  );
};

// 8. Org Tree Layout Skeleton
export const OrgChartSkeleton: React.FC = () => {
  return (
    <div className="space-y-8 text-left animate-in fade-in duration-300">
      {/* Header */}
      <div className="p-6 rounded-2xl bg-card border border-border shadow-sm">
        <Skeleton className="h-6 w-1/3 mb-2" />
        <Skeleton className="h-3.5 w-1/2" />
      </div>

      {/* Org tree representation */}
      <div className="bg-card border border-border rounded-2xl p-10 shadow-sm flex flex-col items-center space-y-8 overflow-x-auto min-h-[500px]">
        {/* CEO Node */}
        <div className="flex flex-col items-center">
          <Skeleton className="h-16 w-48 rounded-xl border border-border" />
          <div className="h-8 w-0.5 bg-border mt-2" />
        </div>

        {/* Middle level horizontal line and connections */}
        <div className="w-2/3 border-t border-border flex justify-between relative">
          <div className="absolute left-0 h-4 w-0.5 bg-border -top-0" />
          <div className="absolute left-1/2 h-4 w-0.5 bg-border -top-0 -translate-x-1/2" />
          <div className="absolute right-0 h-4 w-0.5 bg-border -top-0" />
        </div>

        {/* Mid-level manager nodes */}
        <div className="flex justify-between gap-12 w-full max-w-4xl pt-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex flex-col items-center flex-1">
              <Skeleton className="h-14 w-40 rounded-xl border border-border" />
              <div className="h-6 w-0.5 bg-border mt-2" />
              <div className="grid grid-cols-2 gap-4 mt-2">
                <Skeleton className="h-10 w-24 rounded-lg" />
                <Skeleton className="h-10 w-24 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

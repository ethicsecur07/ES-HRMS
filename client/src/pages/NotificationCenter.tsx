import React, { useEffect, useState } from 'react';
import { useNotificationStore } from '../store/useNotificationStore';
import { Card } from '../Components/WrapperComponents/Card';
import { Button } from '../Components/WrapperComponents/Button';
import { Bell, Check, Trash2 } from 'lucide-react';
import { formatDate } from '../utils/formatters';

export const NotificationCenter: React.FC = () => {
  const { notifications, markAsRead, markAllAsRead, clearNotifications, fetchNotifications } = useNotificationStore();
  const [filter, setFilter] = useState<string>('ALL');

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const filtered = filter === 'ALL' ? notifications : notifications.filter(n => n.type === filter);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 rounded-2xl bg-card border border-border shadow-sm">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Bell className="w-6 h-6 text-primary" />
            Notification Center
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your real-time alerts and approvals.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={markAllAsRead} className="flex items-center gap-2">
            <Check className="w-4 h-4" /> Mark All Read
          </Button>
          <Button variant="outline" className="text-destructive hover:bg-destructive/10" onClick={clearNotifications}>
            <Trash2 className="w-4 h-4" /> Clear
          </Button>
        </div>
      </div>

      <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
        {['ALL', 'TASK', 'LEAVE', 'WFH', 'ATTENDANCE', 'APPROVAL', 'CHAT'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-colors ${filter === f ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-primary/20 hover:text-primary'}`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground bg-card border border-border rounded-xl">
            No notifications found.
          </div>
        ) : (
          filtered.map(notif => (
            <Card key={notif._id} className={`p-4 transition-all hover:border-primary/40 ${!notif.read ? 'border-l-4 border-l-primary bg-primary/5' : 'bg-card'}`}>
              <div className="flex justify-between items-start">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded border border-primary/20 text-primary uppercase">
                      {notif.type}
                    </span>
                    <span className="text-xs text-muted-foreground font-mono">
                      {formatDate(notif.createdAt)}
                    </span>
                  </div>
                  <h4 className="font-bold text-sm text-foreground">{notif.title}</h4>
                  <p className="text-sm text-muted-foreground">{notif.message}</p>
                </div>
                {!notif.read && (
                  <button onClick={() => markAsRead(notif._id)} className="text-xs text-primary hover:underline font-semibold mt-1">
                    Mark Read
                  </button>
                )}
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

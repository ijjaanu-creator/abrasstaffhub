import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import {
  Settings2,
  Bell,
  Clock,
  Shield,
  Building,
  Save,
  Loader2,
} from 'lucide-react';

export default function Settings() {
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  // Settings state
  const [settings, setSettings] = useState({
    companyName: 'Abras Natural Spices',
    workStartTime: '09:00',
    workEndTime: '18:00',
    lateThreshold: 15, // minutes
    halfDayHours: 4,
    fullDayHours: 8,
    overtimeRate: 1.5,
    enableNotifications: true,
    enableEmailAlerts: false,
    enableAutoCheckout: true,
    autoCheckoutTime: '20:00',
  });

  const handleSave = async () => {
    setIsSaving(true);
    // Simulate saving - in real app, save to database
    await new Promise(resolve => setTimeout(resolve, 1000));
    toast({ title: 'Settings saved successfully!' });
    setIsSaving(false);
  };

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="font-display text-xl font-semibold text-foreground">Admin Access Required</h2>
          <p className="text-muted-foreground mt-2">You need admin privileges to access settings.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 lg:space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between animate-fade-in">
        <div>
          <h1 className="font-display text-2xl lg:text-3xl font-bold text-foreground">Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure app preferences and company settings
          </p>
        </div>
        <Button 
          onClick={handleSave} 
          disabled={isSaving}
          size="lg"
        >
          {isSaving ? (
            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
          ) : (
            <Save className="h-5 w-5 mr-2" />
          )}
          Save Changes
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Company Settings */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-elegant animate-fade-in delay-100">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Building className="h-5 w-5 text-primary" />
            </div>
            <h3 className="font-display text-lg font-semibold text-foreground">Company Settings</h3>
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="companyName">Company Name</Label>
              <Input
                id="companyName"
                value={settings.companyName}
                onChange={(e) => setSettings({ ...settings, companyName: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* Work Hours Settings */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-elegant animate-fade-in delay-200">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-info/10">
              <Clock className="h-5 w-5 text-info" />
            </div>
            <h3 className="font-display text-lg font-semibold text-foreground">Work Hours</h3>
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="workStartTime">Start Time</Label>
                <Input
                  id="workStartTime"
                  type="time"
                  value={settings.workStartTime}
                  onChange={(e) => setSettings({ ...settings, workStartTime: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="workEndTime">End Time</Label>
                <Input
                  id="workEndTime"
                  type="time"
                  value={settings.workEndTime}
                  onChange={(e) => setSettings({ ...settings, workEndTime: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="lateThreshold">Late Threshold (minutes)</Label>
              <Input
                id="lateThreshold"
                type="number"
                value={settings.lateThreshold}
                onChange={(e) => setSettings({ ...settings, lateThreshold: parseInt(e.target.value) || 0 })}
              />
              <p className="text-xs text-muted-foreground">
                Staff arriving after this many minutes past start time will be marked late
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="halfDayHours">Half Day Hours</Label>
                <Input
                  id="halfDayHours"
                  type="number"
                  value={settings.halfDayHours}
                  onChange={(e) => setSettings({ ...settings, halfDayHours: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fullDayHours">Full Day Hours</Label>
                <Input
                  id="fullDayHours"
                  type="number"
                  value={settings.fullDayHours}
                  onChange={(e) => setSettings({ ...settings, fullDayHours: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="overtimeRate">Overtime Rate (multiplier)</Label>
              <Input
                id="overtimeRate"
                type="number"
                step="0.1"
                value={settings.overtimeRate}
                onChange={(e) => setSettings({ ...settings, overtimeRate: parseFloat(e.target.value) || 1 })}
              />
              <p className="text-xs text-muted-foreground">
                Multiplier applied to hourly rate for overtime calculation
              </p>
            </div>
          </div>
        </div>

        {/* Notification Settings */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-elegant animate-fade-in delay-300">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10">
              <Bell className="h-5 w-5 text-warning" />
            </div>
            <h3 className="font-display text-lg font-semibold text-foreground">Notifications</h3>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Push Notifications</Label>
                <p className="text-xs text-muted-foreground">Receive push notifications for important events</p>
              </div>
              <Switch
                checked={settings.enableNotifications}
                onCheckedChange={(checked) => setSettings({ ...settings, enableNotifications: checked })}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Email Alerts</Label>
                <p className="text-xs text-muted-foreground">Receive daily attendance summary via email</p>
              </div>
              <Switch
                checked={settings.enableEmailAlerts}
                onCheckedChange={(checked) => setSettings({ ...settings, enableEmailAlerts: checked })}
              />
            </div>
          </div>
        </div>

        {/* Automation Settings */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-elegant animate-fade-in delay-400">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
              <Settings2 className="h-5 w-5 text-success" />
            </div>
            <h3 className="font-display text-lg font-semibold text-foreground">Automation</h3>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Auto Checkout</Label>
                <p className="text-xs text-muted-foreground">Automatically check out staff who forget</p>
              </div>
              <Switch
                checked={settings.enableAutoCheckout}
                onCheckedChange={(checked) => setSettings({ ...settings, enableAutoCheckout: checked })}
              />
            </div>
            {settings.enableAutoCheckout && (
              <div className="space-y-2">
                <Label htmlFor="autoCheckoutTime">Auto Checkout Time</Label>
                <Input
                  id="autoCheckoutTime"
                  type="time"
                  value={settings.autoCheckoutTime}
                  onChange={(e) => setSettings({ ...settings, autoCheckoutTime: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Staff will be automatically checked out at this time if they haven't checked out
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

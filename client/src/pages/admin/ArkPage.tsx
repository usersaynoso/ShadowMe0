import React, { useState, useEffect } from 'react';
import { MainLayout } from '@/components/main-layout';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { apiRequest } from '@/lib/queryClient'; // Assuming a similar apiRequest helper as in other components
import { useAuth } from '@/hooks/use-auth'; // To get current user for email prefill

// Define the structure of SMTP settings based on backend expectations
interface SmtpSettingsForm {
  host: string;
  port: number | string; // Allow string for input, convert to number on submit
  username?: string;
  password?: string; // Only for sending, not for display
  encryption: 'none' | 'ssl' | 'tls';
  fromEmail: string;
  fromName: string;
}

const ArkPage: React.FC = () => {
  const { toast } = useToast();
  const { user } = useAuth(); // For pre-filling test email, might be null
  const [settings, setSettings] = useState<SmtpSettingsForm>({
    host: '',
    port: '',
    username: '',
    password: '', // Keep password field for input, but it won't be fetched/displayed
    encryption: 'tls',
    fromEmail: '',
    fromName: '',
  });
  const [testEmail, setTestEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    // Prefill test email if user is available
    if (user?.email) {
      setTestEmail(user.email);
    }

    const fetchSmtpSettings = async () => {
      setIsLoading(true);
      try {
        const response = await apiRequest('GET', '/api/ark/smtp-settings');
        if (response.ok) {
          const data = await response.json();
          setSettings(prev => ({ 
            ...prev, // Keep existing password field if user was typing
            ...data, 
            port: data.port?.toString() || '' // Ensure port is string for input
          })); 
        } else if (response.status !== 404) { // 404 is fine, means not set up yet
          const errorData = await response.json();
          toast({
            title: "Error fetching SMTP settings",
            description: errorData.message || "Could not load existing SMTP configuration.",
            variant: "destructive",
          });
        }
      } catch (error) {
        toast({
          title: "Network Error",
          description: "Failed to connect to server to fetch SMTP settings.",
          variant: "destructive",
        });
      }
      setIsLoading(false);
    };
    fetchSmtpSettings();
  }, [toast, user?.email]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setSettings(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (value: string) => {
    setSettings(prev => ({ ...prev, encryption: value as SmtpSettingsForm['encryption'] }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const payload = {
        ...settings,
        port: Number(settings.port) // Convert port to number
    };
    // Do not send password if it's empty (meaning user doesn't want to update it)
    if (!settings.password) {
        delete (payload as any).password;
    }

    try {
      const response = await apiRequest('POST', '/api/ark/smtp-settings', payload);
      const data = await response.json();
      if (response.ok) {
        toast({ title: "SMTP Settings Saved", description: data.message });
        // Clear password field after successful save for security
        setSettings(prev => ({ ...prev, password: '' })); 
      } else {
        toast({ title: "Save Failed", description: data.message || "Could not save SMTP settings.", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Network Error", description: "Failed to save SMTP settings.", variant: "destructive" });
    }
    setIsLoading(false);
  };

  const handleSendTestEmail = async () => {
    if (!testEmail) {
      toast({ title: "Missing Email", description: "Please enter a recipient email for the test.", variant: "destructive"});
      return;
    }
    setIsTesting(true);
    try {
      const response = await apiRequest('POST', '/api/ark/smtp-test', { toEmail: testEmail });
      const data = await response.json();
      if (response.ok) {
        toast({ title: "Test Email Sent", description: data.message });
      } else {
        toast({ title: "Test Failed", description: data.message || "Could not send test email.", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Network Error", description: "Failed to send test email.", variant: "destructive" });
    }
    setIsTesting(false);
  };

  return (
    <MainLayout showLeftSidebar={false} showRightSidebar={false}>
      <div className="container mx-auto p-4 md:p-8">
        <h1 className="text-3xl font-bold mb-8">Admin Panel - SMTP Settings (/ark)</h1>
        
        <form onSubmit={handleSubmit} className="space-y-6 bg-card p-6 rounded-lg shadow-md">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="host">SMTP Host</Label>
              <Input id="host" name="host" value={settings.host} onChange={handleInputChange} required disabled={isLoading} />
            </div>
            <div>
              <Label htmlFor="port">SMTP Port</Label>
              <Input id="port" name="port" type="number" value={settings.port} onChange={handleInputChange} required disabled={isLoading} />
            </div>
          </div>

          <div>
            <Label htmlFor="username">SMTP Username</Label>
            <Input id="username" name="username" value={settings.username || ''} onChange={handleInputChange} disabled={isLoading} />
          </div>
          <div>
            <Label htmlFor="password">SMTP Password</Label>
            <Input id="password" name="password" type="password" value={settings.password || ''} onChange={handleInputChange} placeholder="Enter new password or leave blank to keep existing" disabled={isLoading} />
            <p className="text-sm text-muted-foreground mt-1">Leave blank to keep the current password (if set).</p>
          </div>

          <div>
            <Label htmlFor="encryption">Encryption</Label>
            <Select value={settings.encryption} onValueChange={handleSelectChange} disabled={isLoading}>
              <SelectTrigger id="encryption">
                <SelectValue placeholder="Select encryption type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="ssl">SSL</SelectItem>
                <SelectItem value="tls">TLS</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="fromEmail">From Email Address</Label>
              <Input id="fromEmail" name="fromEmail" type="email" value={settings.fromEmail} onChange={handleInputChange} required disabled={isLoading} />
            </div>
            <div>
              <Label htmlFor="fromName">From Name</Label>
              <Input id="fromName" name="fromName" value={settings.fromName} onChange={handleInputChange} required disabled={isLoading} />
            </div>
          </div>
          
          <Button type="submit" disabled={isLoading || isTesting} className="w-full md:w-auto">
            {isLoading ? 'Saving...' : 'Save SMTP Settings'}
          </Button>
        </form>

        <div className="mt-12 pt-8 border-t">
          <h2 className="text-2xl font-semibold mb-6">Test SMTP Configuration</h2>
          <div className="space-y-4 bg-card p-6 rounded-lg shadow-md">
            <div>
              <Label htmlFor="testEmail">Recipient Email Address</Label>
              <Input 
                id="testEmail" 
                type="email" 
                value={testEmail} 
                onChange={(e) => setTestEmail(e.target.value)} 
                placeholder="Enter email to send test to" 
                disabled={isTesting || isLoading}
              />
            </div>
            <Button onClick={handleSendTestEmail} disabled={isTesting || isLoading || !settings.host} className="w-full md:w-auto">
              {isTesting ? 'Sending Test...' : 'Send Test Email'}
            </Button>
            {!settings.host && <p className="text-sm text-destructive mt-1">SMTP settings must be saved before sending a test email.</p>}
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default ArkPage; 
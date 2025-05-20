import React, { useState, useEffect, useRef } from 'react';
import { MainLayout } from '@/components/main-layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/use-auth';

// Define types for settings based on backend structure
interface UserPreferences {
  theme: 'light' | 'dark' | 'system' | 'auto';
  theme_auto_sunrise_sunset: boolean;
  show_online_status: boolean;
  default_post_audience: string; // Consider specific enum later
  allow_friend_requests_from: string; // Consider specific enum later
  allow_space_circle_invites_from: string; // Consider specific enum later
  profile_visibility: 'public' | 'friends_only' | 'private'; // New preference
  language: string; // e.g., 'en', 'es' - using string for now, could be enum
  region: string;   // e.g., 'US', 'GB' - using string for now, could be enum
}

// Define structure for one notification type setting
interface NotificationTypeSetting {
  in_app: boolean;
  email: boolean;
  email_digest_preference?: 'immediate' | 'daily' | 'weekly';
}

// Define overall notification settings structure
interface UserNotificationSettings {
  master_in_app_enabled: boolean;
  master_email_enabled: boolean;

  // Based on eventTypeEnum and discussion
  friendship_request: NotificationTypeSetting;          // friendship_request
  friendship_accepted: NotificationTypeSetting;         // friendship_accepted
  // message_sent: NotificationTypeSetting; // Usually too noisy for explicit setting, real-time handling
  post_liked: NotificationTypeSetting;                  // post_liked
  post_commented: NotificationTypeSetting;              // post_commented (includes replies)
  // post_created: NotificationTypeSetting; // User might follow others, or for groups/spaces they are in
  shadow_session_invitations: NotificationTypeSetting;  // shadow_session_created (as invite)
  shadow_session_reminders_starts: NotificationTypeSetting; // shadow_session_reminder
  group_invites: NotificationTypeSetting;               // group_invite
  friend_group_invites: NotificationTypeSetting;        // friend_group_invite
  
  // Additional important categories from discussion
  mentions_in_posts_comments: NotificationTypeSetting; // Could be a separate system or part of post_commented logic
  new_posts_from_followed_users: NotificationTypeSetting; // If user follows specific users
  new_posts_in_joined_spaces: NotificationTypeSetting;    // Activity in joined groups/spaces
  new_posts_in_joined_circles: NotificationTypeSetting;   // Activity in joined friend_groups/circles

  product_updates_from_shadowme: Pick<NotificationTypeSetting, 'email'>; // Email only, opt-in
  // Security alerts are non-optional and always on (email)
}

interface UserSettings {
  preferences: UserPreferences;
  notificationSettings: UserNotificationSettings;
}

const defaultPreferences: UserPreferences = {
  theme: "system",
  theme_auto_sunrise_sunset: false,
  show_online_status: true,
  default_post_audience: "everyone",
  allow_friend_requests_from: "everyone",
  allow_space_circle_invites_from: "everyone",
  profile_visibility: "public", // Default to public
  language: "en", // Default language
  region: "US",   // Default region
};

const defaultNotificationSettings: UserNotificationSettings = {
  master_in_app_enabled: true,
  master_email_enabled: true,

  friendship_request: { in_app: true, email: true, email_digest_preference: 'immediate' },
  friendship_accepted: { in_app: true, email: true, email_digest_preference: 'immediate' },
  post_liked: { in_app: true, email: true, email_digest_preference: 'daily' },
  post_commented: { in_app: true, email: true, email_digest_preference: 'daily' }, 
  shadow_session_invitations: { in_app: true, email: true, email_digest_preference: 'immediate' },
  shadow_session_reminders_starts: { in_app: true, email: true, email_digest_preference: 'immediate' },
  group_invites: { in_app: true, email: true, email_digest_preference: 'immediate' },
  friend_group_invites: { in_app: true, email: true, email_digest_preference: 'immediate' },
  
  mentions_in_posts_comments: { in_app: true, email: true, email_digest_preference: 'immediate' },
  new_posts_from_followed_users: { in_app: true, email: false },
  new_posts_in_joined_spaces: { in_app: true, email: false },
  new_posts_in_joined_circles: { in_app: true, email: false },

  product_updates_from_shadowme: { email: false }, // Opt-in, default off
};

// Placeholder for Preferences Tab Content
const PreferencesTab: React.FC<{ currentPrefs: UserPreferences, onPrefsChange: (newPrefs: Partial<UserPreferences>) => void, isLoading: boolean }> = 
  ({ currentPrefs, onPrefsChange, isLoading }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Preferences</CardTitle>
        <CardDescription>Manage your application preferences.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="theme">Theme</Label>
          <Select 
            value={currentPrefs.theme} 
            onValueChange={(value) => onPrefsChange({ theme: value as UserPreferences['theme'] })}
            disabled={isLoading}
          >
            <SelectTrigger id="theme">
              <SelectValue placeholder="Select theme" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="light">Light</SelectItem>
              <SelectItem value="dark">Dark</SelectItem>
              <SelectItem value="system">System Default</SelectItem>
              <SelectItem value="auto">Automatic (Sunrise/Sunset)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {currentPrefs.theme === 'auto' && (
          <div className="flex items-center space-x-2 pl-4">
            <Switch 
              id="theme_auto_sunrise_sunset" 
              checked={currentPrefs.theme_auto_sunrise_sunset} 
              onCheckedChange={(checked) => onPrefsChange({ theme_auto_sunrise_sunset: checked })}
              disabled={isLoading}
            />
            <Label htmlFor="theme_auto_sunrise_sunset">Enable automatic theme switching based on sunrise/sunset</Label>
          </div>
        )}
        <div className="flex items-center space-x-2">
            <Switch 
              id="show_online_status" 
              checked={currentPrefs.show_online_status} 
              onCheckedChange={(checked) => onPrefsChange({ show_online_status: checked })}
              disabled={isLoading}
            />
            <Label htmlFor="show_online_status">Allow others to see my online status</Label>
        </div>
        {/* More preferences controls will go here */}
      </CardContent>
    </Card>
  );
};

// Component for Privacy & Sharing Tab
const PrivacySharingTab: React.FC<{ currentPrefs: UserPreferences, onPrefsChange: (newPrefs: Partial<UserPreferences>) => void, isLoading: boolean }> = 
  ({ currentPrefs, onPrefsChange, isLoading }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Privacy & Sharing</CardTitle>
        <CardDescription>Control who can see your activity and interact with you.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="default_post_audience">Default Post Audience</Label>
          <Select 
            value={currentPrefs.default_post_audience} 
            onValueChange={(value) => onPrefsChange({ default_post_audience: value })}
            disabled={isLoading}
          >
            <SelectTrigger id="default_post_audience">
              <SelectValue placeholder="Select default audience" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="everyone">Everyone</SelectItem>
              <SelectItem value="friends">Friends</SelectItem>
              <SelectItem value="just_me">Just Me</SelectItem>
              {/* Note: 'friend_group' and 'group' from audienceEnum are typically selected per-post, not as a general default */}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="allow_friend_requests_from">Who can send me friend requests?</Label>
          <Select 
            value={currentPrefs.allow_friend_requests_from} 
            onValueChange={(value) => onPrefsChange({ allow_friend_requests_from: value })}
            disabled={isLoading}
          >
            <SelectTrigger id="allow_friend_requests_from">
              <SelectValue placeholder="Select who can send requests" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="everyone">Everyone</SelectItem>
              <SelectItem value="friends_of_friends">Friends of Friends</SelectItem>
              <SelectItem value="no_one">No one</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="allow_space_circle_invites_from">Who can invite me to Spaces/Circles?</Label>
          <Select 
            value={currentPrefs.allow_space_circle_invites_from} 
            onValueChange={(value) => onPrefsChange({ allow_space_circle_invites_from: value })}
            disabled={isLoading}
          >
            <SelectTrigger id="allow_space_circle_invites_from">
              <SelectValue placeholder="Select who can invite" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="everyone">Everyone</SelectItem>
              <SelectItem value="friends">Friends</SelectItem>
              <SelectItem value="friends_of_friends">Friends of Friends</SelectItem>
              <SelectItem value="no_one">No one</SelectItem>
              {/* <SelectItem value="only_admins_mods">Only Admins/Mods of the Space/Circle</SelectItem> */}
              {/* This last option might require more specific backend logic if implemented */}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
};

// Define a minimal Profile type here if not importing from a shared location for frontend use
interface Profile {
    profile_id?: string;
    user_id?: string;
    display_name?: string;
    bio?: string;
    avatar_url?: string;
    timezone?: string;
    // Add other fields from schema.ts's profiles table if needed directly by ProfileTab
}

// Type for ProfileTab's currentProfile prop, including email
interface ProfileTabData extends Partial<Profile> {
    email?: string;
}

// Component for Profile Tab
const ProfileTab: React.FC<{
  currentProfile: ProfileTabData; // Use updated type
  currentPrefs: UserPreferences;
  onProfileChange: (newProfileData: Partial<Profile>) => void;
  onPrefsChange: (newPrefs: Partial<UserPreferences>) => void;
  onAvatarChange: (file: File) => void;
  isLoading: boolean;
  authUserId?: string;
}> = ({ currentProfile, currentPrefs, onProfileChange, onPrefsChange, onAvatarChange, isLoading, authUserId }) => {
  const avatarFileRef = useRef<HTMLInputElement>(null);

  const handleAvatarFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      onAvatarChange(event.target.files[0]);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>Manage your public profile information.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center space-x-4">
          <img src={currentProfile.avatar_url || 'https://via.placeholder.com/96'} alt="Avatar" className="w-24 h-24 rounded-full" />
          <div>
            <Button onClick={() => avatarFileRef.current?.click()} disabled={isLoading}>Change Avatar</Button>
            <Input type="file" ref={avatarFileRef} onChange={handleAvatarFileSelect} className="hidden" accept="image/*" />
            <p className="text-xs text-muted-foreground mt-1">Recommended: Square image, min 200x200px.</p>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="display_name">Display Name</Label>
          <Input 
            id="display_name" 
            value={currentProfile.display_name || ''} 
            onChange={(e) => onProfileChange({ display_name: e.target.value })}
            disabled={isLoading} 
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="bio">Bio</Label>
          <textarea
            id="bio"
            value={currentProfile.bio || ''}
            onChange={(e) => onProfileChange({ bio: e.target.value })}
            className="w-full p-2 border rounded-md min-h-[100px] bg-background text-foreground"
            placeholder="Tell us a little about yourself..."
            disabled={isLoading}
          />
        </div>
        <div className="space-y-2">
          <Label>Email Address</Label>
          <Input value={currentProfile.email || 'Loading...'} disabled /> 
          <p className="text-xs text-muted-foreground">Email cannot be changed from this tab. Go to Account settings.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="profile_visibility">Profile Visibility</Label>
          <Select 
            value={currentPrefs.profile_visibility} 
            onValueChange={(value) => onPrefsChange({ profile_visibility: value as UserPreferences['profile_visibility'] })}
            disabled={isLoading}
          >
            <SelectTrigger id="profile_visibility">
              <SelectValue placeholder="Select profile visibility" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="public">Public (Visible to everyone)</SelectItem>
              <SelectItem value="friends_only">Friends Only (Visible to your connections)</SelectItem>
              <SelectItem value="private">Private (Visible only to you)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
};

// Component for Account Tab
const AccountTab: React.FC<{
  currentPrefs: UserPreferences;
  onPrefsChange: (newPrefs: Partial<UserPreferences>) => void;
  isLoading: boolean;
  userEmail?: string;
}> = ({ currentPrefs, onPrefsChange, isLoading, userEmail }) => {
  // Dummy languages and regions - in a real app, these would come from a config or i18n library
  const languages = [{ value: 'en', label: 'English' }, { value: 'es', label: 'Español' }, { value: 'fr', label: 'Français' }];
  const regions = [{ value: 'US', label: 'United States' }, { value: 'GB', label: 'United Kingdom' }, { value: 'CA', label: 'Canada' }];

  const handleChangeEmail = () => {
    alert("Change Email functionality not yet implemented.");
    // TODO: Implement modal/flow for changing email, likely involves verification
  };

  const handleChangePassword = () => {
    alert("Change Password functionality not yet implemented.");
    // TODO: Implement modal/flow for changing password
  };

  const handleDeleteAccount = () => {
    if (confirm("Are you absolutely sure you want to delete your account? This action cannot be undone.")) {
      if (confirm("Seriously, there is no going back. Final chance to cancel.")) {
        alert("Delete Account functionality not yet implemented.");
        // TODO: Implement account deletion API call and logout/redirect
      }
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Account</CardTitle>
        <CardDescription>Manage your account settings, password, and more.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label>Current Email Address</Label>
          <Input value={userEmail || 'Loading...'} disabled />
        </div>
        <Button onClick={handleChangeEmail} variant="outline" disabled={isLoading}>Change Email Address</Button>
        
        <Button onClick={handleChangePassword} variant="outline" disabled={isLoading}>Change Password</Button>

        <div className="space-y-2">
          <Label htmlFor="language">Language</Label>
          <Select 
            value={currentPrefs.language} 
            onValueChange={(value) => onPrefsChange({ language: value })}
            disabled={isLoading}
          >
            <SelectTrigger id="language">
              <SelectValue placeholder="Select language" />
            </SelectTrigger>
            <SelectContent>
              {languages.map(lang => <SelectItem key={lang.value} value={lang.value}>{lang.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="region">Region</Label>
          <Select 
            value={currentPrefs.region} 
            onValueChange={(value) => onPrefsChange({ region: value })}
            disabled={isLoading}
          >
            <SelectTrigger id="region">
              <SelectValue placeholder="Select region" />
            </SelectTrigger>
            <SelectContent>
              {regions.map(reg => <SelectItem key={reg.value} value={reg.value}>{reg.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="pt-4 border-t border-destructive/50">
          <h3 className="text-lg font-semibold text-destructive">Danger Zone</h3>
          <Button onClick={handleDeleteAccount} variant="destructive" disabled={isLoading} className="mt-2">
            Delete My Account
          </Button>
          <p className="text-xs text-muted-foreground mt-1">This action is permanent and cannot be undone.</p>
        </div>
      </CardContent>
    </Card>
  );
};

// Helper component for a single notification type row
const NotificationSettingRow: React.FC<{
  label: string;
  settingKey: keyof Omit<UserNotificationSettings, 'master_in_app_enabled' | 'master_email_enabled' | 'product_updates_from_shadowme'>;
  currentSetting: NotificationTypeSetting;
  onSettingChange: (key: keyof Omit<UserNotificationSettings, 'master_in_app_enabled' | 'master_email_enabled' | 'product_updates_from_shadowme'>, newSetting: Partial<NotificationTypeSetting>) => void;
  isLoading: boolean;
  masterInAppEnabled: boolean;
  masterEmailEnabled: boolean;
  hasDigest?: boolean;
}> = ({ label, settingKey, currentSetting, onSettingChange, isLoading, masterInAppEnabled, masterEmailEnabled, hasDigest = true }) => {
  return (
    <div className="space-y-3 py-3 border-b last:border-b-0">
      <Label className="font-semibold text-base">{label}</Label>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center pl-2 sm:pl-4">
        <div className="flex items-center space-x-2">
          <Switch
            id={`${settingKey}_in_app`}
            checked={masterInAppEnabled && currentSetting.in_app}
            onCheckedChange={(checked) => onSettingChange(settingKey, { in_app: checked })}
            disabled={isLoading || !masterInAppEnabled}
          />
          <Label htmlFor={`${settingKey}_in_app`}>In-App</Label>
        </div>
        <div className="flex items-center space-x-2">
          <Switch
            id={`${settingKey}_email`}
            checked={masterEmailEnabled && currentSetting.email}
            onCheckedChange={(checked) => onSettingChange(settingKey, { email: checked })}
            disabled={isLoading || !masterEmailEnabled}
          />
          <Label htmlFor={`${settingKey}_email`}>Email</Label>
        </div>
        {hasDigest && (
          <div className="flex items-center space-x-2">
            <Select
              value={currentSetting.email_digest_preference || 'immediate'}
              onValueChange={(value) => onSettingChange(settingKey, { email_digest_preference: value as NotificationTypeSetting['email_digest_preference'] })}
              disabled={isLoading || !masterEmailEnabled || !currentSetting.email}
            >
              <SelectTrigger id={`${settingKey}_digest`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="immediate">Immediate</SelectItem>
                <SelectItem value="daily">Daily Digest</SelectItem>
                <SelectItem value="weekly">Weekly Digest</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    </div>
  );
};

// Component for Notifications Tab (Main definition)
const NotificationsTab: React.FC<{
  currentSettings: UserNotificationSettings;
  onSettingsChange: (newSettings: Partial<UserNotificationSettings>) => void;
  isLoading: boolean;
}> = ({ currentSettings, onSettingsChange, isLoading }) => {
  const handleSingleSettingChange = (
    key: keyof UserNotificationSettings, 
    value: Partial<NotificationTypeSetting> | boolean
  ) => {
    onSettingsChange({ [key]: value });
  };
  
  const handleSpecificTypeChange = (
    key: keyof Omit<UserNotificationSettings, 'master_in_app_enabled' | 'master_email_enabled' | 'product_updates_from_shadowme'>, 
    newSettingChanges: Partial<NotificationTypeSetting>
  ) => {
    onSettingsChange({
      [key]: {
        ...(currentSettings[key] as NotificationTypeSetting),
        ...newSettingChanges,
      }
    });
  }

  const notificationCategories: Array<{
    label: string; 
    key: keyof Omit<UserNotificationSettings, 'master_in_app_enabled' | 'master_email_enabled' | 'product_updates_from_shadowme'>;
    hasDigest?: boolean;
  }> = [
    { label: "Friend Requests", key: "friendship_request" },
    { label: "Friendship Accepted", key: "friendship_accepted" },
    { label: "Post Liked", key: "post_liked" },
    { label: "Post Commented / Replied", key: "post_commented" },
    { label: "Mentions", key: "mentions_in_posts_comments" },
    { label: "Shadow Session Invitations", key: "shadow_session_invitations" },
    { label: "Shadow Session Reminders/Starts", key: "shadow_session_reminders_starts" },
    { label: "Space (Group) Invites", key: "group_invites" },
    { label: "Circle (Friend Group) Invites", key: "friend_group_invites" },
    { label: "New Posts from Followed Users", key: "new_posts_from_followed_users", hasDigest: false },
    { label: "New Posts in Joined Spaces", key: "new_posts_in_joined_spaces", hasDigest: false },
    { label: "New Posts in Joined Circles", key: "new_posts_in_joined_circles", hasDigest: false },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notifications</CardTitle>
        <CardDescription>Choose what you want to be notified about and where.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4 p-4 border rounded-md">
            <h3 className="text-lg font-medium">Master Controls</h3>
            <div className="flex items-center space-x-2">
                <Switch 
                    id="master_in_app_enabled"
                    checked={currentSettings.master_in_app_enabled}
                    onCheckedChange={(checked) => handleSingleSettingChange('master_in_app_enabled', checked)}
                    disabled={isLoading}
                />
                <Label htmlFor="master_in_app_enabled">Enable All In-App Notifications</Label>
            </div>
            <div className="flex items-center space-x-2">
                <Switch 
                    id="master_email_enabled"
                    checked={currentSettings.master_email_enabled}
                    onCheckedChange={(checked) => handleSingleSettingChange('master_email_enabled', checked)}
                    disabled={isLoading}
                />
                <Label htmlFor="master_email_enabled">Enable All Email Notifications</Label>
            </div>
        </div>

        {notificationCategories.map(cat => (
          <NotificationSettingRow 
            key={cat.key}
            label={cat.label}
            settingKey={cat.key}
            currentSetting={currentSettings[cat.key] as NotificationTypeSetting}
            onSettingChange={handleSpecificTypeChange}
            isLoading={isLoading}
            masterInAppEnabled={currentSettings.master_in_app_enabled}
            masterEmailEnabled={currentSettings.master_email_enabled}
            hasDigest={cat.hasDigest}
          />
        ))}
        
        <div className="space-y-3 py-3 border-b last:border-b-0">
            <Label className="font-semibold text-base">Platform Updates</Label>
            <div className="flex items-center space-x-2 pl-2 sm:pl-4">
                <Switch
                    id="product_updates_from_shadowme_email"
                    checked={currentSettings.master_email_enabled && currentSettings.product_updates_from_shadowme.email}
                    onCheckedChange={(checked) => onSettingsChange({ product_updates_from_shadowme: { email: checked } })}
                    disabled={isLoading || !currentSettings.master_email_enabled}
                />
                <Label htmlFor="product_updates_from_shadowme_email">Receive Product Update Emails from ShadowMe</Label>
            </div>
        </div>

        <div className="space-y-2 pt-4">
            <Label className="font-semibold text-base">Important Account Activity & Security Alerts</Label>
            <p className="text-sm text-muted-foreground pl-2 sm:pl-4">
                For your security, email notifications for important account activity and security alerts are always enabled and cannot be turned off.
            </p>
        </div>
      </CardContent>
    </Card>
  );
};

// Component for Help & Support Tab
const HelpSupportTab: React.FC = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Help & Support</CardTitle>
        <CardDescription>Find answers to your questions and get help.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h3 className="font-semibold mb-2">Frequently Asked Questions (FAQ)</h3>
          <p>Have a question? Our <a href="/faq" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">FAQ page</a> might have the answer.</p>
          {/* TODO: Create an actual /faq page or link to an external one */}
        </div>
        <div>
          <h3 className="font-semibold mb-2">Report an Issue</h3>
          <p>Encountered a bug or have a problem? Please <a href="mailto:support@example.com?subject=Issue Report" className="text-primary hover:underline">email our support team</a>.</p>
          {/* Replace with actual support email or link to a bug reporting system */}
        </div>
        <div>
          <h3 className="font-semibold mb-2">Contact Us</h3>
          <p>For other inquiries, you can reach out to <a href="mailto:contact@example.com" className="text-primary hover:underline">contact@example.com</a>.</p>
        </div>
      </CardContent>
    </Card>
  );
};

// Component for About Tab
const AboutTab: React.FC = () => {
  const appVersion = "1.0.0-beta"; // This could come from package.json or an environment variable

  return (
    <Card>
      <CardHeader>
        <CardTitle>About ShadowMe</CardTitle>
        <CardDescription>Information about the application.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h3 className="font-semibold">Application Version</h3>
          <p>{appVersion}</p>
        </div>
        <div>
          <h3 className="font-semibold">Developed By</h3>
          <p>The ShadowMe Team</p> 
          {/* Or your name/company */}
        </div>
        <div className="space-y-1">
          <h3 className="font-semibold">Legal</h3>
          <p><a href="/terms-of-service" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Terms of Service</a></p>
          <p><a href="/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Privacy Policy</a></p>
          {/* TODO: Create actual /terms-of-service and /privacy-policy pages or link to external ones */}
        </div>
        <div>
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} ShadowMe. All rights reserved.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

const SettingsPage: React.FC = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [settings, setSettings] = useState<UserSettings>({
    preferences: defaultPreferences,
    notificationSettings: defaultNotificationSettings,
  });
  const [profileData, setProfileData] = useState<Partial<Profile>>({
    display_name: user?.profile?.display_name,
    bio: user?.profile?.bio,
    avatar_url: user?.profile?.avatar_url,
  });

  useEffect(() => {
    const fetchInitialData = async () => {
      setIsLoading(true);
      try {
        const settingsResponse = await apiRequest('GET', '/api/user/settings');
        if (settingsResponse.ok) {
          const data = await settingsResponse.json();
          const mergedNotificationSettings = { ...defaultNotificationSettings };
          if (data.notificationSettings) {
            for (const key in defaultNotificationSettings) {
              if (data.notificationSettings[key] !== undefined) {
                (mergedNotificationSettings as any)[key] = 
                  typeof (defaultNotificationSettings as any)[key] === 'object' && (defaultNotificationSettings as any)[key] !== null && !(Array.isArray((defaultNotificationSettings as any)[key]))
                  ? { ...(defaultNotificationSettings as any)[key], ...(data.notificationSettings[key]) }
                  : data.notificationSettings[key];
              } 
            }
            mergedNotificationSettings.master_in_app_enabled = data.notificationSettings.master_in_app_enabled !== undefined 
                ? data.notificationSettings.master_in_app_enabled 
                : defaultNotificationSettings.master_in_app_enabled;
            mergedNotificationSettings.master_email_enabled = data.notificationSettings.master_email_enabled !== undefined
                ? data.notificationSettings.master_email_enabled
                : defaultNotificationSettings.master_email_enabled;
            if (data.notificationSettings.product_updates_from_shadowme !== undefined) {
                 mergedNotificationSettings.product_updates_from_shadowme = { ...defaultNotificationSettings.product_updates_from_shadowme, ...data.notificationSettings.product_updates_from_shadowme };
            } else {
                mergedNotificationSettings.product_updates_from_shadowme = defaultNotificationSettings.product_updates_from_shadowme;
            }
          }
          setSettings({
            preferences: { ...defaultPreferences, ...(data.preferences || {}) },
            notificationSettings: mergedNotificationSettings,
          });
        } else {
          toast({ title: "Error fetching settings", description: "Could not load your settings.", variant: "destructive" });
        }
        if (user?.user_id) {
          const profileResponse = await apiRequest('GET', `/api/users/${user.user_id}`);
          if (profileResponse.ok) {
            const fetchedUser = await profileResponse.json();
            setProfileData({
              display_name: fetchedUser.profile?.display_name,
              bio: fetchedUser.profile?.bio,
              avatar_url: fetchedUser.profile?.avatar_url,
            });
          } else {
            console.error("Failed to fetch updated profile data in SettingsPage.");
          }
        }
      } catch (error) {
        toast({ title: "Network Error", description: "Failed to connect to server.", variant: "destructive" });
      }
      setIsLoading(false);
    };
    if (user) {
      fetchInitialData();
    } else {
      setIsLoading(false);
    }
  }, [toast, user, user?.profile?.bio, user?.profile?.avatar_url, user?.profile?.display_name]);
  
  const handleNotificationSettingsChange = (newNotifSettings: Partial<UserNotificationSettings>) => {
    const updatedNotifSettings = { ...settings.notificationSettings, ...newNotifSettings };
    for (const key in newNotifSettings) {
        if (typeof newNotifSettings[key as keyof UserNotificationSettings] === 'object' && newNotifSettings[key as keyof UserNotificationSettings] !== null) {
            (updatedNotifSettings as any)[key] = {
                ...(settings.notificationSettings as any)[key],
                ...(newNotifSettings as any)[key]
            };
        }
    }
    setSettings((prev: UserSettings) => ({ ...prev, notificationSettings: updatedNotifSettings }));
    handleSettingsSave({ notificationSettings: updatedNotifSettings });
  };

  const handleSettingsSave = async (newPartialSettings: Partial<UserSettings>) => {
    setIsLoading(true);
    try {
      const payload: any = {};
      if (newPartialSettings.preferences) payload.preferences = newPartialSettings.preferences;
      if (newPartialSettings.notificationSettings) payload.notificationSettings = newPartialSettings.notificationSettings;

      const response = await apiRequest('PUT', '/api/user/settings', payload);
      const data = await response.json();
      if (response.ok) {
        toast({ title: "Settings Saved", description: "Your preferences have been updated." });
        setSettings((prev: UserSettings) => ({
          preferences: { ...prev.preferences, ...(data.preferences || {}) },
          notificationSettings: { ...prev.notificationSettings, ...(data.notificationSettings || {}) },
        }));
      } else {
        toast({ title: "Save Failed", description: data.message || "Could not save settings.", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Network Error", description: "Failed to save settings.", variant: "destructive" });
    }
    setIsLoading(false);
  };

  const handlePreferencesChange = (newPrefs: Partial<UserPreferences>) => {
    const updatedPreferences = { ...settings.preferences, ...newPrefs };
    setSettings((prev: UserSettings) => ({ ...prev, preferences: updatedPreferences }));
    handleSettingsSave({ preferences: updatedPreferences });
  };

  const handleProfileDataChange = async (newProfileData: Partial<Profile>) => {
    if (!user?.user_id) return;
    setIsLoading(true);
    try {
      const response = await apiRequest('PUT', `/api/users/${user.user_id}/profile`, newProfileData);
      const data = await response.json();
      if (response.ok) {
        toast({ title: "Profile Updated", description: "Your profile information has been saved." });
        setProfileData(prev => ({ ...prev, ...data }));
      } else {
        toast({ title: "Profile Update Failed", description: data.message || "Could not save profile.", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Network Error", description: "Failed to update profile.", variant: "destructive" });
    }
    setIsLoading(false);
  };
  
  const handleAvatarUpload = async (file: File) => {
    if (!user?.user_id) return;
    setIsLoading(true);
    const formData = new FormData();
    formData.append('avatar', file);

    try {
      const response = await apiRequest('POST', `/api/users/${user.user_id}/avatar`, formData);
      const data = await response.json();
      if (response.ok) {
        toast({ title: "Avatar Updated", description: "Your new avatar has been saved." });
        setProfileData(prev => ({ ...prev, avatar_url: data.avatar_url })); 
      } else {
        toast({ title: "Avatar Upload Failed", description: data.message || "Could not upload avatar.", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Network Error", description: "Failed to upload avatar.", variant: "destructive" });
    }
    setIsLoading(false);
  };

  return (
    <MainLayout showLeftSidebar={false} showRightSidebar={false}>
      <div className="container mx-auto p-4 md:p-8">
        <h1 className="text-3xl font-bold mb-8">Settings</h1>
        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 lg:grid-cols-7 mb-6">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="account">Account</TabsTrigger>
            <TabsTrigger value="preferences">Preferences</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="privacy">Privacy & Sharing</TabsTrigger>
            <TabsTrigger value="help">Help & Support</TabsTrigger>
            <TabsTrigger value="about">About</TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <ProfileTab 
              currentProfile={{...profileData, email: user?.email }}
              currentPrefs={settings.preferences}
              onProfileChange={handleProfileDataChange}
              onPrefsChange={handlePreferencesChange}
              onAvatarChange={handleAvatarUpload}
              isLoading={isLoading}
              authUserId={user?.user_id}
            />
          </TabsContent>
          <TabsContent value="account">
              <AccountTab 
                  currentPrefs={settings.preferences} 
                  onPrefsChange={handlePreferencesChange} 
                  isLoading={isLoading} 
                  userEmail={user?.email}
              />
          </TabsContent>
          <TabsContent value="preferences">
              <PreferencesTab 
                  currentPrefs={settings.preferences} 
                  onPrefsChange={handlePreferencesChange} 
                  isLoading={isLoading} 
              />
          </TabsContent>
          <TabsContent value="notifications">
              <NotificationsTab 
                  currentSettings={settings.notificationSettings} 
                  onSettingsChange={handleNotificationSettingsChange} 
                  isLoading={isLoading} 
              />
          </TabsContent>
          <TabsContent value="privacy">
              <PrivacySharingTab 
                  currentPrefs={settings.preferences} 
                  onPrefsChange={handlePreferencesChange} 
                  isLoading={isLoading} 
              />
          </TabsContent>
          <TabsContent value="help"><HelpSupportTab /></TabsContent>
          <TabsContent value="about"><AboutTab /></TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
};

export default SettingsPage;

// Minimal Profile type definition (already present)
// interface Profile { ... } 
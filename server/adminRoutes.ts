import express, { Router, Request, Response, NextFunction } from 'express';
import { db } from './db'; // Assuming db instance is exported from db.ts
import { system_settings, smtpEncryptionEnum } from '../shared/schema';
import { eq } from 'drizzle-orm';
import { isAuthenticated, isRole } from './auth'; // Assuming auth middleware
import nodemailer from 'nodemailer';
import crypto from 'crypto';

const router = Router();

// TODO: Securely manage this key - ideally from environment variables
const ENCRYPTION_KEY = process.env.SMTP_SECRET_KEY || 'default_secret_key_32_chars_!!'; // Must be 32 chars for AES-256
const IV_LENGTH = 16; // For AES, this is always 16

function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
}

function decrypt(text: string): string {
  try {
    const parts = text.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted text format');
    }
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encryptedText = parts[2];
    const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY), iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('Decryption failed:', error);
    throw new Error('Decryption failed');
  }
}

interface SmtpSettings {
  host: string;
  port: number;
  username?: string;
  password?: string; // Password will be encrypted when stored
  encryption: typeof smtpEncryptionEnum.enumValues[number];
  fromEmail: string;
  fromName: string;
}

// Middleware to protect admin routes - only Lightkeepers
const ensureLightkeeper = isRole('admin'); // 'admin' corresponds to Lightkeeper

// GET /api/ark/smtp-settings
router.get('/smtp-settings', isAuthenticated, ensureLightkeeper, async (req: Request, res: Response) => {
  try {
    const result = await db.select()
      .from(system_settings)
      .where(eq(system_settings.key, 'smtp_config'))
      .limit(1);

    if (result.length === 0 || !result[0].settings_blob) {
      return res.status(404).json({ message: 'SMTP settings not found.' });
    }

    // Type assertion for settings_blob
    const settings = result[0].settings_blob as unknown as SmtpSettings;
    
    // Never send the password, even if it were stored directly (it's encrypted)
    const { password, ...settingsToReturn } = settings;

    res.json({
        ...settingsToReturn,
        passwordSet: !!password // Indicate if password is set without sending it
    });
  } catch (error) {
    console.error('Error fetching SMTP settings:', error);
    res.status(500).json({ message: 'Failed to fetch SMTP settings' });
  }
});

// POST /api/ark/smtp-settings
router.post('/smtp-settings', isAuthenticated, ensureLightkeeper, async (req: Request, res: Response) => {
  const { host, port, username, password, encryption, fromEmail, fromName } = req.body as SmtpSettings;

  if (!host || !port || !encryption || !fromEmail || !fromName) {
    return res.status(400).json({ message: 'Missing required SMTP fields.' });
  }

  if (!smtpEncryptionEnum.enumValues.includes(encryption)) {
    return res.status(400).json({ message: 'Invalid encryption type.' });
  }

  try {
    let encryptedPassword = '';
    if (password) {
      encryptedPassword = encrypt(password);
    }

    const newSettings: SmtpSettings = {
      host,
      port: Number(port),
      username,
      fromEmail,
      fromName,
      encryption,
    };
    if (password) { // Only include password in the blob if a new one was provided
        (newSettings as any).password = encryptedPassword;
    }


    // Upsert functionality: Update if 'smtp_config' exists, else insert.
    await db.insert(system_settings)
      .values({
        key: 'smtp_config',
        settings_blob: newSettings,
        updated_at: new Date(),
      })
      .onConflictDoUpdate({
        target: system_settings.key,
        set: { 
            settings_blob: newSettings,
            updated_at: new Date()
        },
        where: eq(system_settings.key, 'smtp_config'),
      });

    res.json({ message: 'SMTP settings saved successfully.' });
  } catch (error) {
    console.error('Error saving SMTP settings:', error);
    // Check for Drizzle-specific errors or other known error types if needed
    res.status(500).json({ message: 'Failed to save SMTP settings' });
  }
});

// POST /api/ark/smtp-test
router.post('/smtp-test', isAuthenticated, ensureLightkeeper, async (req: Request, res: Response) => {
  const { toEmail } = req.body;

  if (!toEmail) {
    return res.status(400).json({ message: 'Recipient email is required for testing.' });
  }

  try {
    const result = await db.select()
      .from(system_settings)
      .where(eq(system_settings.key, 'smtp_config'))
      .limit(1);

    if (result.length === 0 || !result[0].settings_blob) {
      return res.status(404).json({ message: 'SMTP settings not configured. Please save settings first.' });
    }
    
    const storedSettings = result[0].settings_blob as unknown as SmtpSettings & { password?: string };

    if (!storedSettings.host || !storedSettings.password) {
        return res.status(400).json({ message: 'SMTP host or password not configured properly.' });
    }

    const decryptedPassword = decrypt(storedSettings.password);

    const transporter = nodemailer.createTransport({
      host: storedSettings.host,
      port: storedSettings.port,
      secure: storedSettings.encryption === 'ssl' || storedSettings.encryption === 'tls', // true for 465, false for other ports
      auth: {
        user: storedSettings.username,
        pass: decryptedPassword,
      },
      // Add TLS options if encryption is 'tls' and port is 587 (common for STARTTLS)
      ...(storedSettings.encryption === 'tls' && { tls: { ciphers: 'SSLv3' } }) 
    });

    await transporter.verify(); // Verify connection configuration

    await transporter.sendMail({
      from: `"${storedSettings.fromName}" <${storedSettings.fromEmail}>`,
      to: toEmail,
      subject: 'Test Email from ShadowMe Platform',
      text: 'This is a test email to confirm your SMTP settings are configured correctly for the ShadowMe platform.',
      html: '<p>This is a test email to confirm your SMTP settings are configured correctly for the ShadowMe platform.</p>',
    });

    res.json({ message: `Test email sent successfully to ${toEmail}.` });
  } catch (error) {
    console.error('Failed to send test email:', error);
    // Provide more specific error messages if possible
    if (error instanceof Error) {
        return res.status(500).json({ message: `Failed to send test email: ${error.message}` });
    }
    res.status(500).json({ message: 'Failed to send test email due to an unknown error.' });
  }
});


export default router; 
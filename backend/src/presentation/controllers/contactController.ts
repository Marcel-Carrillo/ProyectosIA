import { Request, Response, NextFunction } from 'express';
import { sendContactEmail } from '../../infrastructure/email/emailService';

export async function submitContact(req: Request, res: Response, next: NextFunction) {
  try {
    const { name, email, subject, message } = req.body as {
      name?: string;
      email?: string;
      subject?: string;
      message?: string;
    };

    if (!name?.trim() || !email?.trim() || !subject?.trim() || !message?.trim()) {
      res.status(400).json({
        success: false,
        error: { message: 'name, email, subject and message are required', code: 'VALIDATION_ERROR' },
      });
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({
        success: false,
        error: { message: 'Invalid email address', code: 'VALIDATION_ERROR' },
      });
      return;
    }

    await sendContactEmail({ name: name.trim(), email: email.trim(), subject: subject.trim(), message: message.trim() });

    res.json({ success: true, data: { message: 'Message sent successfully' } });
  } catch (err) {
    next(err);
  }
}

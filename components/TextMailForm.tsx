"use client";

import type { ChangeEvent, FormEvent } from 'react';
import { useState } from 'react';
import { Mail, Send, Sparkles, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type FormState = {
  recipientName: string;
  recipientEmail: string;
  subject: string;
  messageText: string;
};

const initialState: FormState = {
  recipientName: '',
  recipientEmail: '',
  subject: '',
  messageText: '',
};

export default function TextMailForm() {
  const [form, setForm] = useState<FormState>(initialState);
  const [status, setStatus] = useState<{ type: 'idle' | 'success' | 'error'; message: string }>({
    type: 'idle',
    message: '',
  });
  const [loading, setLoading] = useState(false);

  const updateField = (key: keyof FormState) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
  };

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setStatus({ type: 'idle', message: '' });

    try {
      const response = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await response.json();

      if (!response.ok) {
        setStatus({ type: 'error', message: data?.error ?? 'Email could not be sent.' });
        return;
      }

      setStatus({ type: 'success', message: data?.message ?? 'Email sent successfully.' });
      setForm(initialState);
    } catch (error) {
      setStatus({
        type: 'error',
        message: error instanceof Error ? error.message : 'Unexpected error while sending email.',
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#07070f] px-4 py-12 text-white sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <section className="text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-indigo-300">
            <Sparkles className="h-3.5 w-3.5" /> Plain Text Email Sender
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">Send simple email messages</h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-slate-400 sm:text-base">
            Compose a plain text message, send it through Gmail, and keep the delivery flow server-side only.
            No attachments, no HTML, and no extra formatting.
          </p>
        </section>

        <Card className="border-white/10 bg-white/[0.04] backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-white">Compose email</CardTitle>
            <CardDescription className="text-slate-400">
              Enter the recipient details, subject, and plain text message.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-5" onSubmit={handleSubmit}>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-200">Recipient name</span>
                  <div className="relative">
                    <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <input
                      className="w-full rounded-xl border border-white/10 bg-black/20 py-3 pl-10 pr-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-indigo-400"
                      placeholder="Jane Doe"
                      value={form.recipientName}
                      onChange={updateField('recipientName')}
                      required
                    />
                  </div>
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-200">Recipient email</span>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <input
                      className="w-full rounded-xl border border-white/10 bg-black/20 py-3 pl-10 pr-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-indigo-400"
                      placeholder="jane@example.com"
                      type="email"
                      value={form.recipientEmail}
                      onChange={updateField('recipientEmail')}
                      required
                    />
                  </div>
                </label>
              </div>

              <label className="space-y-2 block">
                <span className="text-sm font-medium text-slate-200">Subject</span>
                <input
                  className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-indigo-400"
                  placeholder="A quick update"
                  value={form.subject}
                  onChange={updateField('subject')}
                  required
                />
              </label>

              <label className="space-y-2 block">
                <span className="text-sm font-medium text-slate-200">Message</span>
                <textarea
                  className="min-h-40 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-indigo-400"
                  placeholder="Write a short plain text message..."
                  value={form.messageText}
                  onChange={updateField('messageText')}
                  required
                />
              </label>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs leading-relaxed text-slate-500">
                  Plain text only. Credentials stay on the server through GMAIL_USER and GMAIL_APP_PASSWORD.
                </p>

                <Button
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white hover:bg-indigo-500"
                  disabled={loading}
                  type="submit"
                >
                  <Send className="h-4 w-4" />
                  {loading ? 'Sending…' : 'Send email'}
                </Button>
              </div>

              {status.message ? (
                <div
                  className={
                    status.type === 'success'
                      ? 'rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300'
                      : 'rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300'
                  }
                >
                  {status.message}
                </div>
              ) : null}
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

// src/routes/(app)/api/forgot-password/+server.js
// Stores a password-reset request in Supabase KV (rr:{username}).
// Admins see pending requests in the Admin Panel and set a temp password there.
// No external email service required.

import { json } from '@sveltejs/kit';
import { findUserByEmail, sbSet } from '$lib/api/supabase.js';

export async function POST({ request }) {
  const { email } = await request.json().catch(() => ({}));

  if (!email || !/.+@.+\..+/.test(email)) {
    return json({ error: 'Valid email required.' }, { status: 400 });
  }

  try {
    const match = await findUserByEmail(email.trim().toLowerCase());
    if (match) {
      await sbSet('rr:' + match.username, JSON.stringify({
        email:       email.trim().toLowerCase(),
        username:    match.username,
        requestedAt: new Date().toISOString(),
      }));
    }
    // Always return ok — never reveal whether an email has an account
  } catch {
    // Silently swallow — don't expose internals to the client
  }

  return json({ ok: true });
}

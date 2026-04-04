'use server';
// Syncs Clerk user data into MongoDB via the API route
export async function syncUser() {
  try {
    await fetch('/api/users/sync', { method: 'POST', cache: 'no-store' });
  } catch (err) {
    console.error('syncUser failed:', err);
  }
}
<script>
  import { onMount } from 'svelte';
  import { currentPage } from '$lib/stores/ui.js';
  import { currentUser, updatePassword, updateEmail } from '$lib/stores/auth.js';

  let loading = $state(true);
  let loadError = $state('');
  let currentEmail = $state('');

  // Change Password state
  let pwCurrent = $state('');
  let pwNew = $state('');
  let pwConfirm = $state('');
  let pwError = $state('');
  let pwSuccess = $state('');
  let pwSubmitting = $state(false);

  // Update Email state
  let emailInput = $state('');
  let emailError = $state('');
  let emailSuccess = $state('');
  let emailSubmitting = $state(false);

  onMount(async () => {
    if (!$currentUser) { loading = false; return; }
    const { sbGet } = await import('$lib/api/supabase.js');
    try {
      const raw = await sbGet('u:' + $currentUser.username);
      const d = JSON.parse(raw);
      currentEmail = d.email || '';
      emailInput = d.email || '';
    } catch {
      loadError = 'Could not load account details.';
    }
    loading = false;
  });

  async function handlePasswordSubmit(e) {
    e.preventDefault();
    pwError = '';
    pwSuccess = '';
    if (!pwCurrent || !pwNew || !pwConfirm) { pwError = 'All fields are required.'; return; }
    if (pwNew.length < 6) { pwError = 'New password must be at least 6 characters.'; return; }
    if (pwNew !== pwConfirm) { pwError = 'New passwords do not match.'; return; }
    pwSubmitting = true;
    const result = await updatePassword($currentUser.username, pwCurrent, pwNew);
    pwSubmitting = false;
    if (result.ok) {
      pwCurrent = '';
      pwNew = '';
      pwConfirm = '';
      pwSuccess = 'Password updated successfully.';
    } else {
      pwError = result.error;
    }
  }

  async function handleEmailSubmit(e) {
    e.preventDefault();
    emailError = '';
    emailSuccess = '';
    if (!/.+@.+\..+/.test(emailInput)) { emailError = 'Valid email address required.'; return; }
    emailSubmitting = true;
    const result = await updateEmail($currentUser.username, emailInput);
    emailSubmitting = false;
    if (result.ok) {
      currentEmail = emailInput;
      emailSuccess = 'Email updated successfully.';
    } else {
      emailError = result.error;
    }
  }
</script>

<div class="acct-overlay">
  <div class="acct-wrap">

    <div style="display:flex;justify-content:flex-end">
      <button class="acct-back" onclick={() => currentPage.set('map')}>← Back to Map</button>
    </div>

    {#if !$currentUser}
      <div>
        <p class="acct-body">Sign in to access account settings.</p>
      </div>
    {:else if loading}
      <div class="acct-loading">Loading account details…</div>
    {:else if loadError}
      <div class="acct-load-error">{loadError}</div>
    {:else}

      <div>
        <div class="acct-kicker">Account</div>
        <h1 class="acct-title">Account Settings</h1>
        <p class="acct-body" style="color:#5c3d08">{$currentUser.username}</p>
      </div>

      <div class="acct-divider"></div>

      <!-- Change Password -->
      <div>
        <h2 class="acct-h2">Change Password</h2>
        <form class="acct-form" onsubmit={handlePasswordSubmit}>
          <div class="acct-field">
            <label class="acct-label" for="pw-current">Current Password</label>
            <input class="acct-input" id="pw-current" type="password" bind:value={pwCurrent} autocomplete="current-password" />
          </div>
          <div class="acct-field">
            <label class="acct-label" for="pw-new">New Password</label>
            <input class="acct-input" id="pw-new" type="password" bind:value={pwNew} autocomplete="new-password" />
          </div>
          <div class="acct-field">
            <label class="acct-label" for="pw-confirm">Confirm New Password</label>
            <input class="acct-input" id="pw-confirm" type="password" bind:value={pwConfirm} autocomplete="new-password" />
          </div>
          {#if pwError}<p class="acct-msg error">{pwError}</p>{/if}
          {#if pwSuccess}<p class="acct-msg success">{pwSuccess}</p>{/if}
          <button class="acct-submit" type="submit" disabled={pwSubmitting}>
            {pwSubmitting ? 'Updating…' : 'Update Password'}
          </button>
        </form>
      </div>

      <div class="acct-divider"></div>

      <!-- Update Email -->
      <div>
        <h2 class="acct-h2">Update Email</h2>
        <form class="acct-form" onsubmit={handleEmailSubmit}>
          <div class="acct-field">
            <label class="acct-label" for="email-input">Email Address</label>
            <input class="acct-input" id="email-input" type="email" bind:value={emailInput} autocomplete="email" />
          </div>
          {#if emailError}<p class="acct-msg error">{emailError}</p>{/if}
          {#if emailSuccess}<p class="acct-msg success">{emailSuccess}</p>{/if}
          <button class="acct-submit" type="submit" disabled={emailSubmitting}>
            {emailSubmitting ? 'Updating…' : 'Update Email'}
          </button>
        </form>
      </div>

    {/if}

  </div>
</div>

<style>
  .acct-overlay{flex:1;min-height:0;background:var(--bg);overflow-y:auto;text-align:left}
  .acct-wrap{width:100%;max-width:520px;margin:0 auto;padding:48px 28px 60px;display:flex;flex-direction:column;gap:36px}
  .acct-back{background:transparent;border:1px solid rgba(120,80,20,.25);border-radius:4px;padding:5px 13px;font-family:'Outfit',sans-serif;font-size:.74rem;color:#5c3d08;cursor:pointer;transition:all .13s}
  .acct-back:hover{background:rgba(92,61,8,.1);border-color:#5c3d08}
  .acct-kicker{font-size:.64rem;letter-spacing:.14em;text-transform:uppercase;color:#c9973a;margin-bottom:6px}
  .acct-title{font-family:'Playfair Display',serif;font-size:2rem;color:#0f2e14;margin-bottom:6px}
  .acct-h2{font-family:'Playfair Display',serif;font-size:1.35rem;color:#2a7d24;margin-bottom:18px}
  .acct-body{font-size:.85rem;color:#3a3a3a;line-height:1.85}
  .acct-divider{height:1px;background:rgba(120,80,20,.18)}
  .acct-loading{font-size:.8rem;color:#5c3d08;font-family:'Outfit',sans-serif;font-style:italic}
  .acct-load-error{font-size:.8rem;color:#c0392b;font-family:'Outfit',sans-serif}
  .acct-form{display:flex;flex-direction:column;gap:14px}
  .acct-field{display:flex;flex-direction:column;gap:5px}
  .acct-label{font-size:.68rem;letter-spacing:.08em;text-transform:uppercase;color:#c9973a}
  .acct-input{background:var(--panel2);border:1px solid var(--border);border-radius:5px;padding:8px 11px;font-family:'Outfit',sans-serif;font-size:.8rem;color:#1c1c1e;outline:none;transition:border-color .13s}
  .acct-input:focus{border-color:#c9973a}
  .acct-msg{font-size:.75rem;margin:0;line-height:1.5}
  .acct-msg.error{color:#c0392b}
  .acct-msg.success{color:#2a7d24}
  .acct-submit{align-self:flex-start;background:var(--panel3);border:1px solid var(--border);border-radius:4px;padding:7px 18px;font-family:'Outfit',sans-serif;font-size:.74rem;color:#c9973a;cursor:pointer;transition:all .13s}
  .acct-submit:hover:not(:disabled){background:var(--gold-hi);border-color:var(--gold)}
  .acct-submit:disabled{opacity:.5;cursor:not-allowed}
</style>

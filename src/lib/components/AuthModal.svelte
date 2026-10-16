<script>
  import { authOpen, authMode, authError, signIn, signUp, forgotPassword } from '$lib/stores/auth.js';
  import { get } from 'svelte/store';
  import { loadTrees, trees, loading } from '$lib/stores/trees.js';

  let username = '';
  let password = '';
  let email = '';
  let showForgot = false;
  let forgotEmail = '';
  let forgotState = ''; // '' | 'loading' | 'sent' | 'error'
  let forgotMsg = '';

  function switchTab(mode) {
    authMode.set(mode);
    authError.set('');
  }

  function closeModal() {
    authOpen.set(false);
    authError.set('');
    username = '';
    password = '';
    email = '';
    showForgot = false;
    forgotState = '';
    forgotMsg = '';
    forgotEmail = '';
  }

  async function doAuth() {
    const ok = $authMode === 'in'
      ? await signIn(username, password)
      : await signUp(username, password, email);
    if (ok) {
      username = ''; password = ''; email = '';
      // Re-load trees if they didn't populate before login
      if (!get(loading) && get(trees).length === 0) loadTrees();
    }
  }

  async function doForgot() {
    forgotState = 'loading';
    forgotMsg = '';
    const result = await forgotPassword(forgotEmail);
    if (result.ok) {
      forgotState = 'sent';
      forgotMsg = 'Request sent. The admin will contact you with a temporary password.';
    } else {
      forgotState = 'error';
      forgotMsg = result.error;
    }
  }

  function onKey(e) {
    if (e.key === 'Enter') {
      if (showForgot) doForgot();
      else doAuth();
    }
    if (e.key === 'Escape') closeModal();
  }
</script>

{#if $authOpen}
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="auth-modal" onkeydown={onKey}>
  <div class="auth-box">

    {#if showForgot}
      <!-- ── Forgot password view ─────────────────────────────── -->
      <div>
        <div class="auth-title">Reset Password</div>
        <div class="auth-desc">Enter your email address. The admin will be notified and will send you a temporary password.</div>
      </div>
      <div>
        <label class="inp-lbl" for="fp-email">Email Address</label>
        <!-- svelte-ignore a11y_autofocus -->
        <input class="inp" id="fp-email" type="email" placeholder="you@example.com"
          autocomplete="email" bind:value={forgotEmail} autofocus />
      </div>
      {#if forgotMsg}
        <div class="auth-err" class:auth-ok={forgotState === 'sent'}>{forgotMsg}</div>
      {/if}
      <div class="auth-btns">
        <button class="auth-cancel" onclick={() => { showForgot = false; forgotState = ''; forgotMsg = ''; forgotEmail = ''; }}>← Back</button>
        {#if forgotState !== 'sent'}
          <button class="auth-go" onclick={doForgot} disabled={forgotState === 'loading'}>
            {forgotState === 'loading' ? 'Sending…' : 'Send Request'}
          </button>
        {/if}
      </div>

    {:else}
      <!-- ── Sign in / Register view ──────────────────────────── -->
      <div>
        <div class="auth-title">Sign in for Access</div>
        <div class="auth-desc">Tasks like planting lists, bulk uploads, and condition updates require an account. Notes and photos are also stored per user and shared across sessions.</div>
      </div>
      <div class="auth-tabs">
        <button class="atab" class:on={$authMode === 'in'} onclick={() => switchTab('in')}>Sign In</button>
        <button class="atab" class:on={$authMode === 'up'} onclick={() => switchTab('up')}>Register</button>
      </div>
      <div>
        <label class="inp-lbl" for="a-user">{$authMode === 'in' ? 'Username or Email' : 'Username'}</label>
        <!-- svelte-ignore a11y_autofocus -->
        <input class="inp" id="a-user" type="text"
          placeholder={$authMode === 'in' ? 'username or you@email.com' : 'e.g. jane_field'}
          autocomplete={$authMode === 'in' ? 'username email' : 'off'}
          bind:value={username} autofocus />
      </div>
      <div>
        <label class="inp-lbl" for="a-pass">Password</label>
        <input class="inp" id="a-pass" type="password" placeholder="••••••••"
          bind:value={password} />
      </div>
      {#if $authMode === 'up'}
        <div>
          <label class="inp-lbl" for="a-email">Email Address</label>
          <input class="inp" id="a-email" type="email" placeholder="you@example.com"
            autocomplete="email" bind:value={email} />
        </div>
      {/if}
      {#if $authMode === 'in'}
        <div>
          <button class="forgot-link" onclick={() => { showForgot = true; authError.set(''); }}>Forgot password?</button>
        </div>
      {/if}
      {#if $authError}
        <div class="auth-err">{$authError}</div>
      {/if}
      <div class="auth-btns">
        <button class="auth-cancel" onclick={closeModal}>Cancel</button>
        <button class="auth-go" onclick={doAuth}>{$authMode === 'in' ? 'Sign In' : 'Register'}</button>
      </div>

    {/if}
  </div>
</div>
{/if}

<style>
  .auth-modal {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,.72);
    z-index: 9990;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .forgot-link {
    background: none;
    border: none;
    padding: 0;
    font-family: 'Outfit', sans-serif;
    font-size: .72rem;
    color: var(--gold);
    cursor: pointer;
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  .forgot-link:hover { opacity: .8; }
  .auth-ok { color: var(--canopy) !important; }
</style>

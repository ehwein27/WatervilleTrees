<script>
  import { onMount } from 'svelte';
  import { currentPage } from '$lib/stores/ui.js';
  import { currentUser } from '$lib/stores/auth.js';
  import { trees, hardDeleteTree } from '$lib/stores/trees.js';
  import {
    fetchAllowedEmails, addAllowedEmail, revokeEmailAccess,
    fetchAllUsers, sbGet, sbSet, upsertUserRole,
    fetchResetRequests, clearResetRequest, fetchActivityLog,
  } from '$lib/api/supabase.js';
  // ── Allowed emails ─────────────────────────────────────────────────────────
  let emails = $state([]);
  let emailsLoading = $state(true);
  let emailsError = $state('');
  let newEmail = $state('');
  let addingEmail = $state(false);
  let addEmailError = $state('');
  let addEmailSuccess = $state('');
  let removingEmail = $state('');

  // ── Users ──────────────────────────────────────────────────────────────────
  let users = $state([]);
  let usersLoading = $state(true);
  let usersError = $state('');

  // Email inline editing
  let editingEmailFor = $state(null);
  let editEmailValue = $state('');
  let savingEmail = $state(false);
  let emailSaveError = $state('');

  // Role toggling
  let togglingRoleFor = $state(null);

  // ── Password reset requests ────────────────────────────────────────────────
  let resetRequests = $state([]);
  let resetLoading = $state(true);
  let resetError = $state('');
  let settingTempFor = $state(null);   // username currently being given a temp password
  let tempPwValue = $state('');
  let savingTempPw = $state(false);
  let tempPwError = $state('');
  let lastResetDone = $state(null);    // { username, email, tempPw } shown after save

  // ── Activity log ───────────────────────────────────────────────────────────
  let activityLog = $state([]);
  let logLoading = $state(true);
  let logError = $state('');

  // ── Tree data view ─────────────────────────────────────────────────────────
  let treeSearch = $state('');
  let deletingTreeId = $state(null);

  onMount(async () => {
    await Promise.all([loadEmails(), loadUsers(), loadResets(), loadLog()]);
  });

  async function loadEmails() {
    emailsLoading = true;
    emailsError = '';
    try {
      emails = await fetchAllowedEmails();
    } catch {
      emailsError = 'Failed to load allowed emails.';
    }
    emailsLoading = false;
  }

  async function loadUsers() {
    usersLoading = true;
    usersError = '';
    try {
      users = await fetchAllUsers();
    } catch {
      usersError = 'Failed to load users.';
    }
    usersLoading = false;
  }

  async function loadLog() {
    logLoading = true;
    logError = '';
    try {
      activityLog = await fetchActivityLog();
    } catch {
      logError = 'Failed to load activity log.';
    }
    logLoading = false;
  }

  async function writeLog(action, details) {
    try {
      await fetch('/api/admin/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, performed_by: $currentUser?.username || null, details }),
      });
    } catch {}
  }

  async function loadResets() {
    resetLoading = true;
    resetError = '';
    try {
      resetRequests = await fetchResetRequests();
    } catch {
      resetError = 'Failed to load reset requests.';
    }
    resetLoading = false;
  }

  async function sha256(s) {
    const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
    return Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2, '0')).join('');
  }

  function startSetTempPw(req) {
    settingTempFor = req.username;
    tempPwValue = '';
    tempPwError = '';
    tempPwDone = '';
  }

  function cancelTempPw() {
    settingTempFor = null;
    tempPwError = '';
    tempPwDone = '';
  }

  async function saveTempPw(req) {
    if (tempPwValue.length < 4) { tempPwError = 'Password must be at least 4 characters.'; return; }
    savingTempPw = true;
    tempPwError = '';
    try {
      const raw = await sbGet('u:' + req.username);
      const d = JSON.parse(raw);
      const h = await sha256(tempPwValue);
      await sbSet('u:' + req.username, JSON.stringify({ ...d, h }));
      await clearResetRequest(req.username);
      lastResetDone = { username: req.username, email: req.email, tempPw: tempPwValue };
      settingTempFor = null;
      await writeLog('temp_password_set', { username: req.username });
      await Promise.all([loadResets(), loadLog()]);
    } catch {
      tempPwError = 'Failed to save password.';
    }
    savingTempPw = false;
  }

  async function dismissReset(req) {
    try {
      await clearResetRequest(req.username);
      await writeLog('reset_dismissed', { username: req.username });
      await Promise.all([loadResets(), loadLog()]);
    } catch {
      alert('Failed to dismiss.');
    }
  }

  async function handleAddEmail() {
    addEmailError = '';
    addEmailSuccess = '';
    const trimmed = newEmail.trim().toLowerCase();
    if (!/.+@.+\..+/.test(trimmed)) { addEmailError = 'Enter a valid email address.'; return; }
    addingEmail = true;
    try {
      await addAllowedEmail(trimmed, $currentUser?.username);
      newEmail = '';
      addEmailSuccess = `${trimmed} added.`;
      await loadEmails();
    } catch (e) {
      addEmailError = (e.message || '').includes('unique') || (e.message || '').includes('duplicate')
        ? 'This email is already on the list.'
        : 'Failed to add email.';
    }
    addingEmail = false;
  }

  async function handleRemoveEmail(email) {
    // Guard: block removing the last admin's email
    const targetUser = users.find(u => u.email?.toLowerCase() === email?.toLowerCase() && u.role === 'admin');
    if (targetUser) {
      const adminCount = users.filter(x => x.role === 'admin').length;
      if (adminCount <= 1) {
        alert('Cannot remove the last admin\'s access. Promote another user to admin first.');
        return;
      }
    }
    if (!confirm(`Remove ${email} from the allowed list?\n\nIf they have an account it will be permanently deleted.`)) return;
    removingEmail = email;
    try {
      await revokeEmailAccess(email, $currentUser?.username);
      await Promise.all([loadEmails(), loadUsers(), loadLog()]);
    } catch (e) {
      alert('Failed to remove: ' + (e.message || 'unknown error'));
    }
    removingEmail = '';
  }

  function startEditEmail(u) {
    editingEmailFor = u.username;
    editEmailValue = u.email || '';
    emailSaveError = '';
  }

  function cancelEditEmail() {
    editingEmailFor = null;
    emailSaveError = '';
  }

  async function saveEmail(u) {
    const trimmed = editEmailValue.trim().toLowerCase();
    if (trimmed && !/.+@.+\..+/.test(trimmed)) { emailSaveError = 'Invalid email address.'; return; }
    savingEmail = true;
    emailSaveError = '';
    try {
      const raw = await sbGet('u:' + u.username);
      const d = JSON.parse(raw);
      await sbSet('u:' + u.username, JSON.stringify({ ...d, email: trimmed }));
      if (trimmed) await addAllowedEmail(trimmed).catch(() => {});
      editingEmailFor = null;
      await Promise.all([loadUsers(), loadEmails()]);
    } catch {
      emailSaveError = 'Failed to save email.';
    }
    savingEmail = false;
  }

  async function toggleRole(u) {
    const newRole = u.role === 'admin' ? 'user' : 'admin';
    // Guard: block demoting the last admin
    if (newRole === 'user') {
      const adminCount = users.filter(x => x.role === 'admin').length;
      if (adminCount <= 1) {
        alert('Cannot demote the last admin. Promote another user to admin first.');
        return;
      }
    }
    if (!confirm(`Change ${u.username}'s role from "${u.role}" to "${newRole}"?`)) return;
    togglingRoleFor = u.username;
    try {
      const raw = await sbGet('u:' + u.username);
      const d = JSON.parse(raw);
      await sbSet('u:' + u.username, JSON.stringify({ ...d, role: newRole }));
      await upsertUserRole(u.username, newRole, $currentUser?.username, u.role);
      await Promise.all([loadUsers(), loadLog()]);
    } catch {
      alert('Failed to update role.');
    }
    togglingRoleFor = null;
  }

  async function handleDeleteTree(t) {
    if (!confirm(`Permanently delete Tree #${t.id} (${t.n || 'Unknown'})?\n\nThis cannot be undone.`)) return;
    deletingTreeId = t.id;
    try {
      await hardDeleteTree(t.id);
      await writeLog('tree_deleted', { tree_id: t.id, species: t.n || null });
      await loadLog();
    } catch (e) {
      alert('Delete failed: ' + (e.message || 'unknown error'));
    }
    deletingTreeId = null;
  }

  let filteredTrees = $derived(
    $trees.filter(t => !treeSearch.trim() || String(t.id) === treeSearch.trim())
  );

  function fmtAction(action) {
    return {
      email_added:        'Email added',
      email_removed:      'Email removed',
      role_changed:       'Role changed',
      tree_deleted:       'Tree deleted',
      temp_password_set:  'Temp password set',
      reset_dismissed:    'Reset dismissed',
    }[action] ?? action;
  }

  function fmtLogDetails(d) {
    if (!d) return '—';
    if (d.email) return d.email;
    if (d.username && d.from_role && d.to_role) return `${d.username}: ${d.from_role} → ${d.to_role}`;
    if (d.username && d.to_role) return `${d.username} → ${d.to_role}`;
    if (d.tree_id) return `Tree #${d.tree_id}${d.species ? ` (${d.species})` : ''}`;
    if (d.username) return d.username;
    return JSON.stringify(d);
  }

  function fmt(ds) {
    if (!ds) return '—';
    try { return new Date(ds).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
    catch { return ds; }
  }
</script>

<div class="adm-overlay">
  <div class="adm-wrap">

    <div style="display:flex;justify-content:flex-end">
      <button class="adm-back" onclick={() => currentPage.set('map')}>← Back to Map</button>
    </div>

    <div>
      <div class="adm-kicker">Admin</div>
      <div style="display:flex;align-items:center;gap:10px">
        <h1 class="adm-title">Admin Panel</h1>
      </div>
      <p class="adm-body">Manage access, users, and tree inventory data.</p>
    </div>

    <div class="adm-divider"></div>

    <!-- ── Pending Password Resets ──────────────────────────────────────── -->
    <div>
      <h2 class="adm-h2 adm-h2-reset">
        Password Resets
        {#if resetRequests.length > 0}
          <span class="adm-reset-count">{resetRequests.length}</span>
        {/if}
      </h2>
      <p class="adm-body">Users who clicked "Forgot password". Set a temporary password here, then email it to them directly.</p>

      {#if resetLoading}
        <div class="adm-loading">Loading…</div>
      {:else if resetError}
        <div class="adm-err-msg">{resetError} <button class="adm-retry" onclick={loadResets}>Retry</button></div>
      {:else}
        {#if lastResetDone}
          <div class="adm-reset-done">
            <span>✓ Temp password set for <strong>{lastResetDone.username}</strong>. Now email <strong>{lastResetDone.email}</strong> their temporary password:</span>
            <code class="adm-reset-pw-code">{lastResetDone.tempPw}</code>
            <button class="adm-cancel-btn" onclick={() => lastResetDone = null} title="Dismiss">✕</button>
          </div>
        {/if}
        {#if resetRequests.length === 0 && !lastResetDone}
          <div class="adm-reset-empty">No pending reset requests.</div>
        {:else if resetRequests.length > 0}
        <div class="adm-reset-list">
          {#each resetRequests as req (req.username)}
            <div class="adm-reset-card">
              <div class="adm-reset-top">
                <div>
                  <div class="adm-reset-user">{req.username}</div>
                  <div class="adm-reset-email">{req.email}</div>
                  <div class="adm-reset-time">Requested {fmt(req.requestedAt)}</div>
                </div>
                <div class="adm-reset-actions">
                  {#if settingTempFor !== req.username}
                    <button class="adm-add-btn adm-reset-set-btn"
                      onclick={() => startSetTempPw(req)}>
                      Set Temp Password
                    </button>
                    <button class="adm-cancel-btn adm-reset-dismiss"
                      onclick={() => dismissReset(req)}
                      title="Dismiss without resetting">✕</button>
                  {/if}
                </div>
              </div>

              {#if settingTempFor === req.username}
                <div class="adm-reset-pw-row">
                  <input class="adm-input adm-inline-input adm-reset-pw-input"
                    type="text"
                    placeholder="Temporary password…"
                    bind:value={tempPwValue}
                    onkeydown={(e) => { if (e.key === 'Enter') saveTempPw(req); if (e.key === 'Escape') cancelTempPw(); }} />
                  <button class="adm-save-btn" onclick={() => saveTempPw(req)} disabled={savingTempPw}>
                    {savingTempPw ? 'Saving…' : 'Save & Clear'}
                  </button>
                  <button class="adm-cancel-btn" onclick={cancelTempPw}>✕</button>
                </div>
                {#if tempPwError}<div class="adm-msg error">{tempPwError}</div>{/if}
              {/if}

            </div>
          {/each}
        </div>
        {/if}
      {/if}
    </div>

    <div class="adm-divider"></div>

    <!-- ── Allowed Emails ─────────────────────────────────────────────────── -->
    <div>
      <h2 class="adm-h2">Allowed Emails</h2>
      <p class="adm-body">Only users whose email is on this list can register. Removing an email also permanently deletes their account if one exists.</p>

      {#if emailsLoading}
        <div class="adm-loading">Loading…</div>
      {:else if emailsError}
        <div class="adm-err-msg">{emailsError} <button class="adm-retry" onclick={loadEmails}>Retry</button></div>
      {:else}
        <div class="adm-table-wrap">
          <table class="adm-table">
            <thead>
              <tr>
                <th>Email</th>
                <th style="width:130px">Date Added</th>
                <th style="width:80px"></th>
              </tr>
            </thead>
            <tbody>
              {#each emails as row (row.id)}
                <tr>
                  <td class="adm-td-email">{row.email}</td>
                  <td class="adm-td-date">{fmt(row.created_at)}</td>
                  <td style="text-align:center">
                    <button class="adm-remove-btn"
                      disabled={removingEmail === row.email}
                      onclick={() => handleRemoveEmail(row.email)}>
                      {removingEmail === row.email ? '…' : 'Remove'}
                    </button>
                  </td>
                </tr>
              {:else}
                <tr><td colspan="3" class="adm-empty">No emails on list.</td></tr>
              {/each}
            </tbody>
          </table>
        </div>

        <div class="adm-add-row">
          <input class="adm-input" type="email" placeholder="new@email.com"
            bind:value={newEmail}
            onkeydown={(e) => e.key === 'Enter' && handleAddEmail()} />
          <button class="adm-add-btn" onclick={handleAddEmail} disabled={addingEmail}>
            {addingEmail ? 'Adding…' : 'Add Email'}
          </button>
        </div>
        {#if addEmailError}<p class="adm-msg error">{addEmailError}</p>{/if}
        {#if addEmailSuccess}<p class="adm-msg success">{addEmailSuccess}</p>{/if}
      {/if}
    </div>

    <div class="adm-divider"></div>

    <!-- ── User Accounts ──────────────────────────────────────────────────── -->
    <div>
      <h2 class="adm-h2">User Accounts</h2>
      <p class="adm-body">All registered accounts. To remove a user, remove their email from the Allowed Emails list above.</p>

      {#if usersLoading}
        <div class="adm-loading">Loading…</div>
      {:else if usersError}
        <div class="adm-err-msg">{usersError} <button class="adm-retry" onclick={loadUsers}>Retry</button></div>
      {:else}
        <div class="adm-table-wrap">
          <table class="adm-table">
            <thead>
              <tr>
                <th style="width:130px">Username</th>
                <th>Email</th>
                <th style="width:140px">Role</th>
                <th style="width:130px">Joined</th>
              </tr>
            </thead>
            <tbody>
              {#each users as u (u.username)}
                <tr>
                  <td class="adm-td-mono">{u.username}</td>
                  <td class="adm-td-email">
                    {#if editingEmailFor === u.username}
                      <div class="adm-inline-edit">
                        <input class="adm-input adm-inline-input" type="email"
                          bind:value={editEmailValue}
                          onkeydown={(e) => { if (e.key === 'Enter') saveEmail(u); if (e.key === 'Escape') cancelEditEmail(); }} />
                        <button class="adm-save-btn" onclick={() => saveEmail(u)} disabled={savingEmail}>
                          {savingEmail ? '…' : 'Save'}
                        </button>
                        <button class="adm-cancel-btn" onclick={cancelEditEmail}>✕</button>
                      </div>
                      {#if emailSaveError}<div class="adm-msg error" style="margin-top:3px">{emailSaveError}</div>{/if}
                    {:else}
                      <div class="adm-email-row">
                        <span>{u.email || '—'}</span>
                        <button class="adm-edit-btn" onclick={() => startEditEmail(u)}>Edit</button>
                      </div>
                    {/if}
                  </td>
                  <td>
                    <div class="adm-role-row">
                      <span class="adm-badge" class:adm-badge-admin={u.role === 'admin'}>{u.role}</span>
                      <button class="adm-role-btn"
                        class:adm-role-btn-demote={u.role === 'admin'}
                        disabled={togglingRoleFor === u.username}
                        onclick={() => toggleRole(u)}>
                        {togglingRoleFor === u.username ? '…' : u.role === 'admin' ? 'Demote' : 'Promote'}
                      </button>
                    </div>
                  </td>
                  <td class="adm-td-date">{fmt(u.createdAt)}</td>
                </tr>
              {:else}
                <tr><td colspan="4" class="adm-empty">No user accounts yet.</td></tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </div>

    <div class="adm-divider"></div>

    <!-- ── Tree Inventory ─────────────────────────────────────────────────── -->
    <div>
      <h2 class="adm-h2">Tree Inventory</h2>
      <p class="adm-body">All {$trees.length} records. Enter a tree ID to jump to a specific record. Deletions are permanent.</p>

      <input class="adm-input adm-search" type="text"
        placeholder="Enter exact tree ID…"
        bind:value={treeSearch} />

      <div class="adm-table-wrap adm-tree-wrap">
        <table class="adm-table adm-tree-table">
          <thead>
            <tr>
              <th style="width:55px">ID</th>
              <th>Species</th>
              <th style="width:85px">Condition</th>
              <th style="width:160px">Street</th>
              <th>Last Modified By</th>
              <th style="width:64px"></th>
            </tr>
          </thead>
          <tbody>
            {#each filteredTrees as t (t.id)}
              <tr>
                <td class="adm-td-mono">{t.pid || ('#' + t.id)}</td>
                <td>
                  <div class="adm-species">{t.n || '—'}</div>
                  {#if t.s}<div class="adm-sci">{t.s}</div>{/if}
                </td>
                <td>
                  <span class="adm-cond adm-cond-{(t.c || '').toLowerCase()}">{t.c || '—'}</span>
                </td>
                <td class="adm-td-street">{t.st || '—'}</td>
                <td class="adm-td-lmb">{t.lmb || '—'}</td>
                <td style="text-align:center">
                  <button class="adm-remove-btn"
                    disabled={deletingTreeId === t.id}
                    onclick={() => handleDeleteTree(t)}>
                    {deletingTreeId === t.id ? '…' : 'Delete'}
                  </button>
                </td>
              </tr>
            {:else}
              <tr><td colspan="6" class="adm-empty">No trees match your search.</td></tr>
            {/each}
          </tbody>
        </table>
      </div>
      <div class="adm-count">{filteredTrees.length} of {$trees.length} trees</div>
    </div>

    <div class="adm-divider"></div>

    <!-- ── Activity Log ─────────────────────────────────────────────────────── -->
    <div>
      <h2 class="adm-h2">Activity Log</h2>
      <p class="adm-body">Recent admin actions — email changes, role updates, tree deletions, and password resets.</p>

      {#if logLoading}
        <div class="adm-loading">Loading…</div>
      {:else if logError}
        <div class="adm-err-msg">{logError} <button class="adm-retry" onclick={loadLog}>Retry</button></div>
      {:else}
        <div class="adm-table-wrap adm-log-wrap">
          <table class="adm-table">
            <thead>
              <tr>
                <th style="width:160px">Action</th>
                <th>Details</th>
                <th style="width:110px">By</th>
                <th style="width:130px">Date</th>
              </tr>
            </thead>
            <tbody>
              {#each activityLog as entry (entry.id)}
                <tr>
                  <td><span class="adm-log-action adm-log-{entry.action}">{fmtAction(entry.action)}</span></td>
                  <td class="adm-td-email">{fmtLogDetails(entry.details)}</td>
                  <td class="adm-td-mono">{entry.performed_by || '—'}</td>
                  <td class="adm-td-date">{fmt(entry.created_at)}</td>
                </tr>
              {:else}
                <tr><td colspan="4" class="adm-empty">No activity recorded yet.</td></tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </div>

    <div class="adm-divider"></div>

    <!-- ── Supabase Dashboard ────────────────────────────────────────────────── -->
    <div>
      <h2 class="adm-h2">Supabase Dashboard</h2>
      <p class="adm-body">
        Direct database access for data recovery and advanced management. Requires a Supabase login.
        The SQL editor has unrestricted access — use with care.
      </p>

      <div class="adm-sb-links">
        <a class="adm-sb-btn" href="https://supabase.com/dashboard/project/zwvxfgcmfjxgioxcsgcs/database/tables" target="_blank" rel="noopener">
          Table Editor ↗
        </a>
        <a class="adm-sb-btn" href="https://supabase.com/dashboard/project/zwvxfgcmfjxgioxcsgcs/sql/new" target="_blank" rel="noopener">
          SQL Editor ↗
        </a>
        <a class="adm-sb-btn" href="https://supabase.com/dashboard/project/zwvxfgcmfjxgioxcsgcs/auth/policies" target="_blank" rel="noopener">
          RLS Policies ↗
        </a>
      </div>

      <div class="adm-sb-instructions">

        <div class="adm-sb-block">
          <div class="adm-sb-label">Inspect user accounts</div>
          <p class="adm-sb-note">Lists all registered accounts and their stored data (username, email, role). Use this to verify account state or diagnose login issues.</p>
          <pre class="adm-sb-code">SELECT key, value FROM app_storage
WHERE key LIKE 'u:%';</pre>
        </div>

        <div class="adm-sb-block">
          <div class="adm-sb-label">Review recent admin activity</div>
          <p class="adm-sb-note">Fetches the last 100 entries from the activity log. Useful if the log in this panel is unavailable or you need to look further back.</p>
          <pre class="adm-sb-code">SELECT action, performed_by, details, created_at
FROM activity_log
ORDER BY created_at DESC
LIMIT 100;</pre>
        </div>

        <div class="adm-sb-block">
          <div class="adm-sb-label adm-sb-label-warn">Removing an email — use the panel above, not SQL</div>
          <p class="adm-sb-note">The "Remove" button in the Allowed Emails section above deletes the allowlist entry <em>and</em> the user's account and password data together. Deleting via SQL only removes the allowlist entry and will leave orphaned account data behind.</p>
        </div>

      </div>
    </div>

  </div>
</div>

<style>
  .adm-overlay{flex:1;min-height:0;background:#fdf8f0;overflow-y:auto;text-align:left}
  .adm-wrap{width:100%;max-width:900px;margin:0 auto;padding:48px 28px 60px;display:flex;flex-direction:column;gap:36px}

  .adm-back{background:transparent;border:1px solid rgba(120,80,20,.25);border-radius:4px;padding:5px 13px;font-family:'DM Mono',monospace;font-size:.74rem;color:#5c3d08;cursor:pointer;transition:all .13s}
  .adm-back:hover{background:rgba(92,61,8,.1);border-color:#5c3d08}
  .adm-kicker{font-size:.64rem;letter-spacing:.14em;text-transform:uppercase;color:#c9973a;margin-bottom:6px}
  .adm-title{font-family:'Playfair Display',serif;font-size:2rem;color:#0f2e14;margin-bottom:6px}
  .adm-h2{font-family:'Playfair Display',serif;font-size:1.35rem;color:#2a7d24;margin-bottom:10px}
  .adm-body{font-size:.82rem;color:#3a3a3a;line-height:1.75;margin-bottom:16px}
  .adm-divider{height:1px;background:rgba(120,80,20,.18)}
  .adm-loading{font-size:.78rem;color:#5c3d08;font-family:'DM Mono',monospace;font-style:italic}
  .adm-err-msg{font-size:.78rem;color:#c0392b;font-family:'DM Mono',monospace;display:flex;align-items:center;gap:10px}
  .adm-retry{background:none;border:1px solid rgba(192,57,43,.4);border-radius:3px;padding:2px 9px;font-family:'DM Mono',monospace;font-size:.68rem;color:#c0392b;cursor:pointer}
  .adm-retry:hover{background:rgba(192,57,43,.08)}
  .adm-empty{text-align:center;color:rgba(60,40,10,.35);font-style:italic;font-size:.75rem;padding:18px}

  .adm-table-wrap{border:1px solid rgba(120,80,20,.18);border-radius:7px;overflow:hidden;margin-bottom:14px}
  .adm-tree-wrap{max-height:420px;overflow-y:auto;overflow-x:auto}
  .adm-table{width:100%;border-collapse:collapse;font-size:.76rem}
  .adm-table thead{background:#231c09;position:sticky;top:0;z-index:1}
  .adm-table th{padding:7px 12px;font-size:.6rem;letter-spacing:.1em;text-transform:uppercase;color:#c9973a;text-align:left;font-weight:500;white-space:nowrap}
  .adm-table td{padding:8px 12px;border-bottom:1px solid rgba(201,151,58,.08);vertical-align:middle}
  .adm-table tr:last-child td{border-bottom:none}
  .adm-table tr:hover td{background:rgba(201,151,58,.04)}

  .adm-td-email{color:#3a3a3a;word-break:break-all;font-size:.74rem}
  .adm-td-date{color:#7a6040;font-family:'DM Mono',monospace;font-size:.68rem;white-space:nowrap}
  .adm-td-mono{color:#1c1c1e;font-family:'DM Mono',monospace;font-size:.72rem}
  .adm-td-street{color:#3a3a3a;font-size:.72rem}
  .adm-td-lmb{color:#7a6040;font-size:.68rem;word-break:break-all}
  .adm-species{color:#1c1c1e;font-size:.74rem}
  .adm-sci{color:#7a6040;font-size:.62rem;font-style:italic;margin-top:1px}

  .adm-badge{display:inline-block;border-radius:3px;padding:2px 7px;font-size:.62rem;font-family:'DM Mono',monospace;background:rgba(42,125,36,.1);border:1px solid rgba(42,125,36,.3);color:#2a7d24}
  .adm-badge-admin{background:rgba(201,151,58,.12);border-color:rgba(201,151,58,.4);color:#8a6010}

  .adm-cond{display:inline-block;border-radius:3px;padding:2px 7px;font-size:.62rem;font-family:'DM Mono',monospace}
  .adm-cond-good{background:rgba(42,125,36,.1);border:1px solid rgba(42,125,36,.3);color:#2a7d24}
  .adm-cond-fair{background:rgba(201,151,58,.1);border:1px solid rgba(201,151,58,.3);color:#8a6010}
  .adm-cond-poor{background:rgba(192,57,43,.1);border:1px solid rgba(192,57,43,.3);color:#c0392b}
  .adm-cond-dead{background:rgba(60,40,10,.1);border:1px solid rgba(60,40,10,.3);color:#5c3d08}

  .adm-remove-btn{background:transparent;border:1px solid rgba(192,57,43,.35);border-radius:3px;padding:3px 9px;font-family:'DM Mono',monospace;font-size:.64rem;color:#c0392b;cursor:pointer;transition:all .13s;white-space:nowrap}
  .adm-remove-btn:hover:not(:disabled){background:rgba(192,57,43,.08);border-color:#c0392b}
  .adm-remove-btn:disabled{opacity:.45;cursor:not-allowed}

  .adm-add-row{display:flex;gap:8px;align-items:center;margin-bottom:8px}
  .adm-input{background:#f5f0e8;border:1px solid rgba(120,80,20,.3);border-radius:5px;padding:7px 11px;font-family:'DM Mono',monospace;font-size:.78rem;color:#1c1c1e;outline:none;transition:border-color .13s}
  .adm-input:focus{border-color:#c9973a}
  .adm-search{width:100%;box-sizing:border-box;margin-bottom:12px}
  .adm-add-btn{background:#231c09;border:1px solid rgba(201,151,58,.4);border-radius:4px;padding:7px 16px;font-family:'DM Mono',monospace;font-size:.74rem;color:#c9973a;cursor:pointer;transition:all .13s;white-space:nowrap}
  .adm-add-btn:hover:not(:disabled){background:#2e2410;border-color:#c9973a}
  .adm-add-btn:disabled{opacity:.5;cursor:not-allowed}
  .adm-msg{font-size:.72rem;margin:4px 0 0}
  .adm-msg.error{color:#c0392b}
  .adm-msg.success{color:#2a7d24}

  .adm-count{font-size:.65rem;color:#7a6040;font-family:'DM Mono',monospace;text-align:right;margin-top:4px}
  .adm-tree-table .adm-td-lmb{min-width:160px}

  /* Activity log */
  .adm-log-wrap{max-height:320px;overflow-y:auto}
  .adm-log-action{display:inline-block;border-radius:3px;padding:2px 7px;font-size:.62rem;font-family:'DM Mono',monospace;background:rgba(42,125,36,.08);border:1px solid rgba(42,125,36,.2);color:#2a7d24}
  .adm-log-email_removed,.adm-log-tree_deleted{background:rgba(192,57,43,.08);border-color:rgba(192,57,43,.25);color:#c0392b}
  .adm-log-role_changed,.adm-log-temp_password_set{background:rgba(201,151,58,.1);border-color:rgba(201,151,58,.3);color:#8a6010}
  .adm-log-reset_dismissed{background:rgba(120,80,20,.08);border-color:rgba(120,80,20,.2);color:#5c3d08}

  /* Supabase dashboard section */
  .adm-sb-links{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px}
  .adm-sb-btn{display:inline-block;background:#231c09;border:1px solid rgba(201,151,58,.4);border-radius:4px;padding:7px 16px;font-family:'DM Mono',monospace;font-size:.74rem;color:#c9973a;text-decoration:none;transition:all .13s}
  .adm-sb-btn:hover{background:#2e2410;border-color:#c9973a}
  .adm-sb-instructions{display:flex;flex-direction:column;gap:12px}
  .adm-sb-block{background:#f5f0e8;border:1px solid rgba(120,80,20,.18);border-radius:6px;padding:12px 14px}
  .adm-sb-label{font-size:.7rem;color:#5c3d08;font-family:'DM Mono',monospace;margin-bottom:6px;text-transform:uppercase;letter-spacing:.06em}
  .adm-sb-code{margin:0;font-family:'DM Mono',monospace;font-size:.72rem;color:#1c1c1e;white-space:pre-wrap;line-height:1.6;background:none;border:none;padding:0}
  .adm-sb-warning{color:#8a4a10;background:rgba(192,57,43,.06);border:1px solid rgba(192,57,43,.2);border-radius:5px;padding:9px 13px;margin-bottom:14px}
  .adm-sb-label-warn{color:#8a4a10}
  .adm-sb-note{margin:0 0 8px;font-size:.72rem;color:#5c3d08;line-height:1.65;font-style:italic}
  .adm-sb-note:last-child{margin-bottom:0}

  /* Inline email editing */
  .adm-email-row{display:flex;align-items:center;gap:6px}
  .adm-inline-edit{display:flex;align-items:center;gap:5px;flex-wrap:wrap}
  .adm-inline-input{padding:4px 8px;font-size:.7rem;width:180px}
  .adm-edit-btn{background:transparent;border:1px solid rgba(120,80,20,.3);border-radius:3px;padding:2px 8px;font-family:'DM Mono',monospace;font-size:.6rem;color:#5c3d08;cursor:pointer;transition:all .12s;white-space:nowrap;flex-shrink:0}
  .adm-edit-btn:hover{background:rgba(92,61,8,.08);border-color:#5c3d08}
  .adm-save-btn{background:#231c09;border:1px solid rgba(201,151,58,.4);border-radius:3px;padding:3px 10px;font-family:'DM Mono',monospace;font-size:.64rem;color:#c9973a;cursor:pointer;transition:all .12s;white-space:nowrap}
  .adm-save-btn:hover:not(:disabled){background:#2e2410;border-color:#c9973a}
  .adm-save-btn:disabled{opacity:.5;cursor:not-allowed}
  .adm-cancel-btn{background:transparent;border:none;color:#7a6040;cursor:pointer;font-size:.72rem;padding:0 3px;transition:color .1s}
  .adm-cancel-btn:hover{color:#1c1c1e}

  /* Role promote/demote */
  .adm-role-row{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
  .adm-role-btn{background:transparent;border:1px solid rgba(42,125,36,.35);border-radius:3px;padding:2px 8px;font-family:'DM Mono',monospace;font-size:.6rem;color:#2a7d24;cursor:pointer;transition:all .12s;white-space:nowrap}
  .adm-role-btn:hover:not(:disabled){background:rgba(42,125,36,.08);border-color:#2a7d24}
  .adm-role-btn-demote{border-color:rgba(192,57,43,.35);color:#c0392b}
  .adm-role-btn-demote:hover:not(:disabled){background:rgba(192,57,43,.08);border-color:#c0392b}
  .adm-role-btn:disabled{opacity:.45;cursor:not-allowed}

  /* Pending resets section */
  .adm-h2-reset{color:#8a4a10}
  .adm-reset-count{display:inline-flex;align-items:center;justify-content:center;background:#c0392b;color:#fff;border-radius:10px;font-size:.62rem;font-family:'DM Mono',monospace;font-weight:700;padding:1px 7px;margin-left:8px;vertical-align:middle}
  .adm-reset-empty{font-size:.76rem;color:#7a6040;font-style:italic;font-family:'DM Mono',monospace;padding:6px 0}
  .adm-reset-list{display:flex;flex-direction:column;gap:10px}
  .adm-reset-card{background:#fff8ee;border:1px solid rgba(192,57,43,.25);border-radius:7px;padding:14px 16px;display:flex;flex-direction:column;gap:10px}
  .adm-reset-top{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
  .adm-reset-user{font-family:'DM Mono',monospace;font-size:.76rem;font-weight:600;color:#1c1c1e}
  .adm-reset-email{font-size:.74rem;color:#5c3d08;margin-top:2px}
  .adm-reset-time{font-size:.64rem;color:#9a8060;font-family:'DM Mono',monospace;margin-top:3px}
  .adm-reset-actions{display:flex;align-items:center;gap:7px;flex-shrink:0}
  .adm-reset-set-btn{padding:5px 12px;font-size:.68rem}
  .adm-reset-dismiss{font-size:.8rem;color:#9a8060;padding:0 4px}
  .adm-reset-pw-row{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
  .adm-reset-pw-input{width:200px}
  .adm-reset-done{font-size:.72rem;color:#2a7d24;background:rgba(42,125,36,.07);border:1px solid rgba(42,125,36,.2);border-radius:4px;padding:8px 12px;line-height:1.55}
</style>

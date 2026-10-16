<script>
  import HelpDiagram from '$lib/components/HelpDiagram.svelte';
</script>

<HelpDiagram caption="Admin Panel — four sections for managing access and data">
  <svg viewBox="0 0 380 228" xmlns="http://www.w3.org/2000/svg">
    <rect width="380" height="228" fill="#fdf8f0"/>

    <!-- page header -->
    <rect x="0" y="0" width="380" height="52" fill="#f5ede0"/>
    <line x1="0" y1="52" x2="380" y2="52" stroke="#7a501a" stroke-opacity="0.15" stroke-width="1"/>
    <text x="18" y="18" fill="#c9973a" font-size="6" font-family="monospace" letter-spacing="1.4">ADMIN</text>
    <text x="18" y="37" fill="#0f2e14" font-size="14" font-family="Georgia,serif" font-weight="bold">Admin Panel</text>
    <text x="18" y="48" fill="#3a3a3a" font-size="6.5" font-family="monospace">Manage access, accounts, and tree data.</text>
    <rect x="296" y="12" width="76" height="14" rx="3" fill="#f0e6d0" stroke="#7a501a" stroke-opacity="0.25" stroke-width="1"/>
    <text x="334" y="22" text-anchor="middle" fill="#5c3d08" font-size="7" font-family="monospace">← Back to Map</text>

    <!-- Section 1: Allowed Emails -->
    <rect x="10" y="60" width="360" height="36" rx="4" fill="#f0e6d0" stroke="#7a501a" stroke-opacity="0.15" stroke-width="1"/>
    <text x="20" y="74" fill="#2a7d24" font-size="9.5" font-family="Georgia,serif" font-weight="bold">Allowed Emails</text>
    <text x="20" y="86" fill="#3a3a3a" font-size="6.5" font-family="monospace">Only listed addresses can create an account</text>
    <rect x="286" y="64" width="76" height="14" rx="2" fill="#f5ede0" stroke="#7a501a" stroke-opacity="0.2" stroke-width="0.8"/>
    <text x="324" y="74" text-anchor="middle" fill="#5c3d08" font-size="7" font-family="monospace">+ Add email…</text>
    <circle cx="10" cy="60" r="6" fill="#c9973a"/>
    <text x="10" y="63" text-anchor="middle" fill="#100d04" font-size="6.5" font-weight="bold">1</text>

    <!-- Section 2: User Accounts -->
    <rect x="10" y="104" width="360" height="36" rx="4" fill="#f0e6d0" stroke="#7a501a" stroke-opacity="0.15" stroke-width="1"/>
    <text x="20" y="118" fill="#2a7d24" font-size="9.5" font-family="Georgia,serif" font-weight="bold">User Accounts</text>
    <text x="20" y="130" fill="#3a3a3a" font-size="6.5" font-family="monospace">Edit display email or toggle role between standard and admin</text>
    <rect x="278" y="108" width="36" height="12" rx="2" fill="#c9973a" fill-opacity="0.15" stroke="#c9973a" stroke-opacity="0.4" stroke-width="0.8"/>
    <text x="296" y="116" text-anchor="middle" fill="#8a6010" font-size="6.5" font-family="monospace">admin</text>
    <rect x="318" y="108" width="32" height="12" rx="2" fill="#f0e6d0" stroke="#7a501a" stroke-opacity="0.2" stroke-width="0.8"/>
    <text x="334" y="116" text-anchor="middle" fill="#5c3d08" font-size="6.5" font-family="monospace">user</text>
    <circle cx="10" cy="104" r="6" fill="#c9973a"/>
    <text x="10" y="107" text-anchor="middle" fill="#100d04" font-size="6.5" font-weight="bold">2</text>

    <!-- Section 3: Password Resets -->
    <rect x="10" y="148" width="360" height="36" rx="4" fill="#fff7ec" stroke="#d4860a" stroke-opacity="0.3" stroke-width="1"/>
    <text x="20" y="162" fill="#8a4a10" font-size="9.5" font-family="Georgia,serif" font-weight="bold">Pending Password Resets</text>
    <text x="20" y="174" fill="#3a3a3a" font-size="6.5" font-family="monospace">Set a temporary password for users who requested a reset</text>
    <rect x="290" y="152" width="70" height="14" rx="2" fill="#f0e6d0" stroke="#d4860a" stroke-opacity="0.35" stroke-width="0.8"/>
    <text x="325" y="162" text-anchor="middle" fill="#8a4a10" font-size="7" font-family="monospace">Set + Clear</text>
    <circle cx="10" cy="148" r="6" fill="#d4ae30"/>
    <text x="10" y="151" text-anchor="middle" fill="#100d04" font-size="6.5" font-weight="bold">3</text>

    <!-- Section 4: Tree Inventory -->
    <rect x="10" y="192" width="360" height="30" rx="4" fill="#f0e6d0" stroke="#7a501a" stroke-opacity="0.15" stroke-width="1"/>
    <text x="20" y="206" fill="#2a7d24" font-size="9.5" font-family="Georgia,serif" font-weight="bold">Tree Inventory</text>
    <text x="20" y="216" fill="#3a3a3a" font-size="6.5" font-family="monospace">Searchable table of all records · delete is permanent</text>
    <rect x="308" y="196" width="52" height="12" rx="2" fill="#b03535" fill-opacity="0.1" stroke="#b03535" stroke-opacity="0.35" stroke-width="0.8"/>
    <text x="334" y="204" text-anchor="middle" fill="#9e2020" font-size="6.5" font-family="monospace">Delete</text>
    <circle cx="10" cy="192" r="6" fill="#c9973a"/>
    <text x="10" y="195" text-anchor="middle" fill="#100d04" font-size="6.5" font-weight="bold">4</text>
  </svg>
</HelpDiagram>

<div class="hd-section-lbl">① Allowed Emails</div>
<p>Add an email before a new user signs up — only listed addresses can create accounts. Removing an address doesn't affect anyone already logged in.</p>

<div class="hd-section-lbl">② User Accounts</div>
<p>Lists all registered users. Toggle a user's role between <strong>user</strong> and <strong>admin</strong>. Changes take effect immediately.</p>

<div class="hd-section-lbl">③ Pending Password Resets</div>
<p>When a user can't log in and requests a reset, their name appears here. Set a temporary password, share it with them directly, and click <strong>Clear</strong> once they're back in.</p>

<div class="hd-section-lbl">④ Tree Inventory</div>
<p>A searchable table of every tree record. Use this to audit data or permanently delete a record that can't be corrected through the normal edit flow.</p>
<p class="hd-note">Deleting a record is permanent and cannot be undone.</p>

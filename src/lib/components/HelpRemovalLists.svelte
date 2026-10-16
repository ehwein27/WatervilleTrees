<script>
  import HelpDiagram from '$lib/components/HelpDiagram.svelte';
</script>

<p>Create named lists of trees flagged for removal.</p>

<HelpDiagram caption="Removal list panel — trees are added by clicking them on the map">
  <svg viewBox="0 0 380 210" xmlns="http://www.w3.org/2000/svg">
    <!-- sidebar panel bg -->
    <rect width="380" height="210" fill="#100d04"/>
    <rect x="0" y="0" width="200" height="210" fill="#1b1507" stroke="#c9973a" stroke-opacity="0.2" stroke-width="0" />

    <!-- panel header -->
    <rect x="0" y="0" width="200" height="34" fill="#1b1507"/>
    <line x1="0" y1="34" x2="200" y2="34" stroke="#c9973a" stroke-opacity="0.2" stroke-width="1"/>
    <text x="12" y="15" fill="#f0e8d0" font-size="9.5" font-family="Georgia,serif">Removal Lists</text>
    <text x="12" y="27" fill="#c9973a" font-size="6.5" font-family="monospace">2025 Spring Removals</text>
    <!-- close btn -->
    <text x="188" y="14" fill="#f0e8d0" fill-opacity="0.4" font-size="10" font-family="monospace">✕</text>
    <!-- callout ① (list name) -->
    <circle cx="12" cy="34" r="6" fill="#c9973a"/>
    <text x="12" y="37" text-anchor="middle" fill="#100d04" font-size="6.5" font-weight="bold">1</text>

    <!-- new list button -->
    <rect x="8" y="42" width="184" height="14" rx="3" fill="#1b1507" stroke="#c9973a" stroke-opacity="0.4" stroke-width="1"/>
    <text x="100" y="52" text-anchor="middle" fill="#c9973a" font-size="7.5" font-family="monospace">+ New List</text>

    <!-- tree list -->
    <line x1="0" y1="64" x2="200" y2="64" stroke="#c9973a" stroke-opacity="0.12" stroke-width="1"/>
    <text x="12" y="75" fill="#c9973a" font-size="6" font-family="monospace" letter-spacing="1">3 TREES SELECTED</text>

    <!-- tree row 1 -->
    <rect x="0" y="80" width="200" height="26" fill="#231c09" fill-opacity="0.6"/>
    <circle cx="20" cy="93" r="5" fill="#d04444" stroke="#1b1507" stroke-width="1"/>
    <text x="32" y="90" fill="#f0e8d0" font-size="7.5" font-family="monospace" font-weight="bold">Silver Maple</text>
    <text x="32" y="100" fill="#c9973a" font-size="6.5" font-family="monospace">#204 · 14 Elm St</text>
    <text x="185" y="96" fill="#f0e8d0" fill-opacity="0.35" font-size="10">×</text>

    <!-- tree row 2 -->
    <rect x="0" y="107" width="200" height="26" fill="#1b1507"/>
    <circle cx="20" cy="120" r="5" fill="#e07a30" stroke="#1b1507" stroke-width="1"/>
    <text x="32" y="117" fill="#f0e8d0" font-size="7.5" font-family="monospace" font-weight="bold">White Ash</text>
    <text x="32" y="127" fill="#c9973a" font-size="6.5" font-family="monospace">#88 · 7 College Ave</text>
    <text x="185" y="123" fill="#f0e8d0" fill-opacity="0.35" font-size="10">×</text>
    <!-- callout ② (tree row × button) -->
    <circle cx="188" cy="107" r="6" fill="#c9973a"/>
    <text x="188" y="110" text-anchor="middle" fill="#100d04" font-size="6.5" font-weight="bold">2</text>

    <!-- tree row 3 -->
    <rect x="0" y="134" width="200" height="26" fill="#231c09" fill-opacity="0.6"/>
    <circle cx="20" cy="147" r="5" fill="#a03535" stroke="#1b1507" stroke-width="1"/>
    <text x="32" y="144" fill="#f0e8d0" font-size="7.5" font-family="monospace" font-weight="bold">Norway Maple</text>
    <text x="32" y="154" fill="#c9973a" font-size="6.5" font-family="monospace">#317 · 90 Main St</text>
    <text x="185" y="150" fill="#f0e8d0" fill-opacity="0.35" font-size="10">×</text>

    <!-- export button -->
    <line x1="0" y1="168" x2="200" y2="168" stroke="#c9973a" stroke-opacity="0.15" stroke-width="1"/>
    <rect x="8" y="175" width="86" height="14" rx="3" fill="#1b1507" stroke="#c9973a" stroke-opacity="0.45" stroke-width="1"/>
    <text x="51" y="185" text-anchor="middle" fill="#c9973a" font-size="7.5" font-family="monospace">Export CSV</text>
    <rect x="102" y="175" width="90" height="14" rx="3" fill="#1b1507" stroke="#c9973a" stroke-opacity="0.45" stroke-width="1"/>
    <text x="147" y="185" text-anchor="middle" fill="#c9973a" font-size="7.5" font-family="monospace">Print Summary</text>
    <!-- callout ③ -->
    <circle cx="8" cy="168" r="6" fill="#c9973a"/>
    <text x="8" y="171" text-anchor="middle" fill="#100d04" font-size="6.5" font-weight="bold">3</text>

    <!-- map area (right side) -->
    <rect x="200" y="0" width="180" height="210" fill="#2d3a2e"/>
    <!-- map roads -->
    <line x1="200" y1="70" x2="380" y2="70" stroke="#4a5e4b" stroke-width="10" stroke-opacity="0.5"/>
    <line x1="290" y1="0" x2="290" y2="210" stroke="#4a5e4b" stroke-width="8" stroke-opacity="0.4"/>
    <!-- regular tree markers -->
    <circle cx="235" cy="45" r="6" fill="#5ec254" stroke="#fff" stroke-opacity="0.2" stroke-width="1"/>
    <circle cx="330" cy="50" r="6" fill="#5ec254" stroke="#fff" stroke-opacity="0.2" stroke-width="1"/>
    <!-- selected / removal list markers (red ring) -->
    <circle cx="255" cy="90" r="9" fill="none" stroke="#b83535" stroke-width="2" stroke-dasharray="3,2"/>
    <circle cx="255" cy="90" r="5" fill="#d04444" stroke="#fff" stroke-opacity="0.2" stroke-width="1"/>
    <circle cx="310" cy="110" r="9" fill="none" stroke="#b83535" stroke-width="2" stroke-dasharray="3,2"/>
    <circle cx="310" cy="110" r="5" fill="#e07a30" stroke="#fff" stroke-opacity="0.2" stroke-width="1"/>
    <circle cx="350" cy="150" r="9" fill="none" stroke="#b83535" stroke-width="2" stroke-dasharray="3,2"/>
    <circle cx="350" cy="150" r="5" fill="#a03535" stroke="#fff" stroke-opacity="0.2" stroke-width="1"/>
    <!-- callout ④ (highlighted tree on map) -->
    <circle cx="264" cy="82" r="6" fill="#b83535"/>
    <text x="264" y="85" text-anchor="middle" fill="#fff" font-size="6.5" font-weight="bold">4</text>

    <!-- legend -->
    <rect x="0" y="196" width="380" height="14" fill="#0d0a02"/>
    <line x1="0" y1="196" x2="380" y2="196" stroke="#c9973a" stroke-opacity="0.18" stroke-width="1"/>
    <circle cx="10" cy="204" r="4" fill="#c9973a"/>
    <text x="10" y="206.5" text-anchor="middle" fill="#0d0a02" font-size="5.5" font-weight="bold">1</text>
    <text x="17" y="206" fill="#c9973a" font-size="6.5" font-family="monospace">Active list name</text>
    <circle cx="105" cy="204" r="4" fill="#c9973a"/>
    <text x="105" y="206.5" text-anchor="middle" fill="#0d0a02" font-size="5.5" font-weight="bold">2</text>
    <text x="112" y="206" fill="#c9973a" font-size="6.5" font-family="monospace">Remove from list</text>
    <circle cx="200" cy="204" r="4" fill="#c9973a"/>
    <text x="200" y="206.5" text-anchor="middle" fill="#0d0a02" font-size="5.5" font-weight="bold">3</text>
    <text x="207" y="206" fill="#c9973a" font-size="6.5" font-family="monospace">Export options</text>
    <circle cx="295" cy="204" r="4" fill="#b83535"/>
    <text x="295" y="206.5" text-anchor="middle" fill="#fff" font-size="5.5" font-weight="bold">4</text>
    <text x="302" y="206" fill="#c9973a" font-size="6.5" font-family="monospace">List trees on map</text>
  </svg>
</HelpDiagram>

<ol class="hd-steps">
  <li>Open <strong>Removal Lists</strong> from Reports &amp; Tasks.</li>
  <li>Click <strong>New List</strong> and give it a name (e.g. "2025 Spring Removals").</li>
  <li>Click trees on the map to add them to the active list — selected trees appear highlighted with a dashed ring.</li>
  <li>Use the list panel to review selected trees, remove any by clicking the × next to each, and add notes.</li>
  <li>Export as CSV or printable summary using the export buttons.</li>
</ol>

<p class="hd-note">Lists are saved and can be re-opened at any time. Multiple lists can exist side by side.</p>

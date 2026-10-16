<script>
  import HelpDiagram from '$lib/components/HelpDiagram.svelte';
</script>

<p>Use this report to identify which trees in the inventory need attention and in what order — for care planning, budget requests, or council presentations.</p>

<HelpDiagram caption="Tree Health & Priority Report — scope presets, summary pills, and expandable factor breakdown">
  <svg viewBox="0 0 380 240" xmlns="http://www.w3.org/2000/svg">
    <rect width="380" height="240" fill="#faf6ee"/>
    <rect x="5" y="4" width="370" height="232" rx="7" fill="#f5f0e4" stroke="rgba(120,80,20,.25)" stroke-width="1"/>

    <!-- header -->
    <rect x="5" y="4" width="370" height="30" rx="7" fill="#f0e8d0"/>
    <rect x="5" y="22" width="370" height="12" fill="#f0e8d0"/>
    <text x="20" y="23" fill="#0f2e14" font-size="10" font-family="Georgia,serif" font-weight="bold">Tree Health &amp; Priority Report</text>
    <line x1="5" y1="34" x2="375" y2="34" stroke="rgba(120,80,20,.2)" stroke-width="1"/>

    <!-- scope buttons row 1 -->
    <text x="20" y="46" fill="#c9973a" font-size="5.5" font-family="monospace" letter-spacing="0.8">SCOPE</text>
    <!-- btn: Immediate Action (active) -->
    <rect x="12" y="50" width="84" height="22" rx="3" fill="rgba(201,151,58,.15)" stroke="#c9973a" stroke-opacity="0.7" stroke-width="1"/>
    <text x="54" y="60" text-anchor="middle" fill="#c9973a" font-size="7" font-family="monospace">⚠ Immediate Action</text>
    <circle cx="12" cy="50" r="5" fill="#c9973a"/>
    <text x="12" y="53" text-anchor="middle" fill="#3a2200" font-size="5.5" font-weight="bold">1</text>
    <!-- btn: EAB Monitoring -->
    <rect x="102" y="50" width="76" height="22" rx="3" fill="#f0e8d0" stroke="rgba(120,80,20,.2)" stroke-width="1"/>
    <text x="140" y="60" text-anchor="middle" fill="#7a6030" font-size="7" font-family="monospace">🌿 EAB Monitoring</text>
    <!-- btn: By Street -->
    <rect x="184" y="50" width="62" height="22" rx="3" fill="#f0e8d0" stroke="rgba(120,80,20,.2)" stroke-width="1"/>
    <text x="215" y="60" text-anchor="middle" fill="#7a6030" font-size="7" font-family="monospace">📍 By Street</text>
    <!-- scope row 2 -->
    <!-- btn: Full Inventory -->
    <rect x="12" y="76" width="76" height="22" rx="3" fill="#f0e8d0" stroke="rgba(120,80,20,.2)" stroke-width="1"/>
    <text x="50" y="91" text-anchor="middle" fill="#7a6030" font-size="7" font-family="monospace">🌳 Full Inventory</text>
    <!-- btn: Removal List -->
    <rect x="94" y="76" width="80" height="22" rx="3" fill="#f0e8d0" stroke="rgba(120,80,20,.2)" stroke-width="1"/>
    <text x="134" y="91" text-anchor="middle" fill="#7a6030" font-size="7" font-family="monospace">📋 Removal List</text>
    <!-- btn: Custom -->
    <rect x="180" y="76" width="66" height="22" rx="3" fill="#f0e8d0" stroke="rgba(120,80,20,.2)" stroke-width="1"/>
    <text x="213" y="91" text-anchor="middle" fill="#7a6030" font-size="7" font-family="monospace">✏ Custom</text>

    <!-- summary pills -->
    <rect x="12" y="104" width="46" height="12" rx="6" fill="rgba(208,68,68,.1)" stroke="#d04444" stroke-width="0.8"/>
    <text x="35" y="113" text-anchor="middle" fill="#d04444" font-size="6.5" font-family="monospace">Critical: 3</text>
    <rect x="64" y="104" width="40" height="12" rx="6" fill="rgba(208,104,40,.1)" stroke="#d06828" stroke-width="0.8"/>
    <text x="84" y="113" text-anchor="middle" fill="#d06828" font-size="6.5" font-family="monospace">High: 7</text>
    <rect x="110" y="104" width="52" height="12" rx="6" fill="rgba(212,174,48,.1)" stroke="#d4ae30" stroke-width="0.8"/>
    <text x="136" y="113" text-anchor="middle" fill="#c9973a" font-size="6.5" font-family="monospace">Moderate: 14</text>
    <rect x="168" y="104" width="36" height="12" rx="6" fill="rgba(94,194,84,.1)" stroke="#5ec254" stroke-width="0.8"/>
    <text x="186" y="113" text-anchor="middle" fill="#5ec254" font-size="6.5" font-family="monospace">Low: 22</text>
    <rect x="210" y="104" width="34" height="12" rx="6" fill="rgba(107,26,26,.1)" stroke="#6b1a1a" stroke-width="0.8"/>
    <text x="227" y="113" text-anchor="middle" fill="#a03030" font-size="6.5" font-family="monospace">Dead: 4</text>
    <circle cx="210" cy="104" r="5" fill="#c9973a"/>
    <text x="210" y="107" text-anchor="middle" fill="#3a2200" font-size="5.5" font-weight="bold">2</text>

    <!-- tree list header -->
    <rect x="12" y="121" width="350" height="11" rx="2" fill="#e8dcc4"/>
    <text x="22" y="129" fill="#5c3d08" font-size="5.5" font-family="monospace" letter-spacing="0.6">PRIORITY</text>
    <text x="90" y="129" fill="#5c3d08" font-size="5.5" font-family="monospace" letter-spacing="0.6">SPECIES</text>
    <text x="210" y="129" fill="#5c3d08" font-size="5.5" font-family="monospace" letter-spacing="0.6">STREET</text>
    <text x="302" y="129" fill="#5c3d08" font-size="5.5" font-family="monospace" letter-spacing="0.6">SCORE</text>

    <!-- row 1 — critical, expanded -->
    <rect x="12" y="132" width="350" height="13" fill="rgba(176,53,53,0.06)"/>
    <rect x="18" y="134" width="38" height="9" rx="2" fill="rgba(208,68,68,.2)" stroke="#d04444" stroke-opacity="0.5" stroke-width="0.8"/>
    <text x="37" y="141" text-anchor="middle" fill="#d04444" font-size="6.5" font-family="monospace">Critical</text>
    <text x="90" y="141" fill="#2a1a00" font-size="7" font-family="monospace">White Ash</text>
    <text x="210" y="141" fill="#7a6030" font-size="7" font-family="monospace">Elm St</text>
    <text x="302" y="141" fill="#d04444" font-size="8" font-family="monospace" font-weight="bold">28</text>
    <text x="350" y="141" fill="#c9973a" font-size="9" font-family="monospace">›</text>
    <circle cx="362" cy="138" r="5" fill="#c9973a"/>
    <text x="362" y="141" text-anchor="middle" fill="#3a2200" font-size="5.5" font-weight="bold">3</text>

    <!-- expanded factor breakdown -->
    <rect x="12" y="145" width="350" height="38" fill="rgba(201,151,58,.05)" stroke-left="2"/>
    <rect x="12" y="145" width="2" height="38" fill="rgba(201,151,58,.3)"/>
    <text x="22" y="154" fill="#5c3d08" font-size="6" font-family="monospace">Condition: Poor</text>
    <text x="338" y="154" text-anchor="end" fill="rgba(201,151,58,.8)" font-size="6" font-family="monospace">−40 pts</text>
    <text x="22" y="163" fill="#5c3d08" font-size="6" font-family="monospace">Cavity-stem</text>
    <text x="338" y="163" text-anchor="end" fill="rgba(201,151,58,.8)" font-size="6" font-family="monospace">−12 pts</text>
    <text x="22" y="172" fill="#5c3d08" font-size="6" font-family="monospace">EAB risk (ash species)</text>
    <text x="338" y="172" text-anchor="end" fill="rgba(201,151,58,.8)" font-size="6" font-family="monospace">−12 pts</text>
    <line x1="16" y1="175" x2="348" y2="175" stroke="rgba(120,80,20,.2)" stroke-width="0.8"/>
    <text x="22" y="181" fill="#2a1a00" font-size="6.5" font-family="monospace" font-weight="bold">Priority Score: 28 / 100  →  Critical</text>

    <!-- row 2 — high -->
    <rect x="12" y="183" width="350" height="13" fill="rgba(240,232,208,.3)"/>
    <rect x="18" y="185" width="28" height="9" rx="2" fill="rgba(208,104,40,.2)" stroke="#d06828" stroke-opacity="0.5" stroke-width="0.8"/>
    <text x="32" y="192" text-anchor="middle" fill="#d06828" font-size="6.5" font-family="monospace">High</text>
    <text x="90" y="192" fill="#2a1a00" font-size="7" font-family="monospace">Green Ash</text>
    <text x="210" y="192" fill="#7a6030" font-size="7" font-family="monospace">College Ave</text>
    <text x="302" y="192" fill="#d06828" font-size="8" font-family="monospace" font-weight="bold">42</text>
    <text x="350" y="192" fill="#7a6030" font-size="9" font-family="monospace">›</text>

    <!-- row 3 — moderate -->
    <rect x="12" y="196" width="350" height="13"/>
    <rect x="18" y="198" width="42" height="9" rx="2" fill="rgba(212,174,48,.15)" stroke="#d4ae30" stroke-opacity="0.5" stroke-width="0.8"/>
    <text x="39" y="205" text-anchor="middle" fill="#c9973a" font-size="6.5" font-family="monospace">Moderate</text>
    <text x="90" y="205" fill="#2a1a00" font-size="7" font-family="monospace">Norway Maple</text>
    <text x="210" y="205" fill="#7a6030" font-size="7" font-family="monospace">Main St</text>
    <text x="302" y="205" fill="#c9973a" font-size="8" font-family="monospace">74</text>
    <text x="350" y="205" fill="#7a6030" font-size="9" font-family="monospace">›</text>

    <!-- legend band -->
    <rect x="0" y="222" width="380" height="14" fill="#e8dcc4"/>
    <line x1="0" y1="222" x2="380" y2="222" stroke="rgba(120,80,20,.2)" stroke-width="1"/>
    <circle cx="10" cy="230" r="4" fill="#c9973a"/>
    <text x="10" y="232.5" text-anchor="middle" fill="#3a2200" font-size="5.5" font-weight="bold">1</text>
    <text x="17" y="232" fill="#5c3d08" font-size="6.5" font-family="monospace">Active scope</text>
    <circle cx="110" cy="230" r="4" fill="#c9973a"/>
    <text x="110" y="232.5" text-anchor="middle" fill="#3a2200" font-size="5.5" font-weight="bold">2</text>
    <text x="117" y="232" fill="#5c3d08" font-size="6.5" font-family="monospace">Summary pills</text>
    <circle cx="220" cy="230" r="4" fill="#c9973a"/>
    <text x="220" y="232.5" text-anchor="middle" fill="#3a2200" font-size="5.5" font-weight="bold">3</text>
    <text x="227" y="232" fill="#5c3d08" font-size="6.5" font-family="monospace">Click to expand score breakdown</text>
  </svg>
</HelpDiagram>

<div class="hd-section-lbl">START HERE — CHOOSE A SCOPE</div>
<p>Pick the view that matches what you need:</p>
<ul>
  <li><strong>Immediate Action</strong> — Trees already at Critical or High priority. Start here for budget requests.</li>
  <li><strong>EAB Monitoring</strong> — All ash trees, regardless of current condition. Use this to track your ash population.</li>
  <li><strong>By Street</strong> — All trees on one street, sorted by priority. Useful for planning a single-season sweep.</li>
  <li><strong>Full Inventory</strong> — Every living tree in the inventory, most urgent first.</li>
  <li><strong>From Removal List</strong> — Run the report against a saved removal list.</li>
  <li><strong>Custom Selection</strong> — Hand-pick specific trees.</li>
</ul>

<div class="hd-section-lbl">READING THE PRIORITY SCORE</div>
<p>Each living tree gets a Priority Score from 0 to 100. Lower means more urgent. The score is based on the tree's condition rating and any structural observations recorded — things like stem cavities, co-dominant stems, or girdling roots. Click any tree in the preview list to see exactly what drove its score.</p>

<div class="hd-section-lbl">DEAD TREES</div>
<p>Dead trees appear in their own section below the scored list. They don't receive a priority score — the action for a dead tree is always removal. They're sorted largest-first so the board can prioritize by consequence.</p>

<div class="hd-note">The Priority Score is a planning tool, not a formal arborist risk assessment. For trees with Critical scores, a field inspection by a qualified arborist is recommended before scheduling removal.</div>

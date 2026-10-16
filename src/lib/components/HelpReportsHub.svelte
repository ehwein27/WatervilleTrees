<script>
  import HelpDiagram from '$lib/components/HelpDiagram.svelte';
</script>

<HelpDiagram caption="Reports & Tasks — click any card to open that tool">
  <svg viewBox="0 0 380 270" xmlns="http://www.w3.org/2000/svg">
    <rect width="380" height="270" fill="#100d04"/>
    <rect x="0" y="0" width="242" height="270" fill="#1b1507"/>
    <line x1="242" y1="0" x2="242" y2="270" stroke="#c9973a" stroke-opacity="0.18" stroke-width="1"/>

    <!-- panel header -->
    <rect x="0" y="0" width="242" height="34" fill="#1b1507"/>
    <line x1="0" y1="34" x2="242" y2="34" stroke="#c9973a" stroke-opacity="0.18" stroke-width="1"/>
    <text x="14" y="21" fill="#f0e8d0" font-size="10.5" font-family="Georgia,serif">Reports &amp; Tasks</text>
    <text x="226" y="20" fill="#f0e8d0" fill-opacity="0.4" font-size="11" font-family="monospace">✕</text>

    <!-- SECTION: Reports -->
    <text x="14" y="46" fill="#c9973a" font-size="5.5" font-family="monospace" letter-spacing="1.2">REPORTS</text>

    <!-- Tree Health & Priority Report -->
    <rect x="0" y="50" width="242" height="30" fill="#231c09" fill-opacity="0.5"/>
    <rect x="10" y="55" width="18" height="18" rx="3" fill="#1b1507" stroke="#c9973a" stroke-opacity="0.3" stroke-width="0.8"/>
    <text x="19" y="67" text-anchor="middle" fill="#c9973a" font-size="9">🛡</text>
    <text x="34" y="63" fill="#f0e8d0" font-size="7.5" font-family="monospace">Tree Health &amp; Priority Report</text>
    <text x="34" y="72" fill="#f0e8d0" fill-opacity="0.45" font-size="6" font-family="monospace">Priority scores, critical trees, EAB flags</text>
    <text x="231" y="68" fill="#f0e8d0" fill-opacity="0.35" font-size="9" font-family="monospace">›</text>

    <!-- Removal Cost -->
    <line x1="0" y1="80" x2="242" y2="80" stroke="#c9973a" stroke-opacity="0.08" stroke-width="1"/>
    <rect x="0" y="81" width="242" height="30" fill="#1b1507"/>
    <rect x="10" y="86" width="18" height="18" rx="3" fill="#1b1507" stroke="#c9973a" stroke-opacity="0.3" stroke-width="0.8"/>
    <text x="19" y="98" text-anchor="middle" fill="#c9973a" font-size="9">$</text>
    <text x="34" y="94" fill="#f0e8d0" font-size="8" font-family="monospace">Removal Cost Estimate</text>
    <text x="34" y="103" fill="#f0e8d0" fill-opacity="0.45" font-size="6" font-family="monospace">Budget by trunk size class</text>
    <text x="231" y="98" fill="#f0e8d0" fill-opacity="0.35" font-size="9" font-family="monospace">›</text>

    <!-- Stand Dynamics -->
    <line x1="0" y1="111" x2="242" y2="111" stroke="#c9973a" stroke-opacity="0.08" stroke-width="1"/>
    <rect x="0" y="112" width="242" height="30" fill="#231c09" fill-opacity="0.5"/>
    <rect x="10" y="117" width="18" height="18" rx="3" fill="#1b1507" stroke="#c9973a" stroke-opacity="0.3" stroke-width="0.8"/>
    <text x="19" y="129" text-anchor="middle" fill="#c9973a" font-size="8">⊞</text>
    <text x="34" y="125" fill="#f0e8d0" font-size="8" font-family="monospace">Stand Dynamic Reports</text>
    <text x="34" y="134" fill="#f0e8d0" fill-opacity="0.45" font-size="6" font-family="monospace">By condition, species, age, location</text>
    <text x="231" y="129" fill="#f0e8d0" fill-opacity="0.35" font-size="9" font-family="monospace">›</text>
    <circle cx="236" cy="50" r="6" fill="#c9973a"/>
    <text x="236" y="53" text-anchor="middle" fill="#100d04" font-size="6.5" font-weight="bold">1</text>

    <!-- SECTION: Tasks -->
    <line x1="0" y1="142" x2="242" y2="142" stroke="#c9973a" stroke-opacity="0.15" stroke-width="1"/>
    <text x="14" y="154" fill="#c9973a" font-size="5.5" font-family="monospace" letter-spacing="1.2">TASKS</text>

    <rect x="0" y="158" width="242" height="24" fill="#231c09" fill-opacity="0.5"/>
    <text x="14" y="173" fill="#f0e8d0" font-size="7.5" font-family="monospace">Removal Lists</text>
    <text x="231" y="173" fill="#f0e8d0" fill-opacity="0.35" font-size="9">›</text>

    <line x1="0" y1="182" x2="242" y2="182" stroke="#c9973a" stroke-opacity="0.08" stroke-width="1"/>
    <rect x="0" y="183" width="242" height="24" fill="#1b1507"/>
    <text x="14" y="198" fill="#f0e8d0" font-size="7.5" font-family="monospace">Bulk Condition Update</text>
    <text x="231" y="198" fill="#f0e8d0" fill-opacity="0.35" font-size="9">›</text>

    <line x1="0" y1="207" x2="242" y2="207" stroke="#c9973a" stroke-opacity="0.08" stroke-width="1"/>
    <rect x="0" y="208" width="242" height="24" fill="#231c09" fill-opacity="0.5"/>
    <text x="14" y="223" fill="#f0e8d0" font-size="7.5" font-family="monospace">Bulk Add Trees</text>
    <text x="231" y="223" fill="#f0e8d0" fill-opacity="0.35" font-size="9">›</text>

    <line x1="0" y1="232" x2="242" y2="232" stroke="#c9973a" stroke-opacity="0.08" stroke-width="1"/>
    <rect x="0" y="233" width="242" height="24" fill="#1b1507"/>
    <text x="14" y="248" fill="#f0e8d0" font-size="7.5" font-family="monospace">Prospective Planting</text>
    <text x="231" y="248" fill="#f0e8d0" fill-opacity="0.35" font-size="9">›</text>
    <circle cx="236" cy="158" r="6" fill="#c9973a"/>
    <text x="236" y="161" text-anchor="middle" fill="#100d04" font-size="6.5" font-weight="bold">2</text>

    <!-- SECTION: Work Orders -->
    <line x1="0" y1="257" x2="242" y2="257" stroke="#c9973a" stroke-opacity="0.15" stroke-width="1"/>
    <text x="14" y="267" fill="#c9973a" font-size="5.5" font-family="monospace" letter-spacing="1.2">WORK ORDERS</text>
    <circle cx="236" cy="257" r="6" fill="#c9973a"/>
    <text x="236" y="260" text-anchor="middle" fill="#100d04" font-size="6.5" font-weight="bold">3</text>

    <!-- right side map -->
    <rect x="243" y="0" width="137" height="270" fill="#2d3a2e"/>
    <line x1="265" y1="0" x2="265" y2="270" stroke="#4a5e4b" stroke-width="10" stroke-opacity="0.4"/>
    <line x1="243" y1="95" x2="380" y2="95" stroke="#4a5e4b" stroke-width="10" stroke-opacity="0.45"/>
    <line x1="243" y1="190" x2="380" y2="190" stroke="#4a5e4b" stroke-width="7" stroke-opacity="0.35"/>
    <circle cx="275" cy="65" r="5" fill="#5ec254" stroke="#fff" stroke-opacity="0.2" stroke-width="1"/>
    <circle cx="315" cy="75" r="5" fill="#e8c34a" stroke="#fff" stroke-opacity="0.2" stroke-width="1"/>
    <circle cx="355" cy="58" r="5" fill="#e07a30" stroke="#fff" stroke-opacity="0.2" stroke-width="1"/>
    <circle cx="280" cy="138" r="5" fill="#d04444" stroke="#fff" stroke-opacity="0.2" stroke-width="1"/>
    <circle cx="340" cy="148" r="5" fill="#5ec254" stroke="#fff" stroke-opacity="0.2" stroke-width="1"/>
    <circle cx="298" cy="220" r="5" fill="#5ec254" stroke="#fff" stroke-opacity="0.2" stroke-width="1"/>
    <circle cx="355" cy="208" r="5" fill="#e8c34a" stroke="#fff" stroke-opacity="0.2" stroke-width="1"/>
    <text x="311" y="255" text-anchor="middle" fill="#f0e8d0" fill-opacity="0.2" font-size="7" font-family="monospace">Map</text>
  </svg>
</HelpDiagram>

<div class="hd-section-lbl">① Reports</div>
<p><strong>Tree Health &amp; Priority Report</strong> — assigns each living tree a Priority Score based on condition and structural observations. Dead trees are listed separately for removal scheduling. EAB-flagged ash trees are marked throughout.</p>
<p><strong>Removal Cost Estimate</strong> — enter your contractor rates and the report calculates a total budget by trunk size.</p>
<p><strong>Stand Dynamic Reports</strong> — browse inventory snapshots by condition, species, age, and location.</p>

<div class="hd-section-lbl">② Tasks</div>
<p><strong>Removal Lists</strong> — build named lists of trees to remove, see them on the map, and export.</p>
<p><strong>Bulk Condition Update</strong> — tap multiple trees on the map and update their condition in one step.</p>
<p><strong>Bulk Add Trees</strong> — upload a spreadsheet to add many trees at once.</p>
<p><strong>Prospective Planting</strong> — plan future plantings by species and priority.</p>

<div class="hd-section-lbl">③ Work Orders</div>
<p><strong>Work Order</strong> — assign tasks and costs to trees street by street, save named orders, and track status.</p>

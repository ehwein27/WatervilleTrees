<script>
  import HelpDiagram from '$lib/components/HelpDiagram.svelte';
</script>

<HelpDiagram caption="Add Tree form — fill in the fields, then click Add Tree">
  <svg viewBox="0 0 380 276" xmlns="http://www.w3.org/2000/svg">
    <rect width="380" height="276" fill="#100d04"/>
    <rect x="5" y="4" width="370" height="224" rx="8" fill="#1b1507" stroke="#c9973a" stroke-opacity="0.22" stroke-width="1"/>

    <!-- title -->
    <text x="190" y="22" text-anchor="middle" fill="#f0e8d0" font-size="10.5" font-family="Georgia,serif">Add New Tree</text>
    <line x1="5" y1="28" x2="375" y2="28" stroke="#c9973a" stroke-opacity="0.18" stroke-width="1"/>

    <!-- ROW 1: Species | Sci Name -->
    <text x="12" y="40" fill="#c9973a" font-size="5.5" font-family="monospace" letter-spacing="1">SPECIES (COMMON NAME)</text>
    <rect x="12" y="42" width="174" height="14" rx="2" fill="#231c09" stroke="#c9973a" stroke-opacity="0.28" stroke-width="0.8"/>
    <text x="18" y="52" fill="#f0e8d0" fill-opacity="0.35" font-size="7" font-family="monospace">Search common name…</text>
    <circle cx="180" cy="42" r="6" fill="#c9973a"/>
    <text x="180" y="45" text-anchor="middle" fill="#100d04" font-size="6.5" font-weight="bold">1</text>

    <text x="194" y="40" fill="#c9973a" font-size="5.5" font-family="monospace" letter-spacing="1">SCIENTIFIC NAME</text>
    <rect x="194" y="42" width="174" height="14" rx="2" fill="#231c09" stroke="#c9973a" stroke-opacity="0.28" stroke-width="0.8"/>
    <text x="200" y="52" fill="#f0e8d0" fill-opacity="0.22" font-size="7" font-family="monospace">← auto-fills from species</text>

    <!-- ROW 2: Condition | Age Class -->
    <text x="12" y="68" fill="#c9973a" font-size="5.5" font-family="monospace" letter-spacing="1">CONDITION</text>
    <rect x="12" y="70" width="174" height="14" rx="2" fill="#231c09" stroke="#c9973a" stroke-opacity="0.28" stroke-width="0.8"/>
    <text x="18" y="80" fill="#f0e8d0" fill-opacity="0.75" font-size="7" font-family="monospace">Good</text>
    <text x="177" y="80" fill="#c9973a" font-size="7.5">▾</text>
    <circle cx="12" cy="70" r="6" fill="#c9973a"/>
    <text x="12" y="73" text-anchor="middle" fill="#100d04" font-size="6.5" font-weight="bold">2</text>

    <text x="194" y="68" fill="#c9973a" font-size="5.5" font-family="monospace" letter-spacing="1">AGE CLASS</text>
    <rect x="194" y="70" width="174" height="14" rx="2" fill="#231c09" stroke="#c9973a" stroke-opacity="0.28" stroke-width="0.8"/>
    <text x="200" y="80" fill="#f0e8d0" fill-opacity="0.75" font-size="7" font-family="monospace">Mature</text>
    <text x="359" y="80" fill="#c9973a" font-size="7.5">▾</text>

    <!-- ROW 3: DBH | Date -->
    <text x="12" y="96" fill="#c9973a" font-size="5.5" font-family="monospace" letter-spacing="1">DBH (INCHES)</text>
    <rect x="12" y="98" width="174" height="14" rx="2" fill="#231c09" stroke="#c9973a" stroke-opacity="0.28" stroke-width="0.8"/>
    <text x="18" y="108" fill="#f0e8d0" fill-opacity="0.75" font-size="7" font-family="monospace">12.5</text>
    <circle cx="180" cy="98" r="6" fill="#c9973a"/>
    <text x="180" y="101" text-anchor="middle" fill="#100d04" font-size="6.5" font-weight="bold">3</text>

    <text x="194" y="96" fill="#c9973a" font-size="5.5" font-family="monospace" letter-spacing="1">DATE UPDATED</text>
    <rect x="194" y="98" width="174" height="14" rx="2" fill="#231c09" stroke="#c9973a" stroke-opacity="0.28" stroke-width="0.8"/>
    <text x="200" y="108" fill="#f0e8d0" fill-opacity="0.75" font-size="7" font-family="monospace">2026-04-28</text>

    <!-- ROW 4: Lat | Lng -->
    <text x="12" y="124" fill="#c9973a" font-size="5.5" font-family="monospace" letter-spacing="1">LATITUDE</text>
    <rect x="12" y="126" width="174" height="14" rx="2" fill="#231c09" stroke="#c9973a" stroke-opacity="0.28" stroke-width="0.8"/>
    <text x="18" y="136" fill="#f0e8d0" fill-opacity="0.35" font-size="7" font-family="monospace">e.g. 44.5521</text>

    <text x="194" y="124" fill="#c9973a" font-size="5.5" font-family="monospace" letter-spacing="1">LONGITUDE</text>
    <rect x="194" y="126" width="174" height="14" rx="2" fill="#231c09" stroke="#c9973a" stroke-opacity="0.28" stroke-width="0.8"/>
    <text x="200" y="136" fill="#f0e8d0" fill-opacity="0.35" font-size="7" font-family="monospace">e.g. -69.6317</text>

    <!-- OR divider -->
    <text x="190" y="152" text-anchor="middle" fill="#f0e8d0" fill-opacity="0.25" font-size="6.5" font-family="monospace">— or —</text>

    <!-- ROW 5: Place on map -->
    <rect x="12" y="156" width="356" height="18" rx="3" fill="#1b1507" stroke="#8fc67f" stroke-opacity="0.5" stroke-width="1"/>
    <text x="190" y="168" text-anchor="middle" fill="#8fc67f" font-size="8" font-family="monospace">Click &amp; Place on Map</text>
    <circle cx="362" cy="156" r="6" fill="#8fc67f"/>
    <text x="362" y="159" text-anchor="middle" fill="#100d04" font-size="6.5" font-weight="bold">4</text>

    <!-- ROW 6: Street + Auto-detect -->
    <text x="12" y="186" fill="#c9973a" font-size="5.5" font-family="monospace" letter-spacing="1">STREET</text>
    <rect x="12" y="188" width="248" height="14" rx="2" fill="#231c09" stroke="#c9973a" stroke-opacity="0.28" stroke-width="0.8"/>
    <text x="18" y="198" fill="#f0e8d0" fill-opacity="0.75" font-size="7" font-family="monospace">Main St</text>
    <text x="252" y="198" fill="#c9973a" font-size="7.5">▾</text>
    <rect x="266" y="188" width="102" height="14" rx="2" fill="#1b1507" stroke="#c9973a" stroke-opacity="0.5" stroke-width="1"/>
    <text x="317" y="198" text-anchor="middle" fill="#c9973a" font-size="7.5" font-family="monospace">Auto-detect</text>
    <circle cx="362" cy="188" r="6" fill="#c9973a"/>
    <text x="362" y="191" text-anchor="middle" fill="#100d04" font-size="6.5" font-weight="bold">5</text>

    <!-- ROW 7: Observations -->
    <text x="12" y="214" fill="#c9973a" font-size="5.5" font-family="monospace" letter-spacing="1">OBSERVATIONS</text>
    <rect x="12" y="216" width="356" height="20" rx="2" fill="#231c09" stroke="#c9973a" stroke-opacity="0.28" stroke-width="0.8"/>
    <rect x="18" y="221" width="6" height="6" rx="1" fill="#c9973a" fill-opacity="0.3" stroke="#c9973a" stroke-opacity="0.5" stroke-width="0.8"/>
    <text x="28" y="227" fill="#f0e8d0" fill-opacity="0.55" font-size="7" font-family="monospace">Cavity-stem</text>
    <rect x="100" y="221" width="6" height="6" rx="1" fill="#1b1507" stroke="#c9973a" stroke-opacity="0.4" stroke-width="0.8"/>
    <text x="110" y="227" fill="#f0e8d0" fill-opacity="0.55" font-size="7" font-family="monospace">Co-dominant stems</text>
    <rect x="222" y="221" width="6" height="6" rx="1" fill="#1b1507" stroke="#c9973a" stroke-opacity="0.4" stroke-width="0.8"/>
    <text x="232" y="227" fill="#f0e8d0" fill-opacity="0.55" font-size="7" font-family="monospace">Girdling roots</text>
    <circle cx="362" cy="216" r="6" fill="#c9973a"/>
    <text x="362" y="219" text-anchor="middle" fill="#100d04" font-size="6.5" font-weight="bold">6</text>

    <!-- legend band -->
    <rect x="0" y="232" width="380" height="44" fill="#0d0a02"/>
    <line x1="0" y1="232" x2="380" y2="232" stroke="#c9973a" stroke-opacity="0.18" stroke-width="1"/>
    <circle cx="10" cy="243" r="5" fill="#c9973a"/>
    <text x="10" y="246" text-anchor="middle" fill="#0d0a02" font-size="6" font-weight="bold">1</text>
    <text x="18" y="247" fill="#c9973a" font-size="7" font-family="monospace">Species name</text>
    <circle cx="108" cy="243" r="5" fill="#c9973a"/>
    <text x="108" y="246" text-anchor="middle" fill="#0d0a02" font-size="6" font-weight="bold">2</text>
    <text x="116" y="247" fill="#c9973a" font-size="7" font-family="monospace">Condition</text>
    <circle cx="192" cy="243" r="5" fill="#c9973a"/>
    <text x="192" y="246" text-anchor="middle" fill="#0d0a02" font-size="6" font-weight="bold">3</text>
    <text x="200" y="247" fill="#c9973a" font-size="7" font-family="monospace">Trunk diameter</text>
    <circle cx="10" cy="262" r="5" fill="#8fc67f"/>
    <text x="10" y="265" text-anchor="middle" fill="#0d0a02" font-size="6" font-weight="bold">4</text>
    <text x="18" y="266" fill="#8fc67f" font-size="7" font-family="monospace">Place on map</text>
    <circle cx="108" cy="262" r="5" fill="#c9973a"/>
    <text x="108" y="265" text-anchor="middle" fill="#0d0a02" font-size="6" font-weight="bold">5</text>
    <text x="116" y="266" fill="#c9973a" font-size="7" font-family="monospace">Auto-fill street</text>
    <circle cx="192" cy="262" r="5" fill="#c9973a"/>
    <text x="192" y="265" text-anchor="middle" fill="#0d0a02" font-size="6" font-weight="bold">6</text>
    <text x="200" y="266" fill="#c9973a" font-size="7" font-family="monospace">Observations</text>
  </svg>
</HelpDiagram>

<ol class="hd-steps">
  <li>Type the species common name ①. The scientific name fills in automatically if it's a known species.</li>
  <li>Choose the tree's condition and age class ②.</li>
  <li>Enter the trunk diameter in inches (DBH) ③.</li>
  <li>Click <strong>Click &amp; Place on Map</strong> ④ to pin the exact location — or type the latitude and longitude directly into the fields above.</li>
  <li>Click <strong>Auto-detect</strong> ⑤ to fill in the nearest street name, then confirm or correct it.</li>
  <li>Check any observations that apply ⑥ — these feed into the risk score.</li>
  <li>Click <strong>Add Tree</strong> to save.</li>
</ol>

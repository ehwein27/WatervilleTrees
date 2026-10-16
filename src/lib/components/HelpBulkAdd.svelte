<script>
  import HelpDiagram from '$lib/components/HelpDiagram.svelte';
</script>

<HelpDiagram caption="Step 1 — download the template, fill it in, then upload">
  <svg viewBox="0 0 380 222" xmlns="http://www.w3.org/2000/svg">
    <rect width="380" height="222" fill="#f5ede0"/>

    <!-- Card 1: Download Template -->
    <rect x="8" y="8" width="364" height="70" rx="6" fill="#f0e6d8" stroke="#7a501a" stroke-opacity="0.18" stroke-width="1"/>
    <text x="18" y="21" fill="#5c3d08" font-size="6" font-family="monospace" letter-spacing="1.2">STEP 1 — DOWNLOAD THE TEMPLATE</text>
    <line x1="8" y1="25" x2="372" y2="25" stroke="#7a501a" stroke-opacity="0.15" stroke-width="1"/>
    <circle cx="24" cy="44" r="8" fill="#1a5216"/>
    <text x="24" y="47" text-anchor="middle" fill="#fdf8f0" font-size="7.5" font-weight="bold">1</text>
    <text x="38" y="41" fill="#5c3d08" font-size="7.5" font-family="monospace">Download the spreadsheet template.</text>
    <text x="38" y="52" fill="#5c3d08" font-size="7" font-family="monospace" fill-opacity="0.7">One row per tree. Includes dropdowns for species,</text>
    <text x="38" y="61" fill="#5c3d08" font-size="7" font-family="monospace" fill-opacity="0.7">condition, and age class.</text>
    <rect x="18" y="56" width="148" height="14" rx="3" fill="#f0e6d8" stroke="#7a501a" stroke-opacity="0.3" stroke-width="1"/>
    <text x="92" y="66" text-anchor="middle" fill="#5c3d08" font-size="7.5" font-family="monospace">↓  Download Template (.xlsx)</text>
    <circle cx="160" cy="56" r="6" fill="#c9973a"/>
    <text x="160" y="59" text-anchor="middle" fill="#100d04" font-size="6.5" font-weight="bold">1</text>

    <!-- Card 2: Upload -->
    <rect x="8" y="86" width="364" height="88" rx="6" fill="#f0e6d8" stroke="#7a501a" stroke-opacity="0.18" stroke-width="1"/>
    <text x="18" y="99" fill="#5c3d08" font-size="6" font-family="monospace" letter-spacing="1.2">STEP 2 — UPLOAD YOUR FILLED SPREADSHEET</text>
    <line x1="8" y1="102" x2="372" y2="102" stroke="#7a501a" stroke-opacity="0.15" stroke-width="1"/>
    <rect x="18" y="108" width="344" height="58" rx="5" fill="#ede4d0" stroke="#7a501a" stroke-opacity="0.22" stroke-width="1.5" stroke-dasharray="4,3"/>
    <text x="190" y="128" text-anchor="middle" fill="#1a1208" fill-opacity="0.3" font-size="18">📂</text>
    <text x="190" y="144" text-anchor="middle" fill="#1a1208" font-size="8.5" font-family="monospace">Drop your spreadsheet here</text>
    <text x="190" y="155" text-anchor="middle" fill="#5c3d08" font-size="7" font-family="monospace">or click to browse · .xlsx and .csv</text>
    <circle cx="356" cy="108" r="6" fill="#c9973a"/>
    <text x="356" y="111" text-anchor="middle" fill="#100d04" font-size="6.5" font-weight="bold">2</text>

    <!-- Previous uploads -->
    <rect x="8" y="182" width="364" height="30" rx="6" fill="#f0e6d8" stroke="#7a501a" stroke-opacity="0.18" stroke-width="1"/>
    <text x="18" y="195" fill="#5c3d08" font-size="6" font-family="monospace" letter-spacing="1.2">PREVIOUS UPLOADS</text>
    <text x="18" y="206" fill="#7a6040" font-size="7" font-family="monospace" font-style="italic">Re-load any previously uploaded file from this list</text>
    <circle cx="366" cy="182" r="6" fill="#c9973a"/>
    <text x="366" y="185" text-anchor="middle" fill="#100d04" font-size="6.5" font-weight="bold">3</text>

    <rect x="0" y="214" width="380" height="8" fill="#e8ddc8"/>
    <line x1="0" y1="214" x2="380" y2="214" stroke="#7a501a" stroke-opacity="0.2" stroke-width="1"/>
  </svg>
</HelpDiagram>

<ol class="hd-steps">
  <li>Click <strong>Download Template</strong> ① and fill it in — one row per tree. Street number and street name are required for each row.</li>
  <li>Drop your completed file onto the upload area ② or click to browse.</li>
  <li>Previous uploads ③ are saved — you can re-open them any time.</li>
</ol>

<HelpDiagram caption="Step 2 — review results and resolve any issues before saving">
  <svg viewBox="0 0 380 218" xmlns="http://www.w3.org/2000/svg">
    <rect width="380" height="218" fill="#f5ede0"/>

    <rect x="8" y="8" width="364" height="138" rx="6" fill="#f0e6d8" stroke="#7a501a" stroke-opacity="0.18" stroke-width="1"/>
    <text x="18" y="21" fill="#5c3d08" font-size="6" font-family="monospace" letter-spacing="1.2">POTENTIAL DUPLICATE TREES</text>
    <line x1="8" y1="25" x2="372" y2="25" stroke="#7a501a" stroke-opacity="0.15" stroke-width="1"/>

    <!-- Table header -->
    <rect x="8" y="25" width="364" height="16" fill="#e8ddc8"/>
    <text x="60" y="36" text-anchor="middle" fill="#5c3d08" font-size="6" font-family="monospace" letter-spacing="0.8">YOUR ENTRY</text>
    <line x1="120" y1="25" x2="120" y2="146" stroke="#7a501a" stroke-opacity="0.12" stroke-width="1"/>
    <text x="196" y="36" text-anchor="middle" fill="#5c3d08" font-size="6" font-family="monospace" letter-spacing="0.8">EXISTING TREE</text>
    <line x1="272" y1="25" x2="272" y2="146" stroke="#7a501a" stroke-opacity="0.12" stroke-width="1"/>
    <text x="326" y="36" text-anchor="middle" fill="#5c3d08" font-size="6" font-family="monospace" letter-spacing="0.8">ACTION</text>

    <!-- Row 1: unresolved duplicate -->
    <rect x="8" y="41" width="364" height="30" fill="#fff7ec"/>
    <text x="18" y="53" fill="#1a1208" font-size="7.5" font-family="monospace" font-weight="bold">Silver Maple</text>
    <text x="18" y="63" fill="#5c3d08" font-size="6.5" font-family="monospace">14 Elm St</text>
    <text x="130" y="53" fill="#1a1208" font-size="7.5" font-family="monospace" font-weight="bold">Silver Maple</text>
    <text x="130" y="63" fill="#5c3d08" font-size="6.5" font-family="monospace">Tree #204</text>
    <rect x="278" y="44" width="46" height="11" rx="2" fill="#1a5216" fill-opacity="0.1" stroke="#1a5216" stroke-opacity="0.3" stroke-width="0.8"/>
    <text x="301" y="52" text-anchor="middle" fill="#1a5216" font-size="6" font-family="monospace">Add Anyway</text>
    <rect x="328" y="44" width="36" height="11" rx="2" fill="#5c3d08" fill-opacity="0.1" stroke="#5c3d08" stroke-opacity="0.3" stroke-width="0.8"/>
    <text x="346" y="52" text-anchor="middle" fill="#5c3d08" font-size="6" font-family="monospace">Replace</text>
    <text x="304" y="66" text-anchor="middle" fill="#5c3d08" font-size="6" font-family="monospace">— Skip</text>
    <circle cx="16" cy="41" r="6" fill="#c9973a"/>
    <text x="16" y="44" text-anchor="middle" fill="#100d04" font-size="6.5" font-weight="bold">4</text>

    <!-- Row 2: resolved -->
    <rect x="8" y="71" width="364" height="26" fill="#ede4d0" fill-opacity="0.5"/>
    <text x="18" y="83" fill="#1a1208" fill-opacity="0.5" font-size="7.5" font-family="monospace" font-weight="bold">Norway Maple</text>
    <text x="130" y="83" fill="#1a1208" fill-opacity="0.5" font-size="7.5" font-family="monospace" font-weight="bold">Norway Maple</text>
    <text x="282" y="83" fill="#5c3d08" fill-opacity="0.6" font-size="7" font-family="monospace" font-style="italic">↻ Replacing</text>
    <text x="282" y="91" fill="#5c3d08" fill-opacity="0.5" font-size="6" font-family="monospace">Undo</text>

    <!-- Row 3: geocode flagged -->
    <rect x="8" y="97" width="364" height="24" fill="#fdefd0" fill-opacity="0.4"/>
    <rect x="16" y="101" width="36" height="12" rx="2" fill="#d4ae30" fill-opacity="0.25" stroke="#d4ae30" stroke-opacity="0.5" stroke-width="0.8"/>
    <text x="34" y="109" text-anchor="middle" fill="#8a6010" font-size="6.5" font-family="monospace">Flagged</text>
    <text x="60" y="109" fill="#5c3d08" font-size="7" font-family="monospace">22 Oak Ave · address not found</text>
    <rect x="282" y="100" width="70" height="12" rx="2" fill="#1b1507" stroke="#8fc67f" stroke-opacity="0.4" stroke-width="0.8"/>
    <text x="317" y="108" text-anchor="middle" fill="#8fc67f" font-size="6.5" font-family="monospace">Place on Map</text>
    <circle cx="16" cy="97" r="6" fill="#d4ae30"/>
    <text x="16" y="100" text-anchor="middle" fill="#100d04" font-size="6.5" font-weight="bold">5</text>
    <circle cx="346" cy="97" r="6" fill="#8fc67f"/>
    <text x="346" y="100" text-anchor="middle" fill="#100d04" font-size="6.5" font-weight="bold">6</text>

    <!-- bulk actions -->
    <rect x="8" y="121" width="364" height="25" fill="#ede4d0" rx="0"/>
    <text x="200" y="137" text-anchor="middle" fill="#5c3d08" font-size="6.5" font-family="monospace">Skip all duplicates</text>
    <rect x="272" y="124" width="60" height="11" rx="2" fill="#5c3d08" fill-opacity="0.1" stroke="#5c3d08" stroke-opacity="0.3" stroke-width="0.8"/>
    <text x="302" y="132" text-anchor="middle" fill="#5c3d08" font-size="6.5" font-family="monospace">Replace all</text>

    <!-- submit button -->
    <rect x="8" y="154" width="364" height="20" rx="4" fill="#1a5216"/>
    <text x="190" y="167" text-anchor="middle" fill="#fdf8f0" font-size="8.5" font-family="monospace" font-weight="bold">✓  Add 2 Trees to Map</text>
    <circle cx="364" cy="154" r="6" fill="#c9973a"/>
    <text x="364" y="157" text-anchor="middle" fill="#100d04" font-size="6.5" font-weight="bold">7</text>

    <!-- legend -->
    <rect x="0" y="178" width="380" height="40" fill="#e8ddc8"/>
    <line x1="0" y1="178" x2="380" y2="178" stroke="#7a501a" stroke-opacity="0.2" stroke-width="1"/>
    <circle cx="10" cy="189" r="5" fill="#c9973a"/>
    <text x="10" y="192" text-anchor="middle" fill="#100d04" font-size="6" font-weight="bold">4</text>
    <text x="18" y="193" fill="#5c3d08" font-size="7" font-family="monospace">Duplicate match — choose action</text>
    <circle cx="190" cy="189" r="5" fill="#d4ae30"/>
    <text x="190" y="192" text-anchor="middle" fill="#100d04" font-size="6" font-weight="bold">5</text>
    <text x="198" y="193" fill="#5c3d08" font-size="7" font-family="monospace">Address not found</text>
    <circle cx="10" cy="208" r="5" fill="#8fc67f"/>
    <text x="10" y="211" text-anchor="middle" fill="#100d04" font-size="6" font-weight="bold">6</text>
    <text x="18" y="212" fill="#5c3d08" font-size="7" font-family="monospace">Pin manually on map</text>
    <circle cx="190" cy="208" r="5" fill="#c9973a"/>
    <text x="190" y="211" text-anchor="middle" fill="#100d04" font-size="6" font-weight="bold">7</text>
    <text x="198" y="212" fill="#5c3d08" font-size="7" font-family="monospace">Save when all rows resolved</text>
  </svg>
</HelpDiagram>

<ol class="hd-steps" style="counter-reset: hd-step 3">
  <li>After upload, the app tries to find each address on the map. Rows it can't find are marked <strong>Flagged</strong> ⑤.</li>
  <li>For duplicates ④, choose <strong>Skip</strong>, <strong>Add Anyway</strong>, or <strong>Replace</strong> the existing record.</li>
  <li>For flagged rows, click <strong>Place on Map</strong> ⑥ to pin the location manually.</li>
  <li>Once all rows are resolved, click <strong>Add Trees to Map</strong> ⑦ to save.</li>
</ol>

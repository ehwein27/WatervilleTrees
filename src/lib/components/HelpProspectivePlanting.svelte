<script>
  import HelpDiagram from '$lib/components/HelpDiagram.svelte';
</script>

<p>Plan future tree plantings before committing them to the live inventory.</p>

<HelpDiagram caption="Planting table — place proposals on the map, set priority, then convert when ready">
  <svg viewBox="0 0 380 210" xmlns="http://www.w3.org/2000/svg">
    <rect width="380" height="210" fill="#100d04"/>
    <!-- page bg (this view uses a parchment bg similar to BulkAdd) -->
    <rect x="0" y="0" width="380" height="210" fill="#fdf8f0"/>

    <!-- top bar -->
    <rect x="0" y="0" width="380" height="40" fill="#f5ede0"/>
    <line x1="0" y1="40" x2="380" y2="40" stroke="#7a501a" stroke-opacity="0.18" stroke-width="1"/>
    <text x="18" y="18" fill="#0f2e14" font-size="12" font-family="Georgia,serif">Prospective Planting</text>
    <text x="18" y="31" fill="#5c3d08" font-size="6.5" font-family="monospace">Plan new trees by species and priority before adding to the inventory</text>
    <!-- convert button -->
    <rect x="250" y="12" width="118" height="16" rx="3" fill="#1a5216"/>
    <text x="309" y="23" text-anchor="middle" fill="#fdf8f0" font-size="7.5" font-family="monospace" font-weight="bold">Convert to Bulk Add</text>
    <!-- callout ③ -->
    <circle cx="362" cy="12" r="6" fill="#c9973a"/>
    <text x="362" y="15" text-anchor="middle" fill="#100d04" font-size="6.5" font-weight="bold">3</text>

    <!-- table header -->
    <rect x="0" y="40" width="380" height="14" fill="#e8ddc8"/>
    <text x="12" y="50" fill="#5c3d08" font-size="6" font-family="monospace" letter-spacing="0.8">SPECIES</text>
    <text x="140" y="50" fill="#5c3d08" font-size="6" font-family="monospace" letter-spacing="0.8">PRIORITY</text>
    <text x="198" y="50" fill="#5c3d08" font-size="6" font-family="monospace" letter-spacing="0.8">LOCATION</text>
    <text x="314" y="50" fill="#5c3d08" font-size="6" font-family="monospace" letter-spacing="0.8">PLACE</text>
    <text x="346" y="50" fill="#5c3d08" font-size="6" font-family="monospace" letter-spacing="0.8">DEL</text>

    <!-- row 1 -->
    <rect x="0" y="54" width="380" height="24" fill="#fdf8f0"/>
    <text x="12" y="69" fill="#1a1208" font-size="8" font-family="monospace" font-weight="bold">American Elm</text>
    <!-- high priority badge -->
    <rect x="138" y="57" width="44" height="14" rx="3" fill="#1a5216" fill-opacity="0.15" stroke="#1a5216" stroke-opacity="0.4" stroke-width="1"/>
    <text x="160" y="67" text-anchor="middle" fill="#1a5216" font-size="7" font-family="monospace" font-weight="bold">High</text>
    <!-- callout ① (priority) -->
    <circle cx="138" cy="54" r="6" fill="#c9973a"/>
    <text x="138" y="57" text-anchor="middle" fill="#100d04" font-size="6.5" font-weight="bold">1</text>
    <text x="198" y="69" fill="#5c3d08" font-size="7" font-family="monospace">14 Elm St</text>
    <!-- map pin placed (green) -->
    <circle cx="322" cy="66" r="7" fill="#1a5216" fill-opacity="0.15" stroke="#1a5216" stroke-opacity="0.4" stroke-width="1"/>
    <text x="322" y="70" text-anchor="middle" fill="#1a5216" font-size="9">📍</text>
    <!-- callout ② (map pin) -->
    <circle cx="315" cy="54" r="6" fill="#8fc67f"/>
    <text x="315" y="57" text-anchor="middle" fill="#100d04" font-size="6.5" font-weight="bold">2</text>
    <text x="353" y="69" fill="#9e2020" font-size="11">×</text>

    <!-- row 2 -->
    <rect x="0" y="78" width="380" height="24" fill="#f5ede0"/>
    <text x="12" y="93" fill="#1a1208" font-size="8" font-family="monospace" font-weight="bold">Honey Locust</text>
    <!-- medium priority -->
    <rect x="138" y="81" width="52" height="14" rx="3" fill="#d4860a" fill-opacity="0.12" stroke="#d4860a" stroke-opacity="0.4" stroke-width="1"/>
    <text x="164" y="91" text-anchor="middle" fill="#8a6010" font-size="7" font-family="monospace" font-weight="bold">Medium</text>
    <text x="198" y="93" fill="#7a6040" font-size="7" font-family="monospace" font-style="italic">not placed</text>
    <!-- map pin unplaced (dim) -->
    <circle cx="322" cy="90" r="7" fill="#f0e6d0" stroke="#7a501a" stroke-opacity="0.25" stroke-width="1"/>
    <text x="322" y="94" text-anchor="middle" fill="#7a501a" fill-opacity="0.5" font-size="9">📍</text>
    <text x="353" y="93" fill="#9e2020" font-size="11">×</text>

    <!-- row 3 -->
    <rect x="0" y="102" width="380" height="24" fill="#fdf8f0"/>
    <text x="12" y="117" fill="#1a1208" font-size="8" font-family="monospace" font-weight="bold">Red Maple</text>
    <!-- low priority -->
    <rect x="138" y="105" width="36" height="14" rx="3" fill="#5c3d08" fill-opacity="0.08" stroke="#5c3d08" stroke-opacity="0.25" stroke-width="1"/>
    <text x="156" y="115" text-anchor="middle" fill="#7a6040" font-size="7" font-family="monospace" font-weight="bold">Low</text>
    <text x="198" y="117" fill="#5c3d08" font-size="7" font-family="monospace">7 College Ave</text>
    <circle cx="322" cy="114" r="7" fill="#1a5216" fill-opacity="0.15" stroke="#1a5216" stroke-opacity="0.4" stroke-width="1"/>
    <text x="322" y="118" text-anchor="middle" fill="#1a5216" font-size="9">📍</text>
    <text x="353" y="117" fill="#9e2020" font-size="11">×</text>

    <!-- add new row button -->
    <rect x="0" y="126" width="380" height="20" fill="#f5ede0"/>
    <line x1="0" y1="126" x2="380" y2="126" stroke="#7a501a" stroke-opacity="0.12" stroke-width="1"/>
    <text x="190" y="139" text-anchor="middle" fill="#7a6040" font-size="7.5" font-family="monospace">+ Add row</text>

    <!-- report + summary row -->
    <line x1="0" y1="150" x2="380" y2="150" stroke="#7a501a" stroke-opacity="0.15" stroke-width="1"/>
    <rect x="8" y="157" width="100" height="14" rx="3" fill="#f0e6d0" stroke="#7a501a" stroke-opacity="0.28" stroke-width="1"/>
    <text x="58" y="167" text-anchor="middle" fill="#5c3d08" font-size="7.5" font-family="monospace">Generate Report</text>
    <text x="120" y="167" fill="#5c3d08" fill-opacity="0.5" font-size="7" font-family="monospace">3 proposals · 2 placed · 1 pending</text>

    <!-- legend -->
    <rect x="0" y="196" width="380" height="14" fill="#e8ddc8"/>
    <line x1="0" y1="196" x2="380" y2="196" stroke="#7a501a" stroke-opacity="0.2" stroke-width="1"/>
    <circle cx="10" cy="204" r="4" fill="#c9973a"/>
    <text x="10" y="206.5" text-anchor="middle" fill="#100d04" font-size="5.5" font-weight="bold">1</text>
    <text x="17" y="206" fill="#5c3d08" font-size="6.5" font-family="monospace">Priority (High / Medium / Low)</text>
    <circle cx="140" cy="204" r="4" fill="#8fc67f"/>
    <text x="140" y="206.5" text-anchor="middle" fill="#100d04" font-size="5.5" font-weight="bold">2</text>
    <text x="147" y="206" fill="#5c3d08" font-size="6.5" font-family="monospace">Map placement pin</text>
    <circle cx="252" cy="204" r="4" fill="#c9973a"/>
    <text x="252" y="206.5" text-anchor="middle" fill="#100d04" font-size="5.5" font-weight="bold">3</text>
    <text x="259" y="206" fill="#5c3d08" font-size="6.5" font-family="monospace">Convert to Bulk Add</text>
  </svg>
</HelpDiagram>

<ol class="hd-steps">
  <li>Add rows to the planting plan — each row has a species, priority level, and optional location or notes.</li>
  <li>Click a row's map pin icon to place it on the map, giving it a proposed address and coordinates.</li>
  <li>Assign priority (High / Medium / Low) to help sequence plantings.</li>
  <li>Generate a planting report (PDF) for presentation or grant applications.</li>
  <li>When ready to convert proposals to real inventory additions, click <strong>Convert to Bulk Add</strong> — the plan becomes a pre-filled Bulk Add upload that you can review and submit.</li>
</ol>

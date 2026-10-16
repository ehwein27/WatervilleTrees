<script>
  import HelpDiagram from '$lib/components/HelpDiagram.svelte';
</script>

<HelpDiagram caption="Select trees on the map, then use the banner to update their condition">
  <svg viewBox="0 0 380 172" xmlns="http://www.w3.org/2000/svg">
    <!-- map bg -->
    <rect width="380" height="172" fill="#2d3a2e"/>
    <line x1="0" y1="55" x2="380" y2="55" stroke="#4a5e4b" stroke-width="12" stroke-opacity="0.5"/>
    <line x1="120" y1="0" x2="120" y2="120" stroke="#4a5e4b" stroke-width="8" stroke-opacity="0.4"/>
    <line x1="260" y1="0" x2="260" y2="120" stroke="#4a5e4b" stroke-width="8" stroke-opacity="0.4"/>

    <!-- unselected tree markers -->
    <circle cx="80" cy="38" r="7" fill="#5ec254" stroke="#fff" stroke-opacity="0.3" stroke-width="1"/>
    <circle cx="155" cy="42" r="7" fill="#5ec254" stroke="#fff" stroke-opacity="0.3" stroke-width="1"/>

    <!-- selected trees (gold ring) -->
    <circle cx="210" cy="32" r="10" fill="none" stroke="#c9973a" stroke-width="2.5"/>
    <circle cx="210" cy="32" r="6" fill="#e8c34a" stroke="#fff" stroke-opacity="0.3" stroke-width="1"/>
    <circle cx="310" cy="48" r="10" fill="none" stroke="#c9973a" stroke-width="2.5"/>
    <circle cx="310" cy="48" r="6" fill="#e8c34a" stroke="#fff" stroke-opacity="0.3" stroke-width="1"/>
    <circle cx="350" cy="25" r="10" fill="none" stroke="#c9973a" stroke-width="2.5"/>
    <circle cx="350" cy="25" r="6" fill="#e07a30" stroke="#fff" stroke-opacity="0.3" stroke-width="1"/>

    <!-- callout ① selected tree ring -->
    <circle cx="220" cy="23" r="6" fill="#c9973a"/>
    <text x="220" y="26" text-anchor="middle" fill="#100d04" font-size="6.5" font-weight="bold">1</text>

    <!-- Banner -->
    <rect x="20" y="112" width="340" height="42" rx="7" fill="#1b1507" stroke="#c9973a" stroke-opacity="0.55" stroke-width="1"/>

    <text x="32" y="127" fill="#f0e8d0" fill-opacity="0.5" font-size="7" font-family="monospace">Bulk update:</text>
    <text x="90" y="128" fill="#8fc67f" font-size="9" font-family="Georgia,serif" font-weight="bold">3</text>
    <text x="100" y="127" fill="#f0e8d0" fill-opacity="0.5" font-size="7" font-family="monospace">trees selected</text>
    <line x1="148" y1="116" x2="148" y2="150" stroke="#c9973a" stroke-opacity="0.22" stroke-width="1"/>
    <text x="156" y="127" fill="#f0e8d0" fill-opacity="0.5" font-size="7" font-family="monospace">Set condition:</text>

    <!-- condition buttons -->
    <rect x="214" y="117" width="30" height="14" rx="3" fill="#1b1507" stroke="#5ec254" stroke-opacity="0.7" stroke-width="1"/>
    <text x="229" y="127" text-anchor="middle" fill="#5ec254" font-size="7" font-family="monospace">Good</text>
    <rect x="248" y="117" width="26" height="14" rx="3" fill="#1b1507" stroke="#e8c34a" stroke-opacity="0.7" stroke-width="1"/>
    <text x="261" y="127" text-anchor="middle" fill="#e8c34a" font-size="7" font-family="monospace">Fair</text>
    <rect x="278" y="117" width="26" height="14" rx="3" fill="#1b1507" stroke="#e07a30" stroke-opacity="0.7" stroke-width="1"/>
    <text x="291" y="127" text-anchor="middle" fill="#e07a30" font-size="7" font-family="monospace">Poor</text>
    <rect x="308" y="117" width="26" height="14" rx="3" fill="#1b1507" stroke="#d04444" stroke-opacity="0.7" stroke-width="1"/>
    <text x="321" y="127" text-anchor="middle" fill="#d04444" font-size="7" font-family="monospace">Dead</text>
    <line x1="338" y1="116" x2="338" y2="150" stroke="#c9973a" stroke-opacity="0.22" stroke-width="1"/>
    <text x="352" y="128" fill="#f0e8d0" fill-opacity="0.4" font-size="10" font-family="monospace">✕</text>

    <!-- count + buttons label row -->
    <text x="32" y="148" fill="#f0e8d0" fill-opacity="0.3" font-size="6.5" font-family="monospace">Tap trees on map to select</text>
    <text x="214" y="148" fill="#f0e8d0" fill-opacity="0.3" font-size="6.5" font-family="monospace">Click to update all at once</text>

    <!-- callout ② condition buttons -->
    <circle cx="358" cy="117" r="6" fill="#c9973a"/>
    <text x="358" y="120" text-anchor="middle" fill="#100d04" font-size="6.5" font-weight="bold">2</text>

    <!-- callout ③ count -->
    <circle cx="90" cy="112" r="6" fill="#8fc67f"/>
    <text x="90" y="115" text-anchor="middle" fill="#100d04" font-size="6.5" font-weight="bold">3</text>

    <!-- legend -->
    <rect x="0" y="158" width="380" height="14" fill="#100d04"/>
    <line x1="0" y1="158" x2="380" y2="158" stroke="#c9973a" stroke-opacity="0.15" stroke-width="1"/>
    <circle cx="10" cy="166" r="4" fill="#c9973a"/>
    <text x="10" y="168.5" text-anchor="middle" fill="#100d04" font-size="5.5" font-weight="bold">1</text>
    <text x="17" y="168" fill="#c9973a" font-size="6.5" font-family="monospace">Selected tree (gold ring)</text>
    <circle cx="140" cy="166" r="4" fill="#c9973a"/>
    <text x="140" y="168.5" text-anchor="middle" fill="#100d04" font-size="5.5" font-weight="bold">2</text>
    <text x="147" y="168" fill="#c9973a" font-size="6.5" font-family="monospace">Condition buttons</text>
    <circle cx="260" cy="166" r="4" fill="#8fc67f"/>
    <text x="260" y="168.5" text-anchor="middle" fill="#100d04" font-size="5.5" font-weight="bold">3</text>
    <text x="267" y="168" fill="#8fc67f" font-size="6.5" font-family="monospace">Selected count</text>
  </svg>
</HelpDiagram>

<ol class="hd-steps">
  <li>Open <strong>Reports &amp; Tasks</strong> and choose <strong>Bulk Condition Update</strong>.</li>
  <li>Tap trees on the map to select them. Selected trees show a gold ring ①.</li>
  <li>The banner at the bottom shows how many trees are selected ③.</li>
  <li>Click <strong>Good</strong>, <strong>Fair</strong>, <strong>Poor</strong>, or <strong>Dead</strong> ② to update all selected trees at once.</li>
</ol>

<p class="hd-note">Handy after a field survey when you need to update a whole street without opening each tree one by one.</p>

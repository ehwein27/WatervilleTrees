<script>
  import HelpDiagram from '$lib/components/HelpDiagram.svelte';
</script>

<HelpDiagram caption="Street list — colored dot shows the worst condition on that street">
  <svg viewBox="0 0 380 210" xmlns="http://www.w3.org/2000/svg">
    <rect width="380" height="210" fill="#100d04"/>
    <rect x="5" y="4" width="370" height="198" rx="7" fill="#1b1507" stroke="#c9973a" stroke-opacity="0.22" stroke-width="1"/>

    <!-- header -->
    <rect x="5" y="4" width="370" height="32" rx="7" fill="#1b1507"/>
    <rect x="5" y="22" width="370" height="14" fill="#1b1507"/>
    <text x="22" y="22" fill="#8fc67f" font-size="10" font-family="Georgia,serif">Work Order</text>
    <text x="22" y="30" fill="#8fc67f" font-size="7.5" font-family="monospace">New</text>
    <text x="58" y="30" fill="#f0e8d0" fill-opacity="0.4" font-size="7.5" font-family="monospace">Saved</text>
    <line x1="22" y1="35" x2="46" y2="35" stroke="#8fc67f" stroke-width="1.5"/>
    <line x1="5" y1="35" x2="375" y2="35" stroke="#c9973a" stroke-opacity="0.15" stroke-width="1"/>

    <!-- search -->
    <rect x="12" y="40" width="356" height="14" rx="3" fill="#231c09" stroke="#c9973a" stroke-opacity="0.25" stroke-width="0.8"/>
    <text x="18" y="50" fill="#f0e8d0" fill-opacity="0.3" font-size="7" font-family="monospace">Filter streets…</text>

    <!-- street rows -->
    <rect x="5" y="58" width="370" height="24" fill="#231c09" fill-opacity="0.5"/>
    <circle cx="22" cy="70" r="5.5" fill="#e07a30"/>
    <text x="36" y="74" fill="#f0e8d0" font-size="8.5" font-family="monospace">College Ave</text>
    <text x="338" y="71" fill="#f0e8d0" fill-opacity="0.4" font-size="7.5" font-family="monospace">12</text>
    <text x="356" y="71" fill="#f0e8d0" fill-opacity="0.4" font-size="9" font-family="monospace">›</text>
    <circle cx="22" cy="58" r="6" fill="#c9973a"/>
    <text x="22" y="61" text-anchor="middle" fill="#100d04" font-size="6.5" font-weight="bold">1</text>

    <line x1="5" y1="82" x2="375" y2="82" stroke="#c9973a" stroke-opacity="0.1" stroke-width="1"/>
    <rect x="5" y="83" width="370" height="24" fill="#1b1507"/>
    <circle cx="22" cy="95" r="5.5" fill="#d04444"/>
    <text x="36" y="99" fill="#f0e8d0" font-size="8.5" font-family="monospace">Elm St</text>
    <text x="338" y="96" fill="#f0e8d0" fill-opacity="0.4" font-size="7.5" font-family="monospace">7</text>
    <text x="356" y="96" fill="#f0e8d0" fill-opacity="0.4" font-size="9" font-family="monospace">›</text>
    <circle cx="350" cy="83" r="6" fill="#c9973a"/>
    <text x="350" y="86" text-anchor="middle" fill="#100d04" font-size="6.5" font-weight="bold">2</text>

    <line x1="5" y1="107" x2="375" y2="107" stroke="#c9973a" stroke-opacity="0.1" stroke-width="1"/>
    <rect x="5" y="108" width="370" height="24" fill="#231c09" fill-opacity="0.5"/>
    <circle cx="22" cy="120" r="5.5" fill="#5ec254"/>
    <text x="36" y="124" fill="#f0e8d0" font-size="8.5" font-family="monospace">Grove St</text>
    <text x="338" y="121" fill="#f0e8d0" fill-opacity="0.4" font-size="7.5" font-family="monospace">9</text>
    <text x="356" y="121" fill="#f0e8d0" fill-opacity="0.4" font-size="9" font-family="monospace">›</text>

    <line x1="5" y1="132" x2="375" y2="132" stroke="#c9973a" stroke-opacity="0.1" stroke-width="1"/>
    <rect x="5" y="133" width="370" height="24" fill="#1b1507"/>
    <circle cx="22" cy="145" r="5.5" fill="#e8c34a"/>
    <text x="36" y="149" fill="#f0e8d0" font-size="8.5" font-family="monospace">Main St</text>
    <text x="338" y="146" fill="#f0e8d0" fill-opacity="0.4" font-size="7.5" font-family="monospace">24</text>
    <text x="356" y="146" fill="#f0e8d0" fill-opacity="0.4" font-size="9" font-family="monospace">›</text>

    <!-- condition key -->
    <line x1="5" y1="162" x2="375" y2="162" stroke="#c9973a" stroke-opacity="0.15" stroke-width="1"/>
    <circle cx="18" cy="173" r="4" fill="#5ec254"/>
    <text x="26" y="176" fill="#f0e8d0" fill-opacity="0.5" font-size="7" font-family="monospace">Good</text>
    <circle cx="64" cy="173" r="4" fill="#e8c34a"/>
    <text x="72" y="176" fill="#f0e8d0" fill-opacity="0.5" font-size="7" font-family="monospace">Fair</text>
    <circle cx="106" cy="173" r="4" fill="#e07a30"/>
    <text x="114" y="176" fill="#f0e8d0" fill-opacity="0.5" font-size="7" font-family="monospace">Poor</text>
    <circle cx="148" cy="173" r="4" fill="#d04444"/>
    <text x="156" y="176" fill="#f0e8d0" fill-opacity="0.5" font-size="7" font-family="monospace">Dead</text>
    <text x="210" y="176" fill="#f0e8d0" fill-opacity="0.3" font-size="6.5" font-family="monospace">(shows worst condition on street)</text>

    <rect x="0" y="198" width="380" height="12" fill="#0d0a02"/>
    <line x1="0" y1="198" x2="380" y2="198" stroke="#c9973a" stroke-opacity="0.15" stroke-width="1"/>
    <circle cx="10" cy="205" r="4" fill="#c9973a"/>
    <text x="10" y="207.5" text-anchor="middle" fill="#0d0a02" font-size="5.5" font-weight="bold">1</text>
    <text x="17" y="207" fill="#c9973a" font-size="6.5" font-family="monospace">Condition dot (worst on street)</text>
    <circle cx="160" cy="205" r="4" fill="#c9973a"/>
    <text x="160" y="207.5" text-anchor="middle" fill="#0d0a02" font-size="5.5" font-weight="bold">2</text>
    <text x="167" y="207" fill="#c9973a" font-size="6.5" font-family="monospace">Tree count</text>
  </svg>
</HelpDiagram>

<ol class="hd-steps">
  <li>Click a street ① to open its tree list.</li>
  <li>Check the box next to each tree that needs work.</li>
  <li>For each checked tree, pick a work type (Pruning, Removal, Stump Grinding, etc.) and enter a cost.</li>
  <li>Repeat for other streets.</li>
</ol>

<HelpDiagram caption="Tree detail — check a tree, assign work type and cost, then save">
  <svg viewBox="0 0 380 210" xmlns="http://www.w3.org/2000/svg">
    <rect width="380" height="210" fill="#100d04"/>
    <rect x="5" y="4" width="370" height="198" rx="7" fill="#1b1507" stroke="#c9973a" stroke-opacity="0.22" stroke-width="1"/>

    <!-- header -->
    <rect x="5" y="4" width="370" height="32" rx="7" fill="#1b1507"/>
    <rect x="5" y="22" width="370" height="14" fill="#1b1507"/>
    <text x="22" y="22" fill="#c9973a" font-size="7.5" font-family="monospace">← Streets</text>
    <text x="130" y="22" fill="#f0e8d0" font-size="9" font-family="Georgia,serif">Elm St</text>
    <text x="130" y="30" fill="#c9973a" font-size="6.5" font-family="monospace">7 trees</text>
    <line x1="5" y1="35" x2="375" y2="35" stroke="#c9973a" stroke-opacity="0.18" stroke-width="1"/>

    <!-- mini-map inset -->
    <rect x="248" y="40" width="120" height="82" rx="4" fill="#2d3a2e" stroke="#c9973a" stroke-opacity="0.25" stroke-width="1"/>
    <line x1="248" y1="81" x2="368" y2="81" stroke="#4a5e4b" stroke-width="10" stroke-opacity="0.5"/>
    <circle cx="278" cy="81" r="5" fill="#d04444" stroke="#fff" stroke-opacity="0.3" stroke-width="1"/>
    <circle cx="302" cy="81" r="5" fill="#d04444" stroke="#fff" stroke-opacity="0.3" stroke-width="1"/>
    <circle cx="326" cy="81" r="5" fill="#e07a30" stroke="#fff" stroke-opacity="0.3" stroke-width="1"/>
    <circle cx="350" cy="81" r="5" fill="#5ec254" stroke="#fff" stroke-opacity="0.3" stroke-width="1"/>
    <text x="308" y="112" text-anchor="middle" fill="#f0e8d0" fill-opacity="0.3" font-size="6.5" font-family="monospace">Elm St</text>
    <circle cx="248" cy="40" r="6" fill="#c9973a"/>
    <text x="248" y="43" text-anchor="middle" fill="#100d04" font-size="6.5" font-weight="bold">3</text>

    <!-- Tree row 1 (selected) -->
    <rect x="5" y="38" width="238" height="30" fill="#231c09" fill-opacity="0.7"/>
    <rect x="13" y="46" width="10" height="10" rx="1.5" fill="#c9973a" fill-opacity="0.9"/>
    <text x="13" y="54" fill="#100d04" font-size="7.5" font-weight="bold">✓</text>
    <circle cx="32" cy="51" r="4.5" fill="#d04444"/>
    <text x="42" y="50" fill="#f0e8d0" font-size="8" font-family="monospace" font-weight="bold">White Ash</text>
    <text x="42" y="60" fill="#c9973a" font-size="6" font-family="monospace">#88 · Dead · 18"</text>
    <circle cx="13" cy="38" r="6" fill="#c9973a"/>
    <text x="13" y="41" text-anchor="middle" fill="#100d04" font-size="6.5" font-weight="bold">1</text>

    <!-- Work type + cost row -->
    <rect x="5" y="69" width="238" height="26" fill="#1b1507"/>
    <rect x="13" y="72" width="106" height="14" rx="2" fill="#231c09" stroke="#c9973a" stroke-opacity="0.28" stroke-width="0.8"/>
    <text x="19" y="82" fill="#f0e8d0" fill-opacity="0.75" font-size="7.5" font-family="monospace">Removal</text>
    <text x="109" y="82" fill="#c9973a" font-size="7.5">▾</text>
    <rect x="126" y="72" width="58" height="14" rx="2" fill="#231c09" stroke="#c9973a" stroke-opacity="0.28" stroke-width="0.8"/>
    <text x="130" y="82" fill="#f0e8d0" fill-opacity="0.75" font-size="7.5" font-family="monospace">$850</text>
    <text x="173" y="79" fill="#c9973a" font-size="6" font-family="monospace">cost</text>
    <circle cx="13" cy="69" r="6" fill="#c9973a"/>
    <text x="13" y="72" text-anchor="middle" fill="#100d04" font-size="6.5" font-weight="bold">2</text>

    <!-- Tree row 2 (unchecked) -->
    <line x1="5" y1="96" x2="243" y2="96" stroke="#c9973a" stroke-opacity="0.1" stroke-width="1"/>
    <rect x="5" y="97" width="238" height="26" fill="#231c09" fill-opacity="0.3"/>
    <rect x="13" y="105" width="10" height="10" rx="1.5" fill="#1b1507" stroke="#c9973a" stroke-opacity="0.35" stroke-width="0.8"/>
    <circle cx="32" cy="110" r="4.5" fill="#e07a30"/>
    <text x="42" y="109" fill="#f0e8d0" fill-opacity="0.7" font-size="8" font-family="monospace" font-weight="bold">Norway Maple</text>
    <text x="42" y="119" fill="#c9973a" font-size="6" font-family="monospace">#92 · Poor · 12"</text>

    <!-- Tree row 3 -->
    <line x1="5" y1="124" x2="243" y2="124" stroke="#c9973a" stroke-opacity="0.1" stroke-width="1"/>
    <rect x="5" y="125" width="238" height="26" fill="#1b1507"/>
    <rect x="13" y="133" width="10" height="10" rx="1.5" fill="#1b1507" stroke="#c9973a" stroke-opacity="0.35" stroke-width="0.8"/>
    <circle cx="32" cy="138" r="4.5" fill="#5ec254"/>
    <text x="42" y="137" fill="#f0e8d0" fill-opacity="0.7" font-size="8" font-family="monospace" font-weight="bold">Red Oak</text>
    <text x="42" y="147" fill="#c9973a" font-size="6" font-family="monospace">#101 · Good · 22"</text>

    <!-- Save section -->
    <line x1="5" y1="155" x2="375" y2="155" stroke="#c9973a" stroke-opacity="0.15" stroke-width="1"/>
    <text x="12" y="166" fill="#c9973a" font-size="5.5" font-family="monospace" letter-spacing="1">ORDER NAME</text>
    <rect x="12" y="168" width="250" height="14" rx="2" fill="#231c09" stroke="#c9973a" stroke-opacity="0.28" stroke-width="0.8"/>
    <text x="18" y="178" fill="#f0e8d0" fill-opacity="0.75" font-size="7.5" font-family="monospace">Elm St Removals — Spring 2026</text>
    <rect x="270" y="168" width="98" height="14" rx="3" fill="#1a5216"/>
    <text x="319" y="178" text-anchor="middle" fill="#fdf8f0" font-size="7.5" font-family="monospace" font-weight="bold">Save Order</text>
    <circle cx="362" cy="168" r="6" fill="#c9973a"/>
    <text x="362" y="171" text-anchor="middle" fill="#100d04" font-size="6.5" font-weight="bold">4</text>

    <!-- Status -->
    <text x="12" y="196" fill="#f0e8d0" fill-opacity="0.3" font-size="6.5" font-family="monospace">Status: Created → Submitted → In Progress → Complete</text>
    <circle cx="362" cy="192" r="6" fill="#c9973a"/>
    <text x="362" y="195" text-anchor="middle" fill="#100d04" font-size="6.5" font-weight="bold">5</text>

    <rect x="0" y="202" width="380" height="8" fill="#0d0a02"/>
    <line x1="0" y1="202" x2="380" y2="202" stroke="#c9973a" stroke-opacity="0.15" stroke-width="1"/>
    <circle cx="10" cy="207" r="3" fill="#c9973a"/>
    <text x="10" y="208.5" text-anchor="middle" fill="#0d0a02" font-size="5" font-weight="bold">1</text>
    <text x="16" y="208" fill="#c9973a" font-size="6" font-family="monospace">Check tree</text>
    <circle cx="80" cy="207" r="3" fill="#c9973a"/>
    <text x="80" y="208.5" text-anchor="middle" fill="#0d0a02" font-size="5" font-weight="bold">2</text>
    <text x="86" y="208" fill="#c9973a" font-size="6" font-family="monospace">Work type + cost</text>
    <circle cx="185" cy="207" r="3" fill="#c9973a"/>
    <text x="185" y="208.5" text-anchor="middle" fill="#0d0a02" font-size="5" font-weight="bold">3</text>
    <text x="191" y="208" fill="#c9973a" font-size="6" font-family="monospace">Street map</text>
    <circle cx="260" cy="207" r="3" fill="#c9973a"/>
    <text x="260" y="208.5" text-anchor="middle" fill="#0d0a02" font-size="5" font-weight="bold">4</text>
    <text x="266" y="208" fill="#c9973a" font-size="6" font-family="monospace">Save order</text>
    <circle cx="325" cy="207" r="3" fill="#c9973a"/>
    <text x="325" y="208.5" text-anchor="middle" fill="#0d0a02" font-size="5" font-weight="bold">5</text>
    <text x="331" y="208" fill="#c9973a" font-size="6" font-family="monospace">Track status</text>
  </svg>
</HelpDiagram>

<ol class="hd-steps" style="counter-reset: hd-step 4">
  <li>Give the work order a name and click <strong>Save Order</strong> ④.</li>
  <li>Open the <strong>Saved</strong> tab to find it. Update the status ⑤ as work progresses: Created → Submitted → In Progress → Complete.</li>
</ol>

<p class="hd-note">The mini-map ③ inside the work order shows the selected street with tree markers color-coded by condition.</p>

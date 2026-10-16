<script>
  import HelpDiagram from '$lib/components/HelpDiagram.svelte';
</script>

<HelpDiagram caption="Enter your rates on the left — the cost breakdown on the right updates live">
  <svg viewBox="0 0 380 224" xmlns="http://www.w3.org/2000/svg">
    <rect width="380" height="224" fill="#100d04"/>
    <rect x="5" y="4" width="370" height="212" rx="7" fill="#1b1507" stroke="#c9973a" stroke-opacity="0.22" stroke-width="1"/>

    <!-- header -->
    <rect x="5" y="4" width="370" height="32" rx="7" fill="#1b1507"/>
    <rect x="5" y="22" width="370" height="14" fill="#1b1507"/>
    <text x="22" y="22" fill="#8fc67f" font-size="10" font-family="Georgia,serif">Removal Cost Estimate</text>
    <text x="22" y="30" fill="#c9973a" fill-opacity="0.7" font-size="6.5" font-family="monospace">Enter your actual contractor rates below</text>
    <line x1="5" y1="35" x2="375" y2="35" stroke="#c9973a" stroke-opacity="0.18" stroke-width="1"/>

    <!-- filter row -->
    <text x="12" y="47" fill="#c9973a" font-size="6" font-family="monospace" letter-spacing="0.8">FILTER</text>
    <rect x="40" y="40" width="72" height="12" rx="2" fill="#231c09" stroke="#c9973a" stroke-opacity="0.28" stroke-width="0.8"/>
    <text x="46" y="49" fill="#f0e8d0" fill-opacity="0.65" font-size="7" font-family="monospace">All streets</text>
    <text x="103" y="49" fill="#c9973a" font-size="7">▾</text>
    <rect x="118" y="40" width="76" height="12" rx="2" fill="#231c09" stroke="#c9973a" stroke-opacity="0.28" stroke-width="0.8"/>
    <text x="124" y="49" fill="#f0e8d0" fill-opacity="0.65" font-size="7" font-family="monospace">Poor + Dead</text>
    <text x="185" y="49" fill="#c9973a" font-size="7">▾</text>
    <circle cx="188" cy="40" r="6" fill="#c9973a"/>
    <text x="188" y="43" text-anchor="middle" fill="#100d04" font-size="6.5" font-weight="bold">4</text>

    <!-- Rate table (left) -->
    <rect x="5" y="56" width="188" height="148" fill="#1b1507"/>
    <text x="12" y="67" fill="#c9973a" font-size="6" font-family="monospace" letter-spacing="1">TRUNK SIZE</text>
    <text x="148" y="67" fill="#c9973a" font-size="6" font-family="monospace" letter-spacing="1">$/TREE</text>
    <line x1="5" y1="70" x2="193" y2="70" stroke="#c9973a" stroke-opacity="0.15" stroke-width="1"/>

    <!-- Small -->
    <rect x="5" y="71" width="188" height="22" fill="#231c09" fill-opacity="0.5"/>
    <text x="12" y="80" fill="#f0e8d0" fill-opacity="0.55" font-size="6" font-family="monospace">SMALL</text>
    <text x="12" y="89" fill="#f0e8d0" fill-opacity="0.75" font-size="7" font-family="monospace">DBH under 6"</text>
    <rect x="138" y="73" width="48" height="14" rx="2" fill="#231c09" stroke="#c9973a" stroke-opacity="0.3" stroke-width="0.8"/>
    <text x="144" y="83" fill="#f0e8d0" fill-opacity="0.8" font-size="7.5" font-family="monospace">$250</text>
    <circle cx="138" cy="71" r="6" fill="#c9973a"/>
    <text x="138" y="74" text-anchor="middle" fill="#100d04" font-size="6.5" font-weight="bold">1</text>

    <!-- Medium -->
    <line x1="5" y1="93" x2="193" y2="93" stroke="#c9973a" stroke-opacity="0.08" stroke-width="1"/>
    <rect x="5" y="94" width="188" height="22" fill="#1b1507"/>
    <text x="12" y="103" fill="#f0e8d0" fill-opacity="0.55" font-size="6" font-family="monospace">MEDIUM</text>
    <text x="12" y="112" fill="#f0e8d0" fill-opacity="0.75" font-size="7" font-family="monospace">DBH 6–12"</text>
    <rect x="138" y="96" width="48" height="14" rx="2" fill="#231c09" stroke="#c9973a" stroke-opacity="0.3" stroke-width="0.8"/>
    <text x="144" y="106" fill="#f0e8d0" fill-opacity="0.8" font-size="7.5" font-family="monospace">$500</text>
    <circle cx="12" cy="94" r="6" fill="#c9973a"/>
    <text x="12" y="97" text-anchor="middle" fill="#100d04" font-size="6.5" font-weight="bold">2</text>

    <!-- Large -->
    <line x1="5" y1="116" x2="193" y2="116" stroke="#c9973a" stroke-opacity="0.08" stroke-width="1"/>
    <rect x="5" y="117" width="188" height="22" fill="#231c09" fill-opacity="0.5"/>
    <text x="12" y="126" fill="#f0e8d0" fill-opacity="0.55" font-size="6" font-family="monospace">LARGE</text>
    <text x="12" y="135" fill="#f0e8d0" fill-opacity="0.75" font-size="7" font-family="monospace">DBH 12–24"</text>
    <rect x="138" y="119" width="48" height="14" rx="2" fill="#231c09" stroke="#c9973a" stroke-opacity="0.3" stroke-width="0.8"/>
    <text x="144" y="129" fill="#f0e8d0" fill-opacity="0.8" font-size="7.5" font-family="monospace">$900</text>

    <!-- Very Large -->
    <line x1="5" y1="139" x2="193" y2="139" stroke="#c9973a" stroke-opacity="0.08" stroke-width="1"/>
    <rect x="5" y="140" width="188" height="22" fill="#1b1507"/>
    <text x="12" y="149" fill="#f0e8d0" fill-opacity="0.55" font-size="6" font-family="monospace">VERY LARGE</text>
    <text x="12" y="158" fill="#f0e8d0" fill-opacity="0.75" font-size="7" font-family="monospace">DBH 24–36"</text>
    <rect x="138" y="142" width="48" height="14" rx="2" fill="#231c09" stroke="#c9973a" stroke-opacity="0.3" stroke-width="0.8"/>
    <text x="144" y="152" fill="#f0e8d0" fill-opacity="0.8" font-size="7.5" font-family="monospace">$1,500</text>

    <!-- Exceptional -->
    <line x1="5" y1="162" x2="193" y2="162" stroke="#c9973a" stroke-opacity="0.08" stroke-width="1"/>
    <rect x="5" y="163" width="188" height="22" fill="#231c09" fill-opacity="0.5"/>
    <text x="12" y="172" fill="#f0e8d0" fill-opacity="0.55" font-size="6" font-family="monospace">EXCEPTIONAL</text>
    <text x="12" y="181" fill="#f0e8d0" fill-opacity="0.75" font-size="7" font-family="monospace">DBH over 36"</text>
    <rect x="138" y="165" width="48" height="14" rx="2" fill="#231c09" stroke="#c9973a" stroke-opacity="0.3" stroke-width="0.8"/>
    <text x="144" y="175" fill="#f0e8d0" fill-opacity="0.8" font-size="7.5" font-family="monospace">$2,500</text>

    <!-- Total row -->
    <line x1="5" y1="185" x2="193" y2="185" stroke="#c9973a" stroke-opacity="0.25" stroke-width="1"/>
    <rect x="5" y="186" width="188" height="18" fill="#231c09"/>
    <text x="12" y="198" fill="#c9973a" font-size="7.5" font-family="monospace" font-weight="bold">Total Estimate</text>
    <text x="138" y="198" fill="#8fc67f" font-size="8" font-family="monospace" font-weight="bold">$18,450</text>
    <circle cx="138" cy="186" r="6" fill="#8fc67f"/>
    <text x="138" y="189" text-anchor="middle" fill="#100d04" font-size="6.5" font-weight="bold">3</text>

    <!-- Breakdown chart (right) -->
    <line x1="193" y1="56" x2="193" y2="204" stroke="#c9973a" stroke-opacity="0.15" stroke-width="1"/>
    <text x="203" y="67" fill="#c9973a" font-size="6" font-family="monospace" letter-spacing="1">BY TRUNK SIZE</text>

    <text x="203" y="83" fill="#f0e8d0" fill-opacity="0.6" font-size="6.5" font-family="monospace">Small</text>
    <rect x="203" y="85" width="38" height="8" rx="2" fill="#c9973a" fill-opacity="0.65"/>
    <text x="245" y="92" fill="#c9973a" font-size="6" font-family="monospace">$2,000</text>

    <text x="203" y="102" fill="#f0e8d0" fill-opacity="0.6" font-size="6.5" font-family="monospace">Medium</text>
    <rect x="203" y="104" width="72" height="8" rx="2" fill="#c9973a" fill-opacity="0.65"/>
    <text x="279" y="111" fill="#c9973a" font-size="6" font-family="monospace">$5,500</text>

    <text x="203" y="121" fill="#f0e8d0" fill-opacity="0.6" font-size="6.5" font-family="monospace">Large</text>
    <rect x="203" y="123" width="90" height="8" rx="2" fill="#c9973a" fill-opacity="0.65"/>
    <text x="297" y="130" fill="#c9973a" font-size="6" font-family="monospace">$7,200</text>

    <text x="203" y="140" fill="#f0e8d0" fill-opacity="0.6" font-size="6.5" font-family="monospace">Very Large</text>
    <rect x="203" y="142" width="36" height="8" rx="2" fill="#c9973a" fill-opacity="0.65"/>
    <text x="243" y="149" fill="#c9973a" font-size="6" font-family="monospace">$3,000</text>

    <text x="203" y="159" fill="#f0e8d0" fill-opacity="0.6" font-size="6.5" font-family="monospace">Exceptional</text>
    <rect x="203" y="161" width="22" height="8" rx="2" fill="#c9973a" fill-opacity="0.65"/>
    <text x="229" y="168" fill="#c9973a" font-size="6" font-family="monospace">$2,500</text>

    <!-- export buttons -->
    <line x1="5" y1="204" x2="375" y2="204" stroke="#c9973a" stroke-opacity="0.15" stroke-width="1"/>
    <rect x="12" y="208" width="66" height="10" rx="2" fill="#1b1507" stroke="#c9973a" stroke-opacity="0.5" stroke-width="1"/>
    <text x="45" y="216" text-anchor="middle" fill="#c9973a" font-size="6.5" font-family="monospace">Export CSV</text>
    <rect x="86" y="208" width="66" height="10" rx="2" fill="#1b1507" stroke="#c9973a" stroke-opacity="0.5" stroke-width="1"/>
    <text x="119" y="216" text-anchor="middle" fill="#c9973a" font-size="6.5" font-family="monospace">Export PDF</text>

    <!-- legend band -->
    <rect x="0" y="212" width="380" height="12" fill="#0d0a02"/>
    <line x1="0" y1="212" x2="380" y2="212" stroke="#c9973a" stroke-opacity="0.15" stroke-width="1"/>
    <circle cx="10" cy="219" r="4" fill="#c9973a"/>
    <text x="10" y="221.5" text-anchor="middle" fill="#0d0a02" font-size="5.5" font-weight="bold">1</text>
    <text x="17" y="221" fill="#c9973a" font-size="6.5" font-family="monospace">Rate per size class</text>
    <circle cx="110" cy="219" r="4" fill="#c9973a"/>
    <text x="110" y="221.5" text-anchor="middle" fill="#0d0a02" font-size="5.5" font-weight="bold">2</text>
    <text x="117" y="221" fill="#c9973a" font-size="6.5" font-family="monospace">Trunk size class</text>
    <circle cx="210" cy="219" r="4" fill="#8fc67f"/>
    <text x="210" y="221.5" text-anchor="middle" fill="#0d0a02" font-size="5.5" font-weight="bold">3</text>
    <text x="217" y="221" fill="#8fc67f" font-size="6.5" font-family="monospace">Total estimate</text>
    <circle cx="300" cy="219" r="4" fill="#c9973a"/>
    <text x="300" y="221.5" text-anchor="middle" fill="#0d0a02" font-size="5.5" font-weight="bold">4</text>
    <text x="307" y="221" fill="#c9973a" font-size="6.5" font-family="monospace">Filters</text>
  </svg>
</HelpDiagram>

<ol class="hd-steps">
  <li>Enter your contractor's cost per tree for each trunk size class ① ②. The five classes range from Small (under 6") to Exceptional (over 36").</li>
  <li>Use the filters ④ to limit the estimate — for example, only Poor and Dead trees on a specific street.</li>
  <li>The total ③ and bar chart update as you type or change filters.</li>
  <li>Click <strong>Export CSV</strong> or <strong>Export PDF</strong> to save the report for budget planning.</li>
</ol>

<script>
  import { currentPage } from '$lib/stores/ui.js';
  import { calcITreeUpdated, calcITreeLegacy } from '$lib/utils/itree.js';

  const SAMPLE_DBHS = [6, 10, 15, 20, 25, 35, 50];

  let useUpdated = $state(true);

  function makeSampleRows(fn) {
    return SAMPLE_DBHS.map(d => {
      const v = fn(d, 'Good');
      return { d, total: v[0], co2: v[1], air: v[2], storm: v[3], energy: v[4] };
    });
  }

  let sampleRows = $derived(makeRows(useUpdated));

  function makeRows(updated) {
    return makeSampleRows(updated ? calcITreeUpdated : calcITreeLegacy);
  }
</script>

<div class="about-overlay">
  <div class="about-wrap">

    <div style="display:flex;justify-content:flex-end">
      <button class="about-back" onclick={() => currentPage.set('map')}>← Back to Map</button>
    </div>

    <div>
      <div class="about-kicker">Waterville Urban Forestry</div>
      <h1 class="about-title">About This Inventory</h1>
      <p class="about-body" style="max-width:580px">The Waterville Tree Inventory documents the urban forest along public streets and rights-of-way. Field data was collected by Bartlett Consulting. This tool enables city staff to view, filter, and manage tree records, generate risk reports, and build street-level work orders.</p>
    </div>

    <div style="height:1px;background:rgba(120,80,20,.18)"></div>

    <!-- i-Tree section -->
    <div>
      <div class="about-kicker">Methodology</div>
      <h2 class="about-h2">i-Tree Estimated Value</h2>
      <p class="about-body" style="margin-bottom:20px">Each tree's annual ecosystem services value is estimated using the <a href="https://www.itreetools.org" target="_blank" rel="noopener" class="about-link">i-Tree methodology</a>, a research program developed by the USDA Forest Service. It calculates the dollar value of the environmental benefits a tree provides each year — clean air, carbon storage, stormwater management, and energy savings. Values are estimated from trunk diameter (DBH) and condition.</p>

      <div class="about-callout">
        <div class="about-callout-title">About These Estimates</div>
        <p class="about-body" style="margin-bottom:0">The coefficients used in this tool have been updated from the original i-Tree STRATUM (2006) national averages to better reflect current conditions. Carbon values reflect the EPA's 2023 Social Cost of Carbon estimate ($190/ton). Air quality values reflect updated EPA externality valuations for PM2.5 and ozone. Stormwater values reflect post-2006 infrastructure cost inflation. Energy values are adjusted for Maine's above-average electricity rates (~$0.22/kWh). Values remain DBH- and condition-based estimates without species differentiation.</p>
      </div>

      <div class="about-table">
        <div class="about-tbl-hdr" style="grid-template-columns:1fr 2fr">
          <div class="about-th">Service</div>
          <div class="about-th">What it measures</div>
        </div>
        <div class="about-tbl-row" style="grid-template-columns:1fr 2fr">
          <div class="about-td-bold">CO₂ Sequestration</div>
          <div class="about-td">Annual net carbon dioxide absorbed and stored in biomass as the tree grows. Valued at current carbon market rates.</div>
        </div>
        <div class="about-tbl-row" style="grid-template-columns:1fr 2fr">
          <div class="about-td-bold">Air Quality</div>
          <div class="about-td">Removal of particulate matter, ozone, sulfur dioxide, and nitrogen dioxide from the atmosphere through leaf surface interception.</div>
        </div>
        <div class="about-tbl-row" style="grid-template-columns:1fr 2fr">
          <div class="about-td-bold">Stormwater</div>
          <div class="about-td">Reduction in stormwater runoff volume by intercepting rainfall in the canopy, delaying and reducing peak flow into municipal systems.</div>
        </div>
        <div class="about-tbl-row" style="grid-template-columns:1fr 2fr">
          <div class="about-td-bold">Energy Savings</div>
          <div class="about-td">Reduction in building heating and cooling costs through shading in summer and windbreak effects in winter for nearby structures.</div>
        </div>
        <div class="about-tbl-row last" style="grid-template-columns:1fr 2fr">
          <div class="about-td-bold" style="color:#2a7d24;font-weight:600">Total Annual Value</div>
          <div class="about-td">Sum of all four services, expressed in dollars per year.</div>
        </div>
      </div>

      <p class="about-body" style="margin-bottom:20px">Values scale with DBH — a larger trunk generally indicates greater canopy area and biomass, which drives higher estimates across all four services. Condition also matters: trees rated Good provide the full estimated value, Fair trees provide roughly 75%, and Poor trees roughly 40%. Dead trees are assigned no value. The table below shows representative annual values for a selection of DBH sizes under Good condition.</p>

      <div class="about-toggle-row">
        <span class="about-toggle-label">Valuation basis</span>
        <div class="about-pill-toggle">
          <button
            class="about-pill-btn"
            class:active={useUpdated}
            onclick={() => useUpdated = true}
          >Updated (Maine / 2023)</button>
          <button
            class="about-pill-btn"
            class:active={!useUpdated}
            onclick={() => useUpdated = false}
          >Original (National / 2006)</button>
        </div>
      </div>

      <div class="about-table">
        <div class="about-tbl-hdr" style="grid-template-columns:80px repeat(5,1fr)">
          <div class="about-th" style="text-align:right">DBH (in)</div>
          <div class="about-th" style="text-align:right">Total / yr</div>
          <div class="about-th" style="text-align:right">CO₂</div>
          <div class="about-th" style="text-align:right">Air Quality</div>
          <div class="about-th" style="text-align:right">Stormwater</div>
          <div class="about-th" style="text-align:right">Energy</div>
        </div>
        {#each sampleRows as row, i}
          <div class="about-tbl-row" class:last={i === sampleRows.length - 1} style="grid-template-columns:80px repeat(5,1fr)">
            <div style="padding:7px 10px;font-size:.76rem;color:#1c1c1e;text-align:right;font-family:'DM Mono',monospace">{row.d}"</div>
            <div style="padding:7px 10px;font-size:.76rem;color:#2a7d24;text-align:right;font-weight:600">${row.total}</div>
            <div style="padding:7px 10px;font-size:.76rem;color:#3a3a3a;text-align:right">${row.co2}</div>
            <div style="padding:7px 10px;font-size:.76rem;color:#3a3a3a;text-align:right">${row.air}</div>
            <div style="padding:7px 10px;font-size:.76rem;color:#3a3a3a;text-align:right">${row.storm}</div>
            <div style="padding:7px 10px;font-size:.76rem;color:#3a3a3a;text-align:right">${row.energy}</div>
          </div>
        {/each}
      </div>
      <p class="about-body" style="font-style:italic;margin-top:8px;margin-bottom:4px">Toggle above to compare 2006 national average estimates vs. updated Maine-specific valuations.</p>
      <p class="about-body" style="font-style:italic;margin-top:4px">Values are approximations based on the i-Tree methodology and should be treated as estimates. They do not reflect species-specific canopy characteristics or site-specific conditions such as proximity to buildings or pavement coverage.</p>
    </div>

    <div style="height:1px;background:rgba(120,80,20,.18)"></div>

    <div>
      <div class="about-kicker">Methodology</div>
      <h2 class="about-h2">Priority Score</h2>
      <p class="about-body" style="margin-bottom:20px">The Tree Health &amp; Priority Report assigns each living tree a <strong class="about-em">Priority Score</strong> from 0 to 100. A lower score means the tree requires more urgent attention. Scores are calculated from the condition rating and structural observations recorded in the field — the data most reliably available across the full inventory.</p>

      <div class="about-callout">
        <div class="about-callout-title">Important Note on Scope</div>
        <p class="about-body" style="margin-bottom:0">The Priority Score is a planning and triage tool for the Waterville tree board. It is not a formal arborist risk assessment and does not substitute for field evaluation by a qualified arborist. For trees scoring in the Critical range, an on-site inspection is recommended before scheduling removal or major work. Trunk diameter (DBH) is intentionally excluded from the score — it is displayed alongside the score so the board can make their own judgment about consequence of failure.</p>
      </div>

      <div class="about-obs-title" style="margin-top:4px">Score Ranges</div>
      <div class="about-risk-bands">
        <div class="about-band" style="border-color:rgba(208,68,68,.4);background:rgba(208,68,68,.06)">
          <div class="about-band-lbl" style="color:#d04444">Critical</div>
          <div class="about-band-range" style="color:#d04444">0 – 40</div>
          <div class="about-band-desc">Significant structural defects, severe decline, or combination of factors indicating urgent need for inspection and action.</div>
        </div>
        <div class="about-band" style="border-color:rgba(208,104,40,.4);background:rgba(208,104,40,.06)">
          <div class="about-band-lbl" style="color:#d06828">High</div>
          <div class="about-band-range" style="color:#d06828">41 – 65</div>
          <div class="about-band-desc">Notable condition issues or multiple moderate observations. Schedule for assessment within the current or upcoming season.</div>
        </div>
        <div class="about-band" style="border-color:rgba(212,174,48,.45);background:rgba(212,174,48,.06)">
          <div class="about-band-lbl" style="color:#8a6010">Moderate</div>
          <div class="about-band-range" style="color:#8a6010">66 – 82</div>
          <div class="about-band-desc">Fair condition or minor observations present. Monitor and include in routine care planning.</div>
        </div>
        <div class="about-band" style="border-color:rgba(94,194,84,.4);background:rgba(94,194,84,.06)">
          <div class="about-band-lbl" style="color:#1a7a14">Low</div>
          <div class="about-band-range" style="color:#1a7a14">83 – 100</div>
          <div class="about-band-desc">Good condition with no significant observations recorded. No near-term action required.</div>
        </div>
      </div>

      <div class="about-obs-title">How the Score Is Calculated</div>
      <p class="about-body" style="margin-bottom:14px">Each tree starts at a score of 100. Points are deducted based on the following factors. The final score is floored at 10 for living trees — a score of 0 is reserved to indicate a dead tree in contexts where scores appear.</p>

      <div class="about-table">
        <div class="about-tbl-hdr" style="grid-template-columns:2fr 3fr 80px">
          <div class="about-th">Factor</div>
          <div class="about-th">Description</div>
          <div class="about-th" style="text-align:right">Deduction</div>
        </div>
        <div class="about-tbl-row" style="grid-template-columns:2fr 3fr 80px">
          <div class="about-td-bold">Condition: Poor</div>
          <div class="about-td">Tree is in poor health — significant decline, dieback, or damage observed in the field.</div>
          <div class="about-td" style="text-align:right;font-family:'DM Mono',monospace;color:#d06828">−40 pts</div>
        </div>
        <div class="about-tbl-row" style="grid-template-columns:2fr 3fr 80px">
          <div class="about-td-bold">Condition: Fair</div>
          <div class="about-td">Tree shows some decline or minor damage but retains meaningful canopy and function.</div>
          <div class="about-td" style="text-align:right;font-family:'DM Mono',monospace;color:#d4ae30">−18 pts</div>
        </div>
        <div class="about-tbl-row" style="grid-template-columns:2fr 3fr 80px">
          <div class="about-td-bold">High-risk observation</div>
          <div class="about-td">Each structural defect with direct failure implications. Up to three can contribute to the score.</div>
          <div class="about-td" style="text-align:right;font-family:'DM Mono',monospace;color:#d06828">−12 pts each</div>
        </div>
        <div class="about-tbl-row" style="grid-template-columns:2fr 3fr 80px">
          <div class="about-td-bold">Moderate-risk observation</div>
          <div class="about-td">Each observation indicating elevated concern. Combined observation deductions are capped at 36 points total.</div>
          <div class="about-td" style="text-align:right;font-family:'DM Mono',monospace;color:#d4ae30">−6 pts each</div>
        </div>
        <div class="about-tbl-row" style="grid-template-columns:2fr 3fr 80px">
          <div class="about-td-bold">EAB risk</div>
          <div class="about-td">Ash species (genus Fraxinus) face near-certain mortality without treatment due to Emerald Ash Borer.</div>
          <div class="about-td" style="text-align:right;font-family:'DM Mono',monospace;color:#d4ae30">−12 pts</div>
        </div>
        <div class="about-tbl-row last" style="grid-template-columns:2fr 3fr 80px">
          <div class="about-td-bold">Over-mature age class</div>
          <div class="about-td">Trees classified as over-mature carry modestly elevated structural risk as they approach the end of their natural lifespan.</div>
          <div class="about-td" style="text-align:right;font-family:'DM Mono',monospace;color:#5c3d08">−6 pts</div>
        </div>
      </div>

      <div class="about-obs-title">High-Risk Observations <span style="font-size:.68rem;color:#3a3a3a;text-transform:none;letter-spacing:0;font-weight:400">(−12 pts each)</span></div>
      <div class="about-obs-list" style="margin-bottom:20px">
        {#each [
          'Cavity-stem','Crack-stem','Dead/dying stem','Dieback (severe)',
          'Hanger','Included bark','Seam','Co-dominant stems',
          'Co-dominant stems (2)','Co-dominant stems (4)','Co-dominant stems (11)',
          'Fungi/conks','Rib','Sweep','Overextended branch','Poor branch structure'
        ] as obs}
          <span class="about-obs-tag high">{obs}</span>
        {/each}
      </div>

      <div class="about-obs-title">Moderate-Risk Observations <span style="font-size:.68rem;color:#3a3a3a;text-transform:none;letter-spacing:0;font-weight:400">(−6 pts each)</span></div>
      <div class="about-obs-list" style="margin-bottom:20px">
        {#each [
          'Cavity-branch','Cavity-suspected','Crack-branch','Dead branches >2',
          'Dieback (moderate)','Girdling roots present (severe)',
          'Girdling roots present (moderate)','Lion tailing','Low live crown ratio',
          'Low vigor','Wound-stem','Wound-root flare','Broken branch(s)',
          'Topping/heading cuts','Sidewalk lifting-major'
        ] as obs}
          <span class="about-obs-tag mod">{obs}</span>
        {/each}
      </div>

      <div class="about-callout">
        <div class="about-callout-title">Dead Trees</div>
        <p class="about-body" style="margin-bottom:0">Dead trees are excluded from Priority Score calculations entirely. A dead tree requires one action — removal scheduling — and scoring it creates a false equivalence with living trees where the score helps differentiate care priorities. In the Tree Health &amp; Priority Report, dead trees appear in their own section, sorted by trunk diameter (largest first) so the board can prioritize by potential consequence of failure.</p>
      </div>
    </div>

    <!-- Footer -->
    <div style="padding-top:8px;border-top:1px solid rgba(120,80,20,.18)">
      <p class="about-body">Field data collected by <a href="https://www.bartlett.com" target="_blank" rel="noopener" class="about-link">Bartlett Tree Experts</a>. i-Tree methodology by the USDA Forest Service and Davey Tree Expert Company. Inventory managed by the City of Waterville.</p>
    </div>

  </div>
</div>

<style>
  .about-overlay{flex:1;min-height:0;background:#fdf8f0;overflow-y:auto;text-align:left}
  .about-wrap{width:100%;max-width:760px;margin:0 auto;padding:48px 28px 60px;display:flex;flex-direction:column;gap:48px}
  .about-back{background:transparent;border:1px solid rgba(120,80,20,.25);border-radius:4px;padding:5px 13px;font-family:'DM Mono',monospace;font-size:.74rem;color:#5c3d08;cursor:pointer;transition:all .13s}
  .about-back:hover{background:rgba(92,61,8,.1);border-color:#5c3d08}
  .about-kicker{font-size:.64rem;letter-spacing:.14em;text-transform:uppercase;color:#c9973a;margin-bottom:6px}
  .about-title{font-family:'Playfair Display',serif;font-size:2.2rem;color:#0f2e14;margin-bottom:10px}
  .about-h2{font-family:'Playfair Display',serif;font-size:1.7rem;color:#2a7d24;margin-bottom:14px}
  .about-body{font-size:.85rem;color:#3a3a3a;line-height:1.85}
  .about-em{color:#1c1c1e}
  .about-link{color:#c9973a;text-decoration:underline dotted;text-underline-offset:2px}
  .about-pts{color:#1c1c1e}

  .about-table{border:1px solid rgba(120,80,20,.18);border-radius:7px;overflow:hidden;margin-bottom:20px}
  .about-tbl-hdr{display:grid;background:#231c09;border-bottom:1px solid rgba(120,80,20,.18)}
  .about-th{padding:7px 14px;font-size:.62rem;letter-spacing:.1em;text-transform:uppercase;color:#c9973a}
  .about-tbl-row{display:grid;border-bottom:1px solid rgba(201,151,58,.08)}
  .about-tbl-row.last{border-bottom:none}
  .about-td-bold{padding:9px 14px;font-size:.78rem;color:#1c1c1e;font-weight:500}
  .about-td{padding:9px 14px;font-size:.76rem;color:#3a3a3a;line-height:1.65}

  .about-risk-bands{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:20px}
  .about-band{border:1px solid;border-radius:6px;padding:11px 12px}
  .about-band-lbl{font-size:.72rem;font-weight:700;letter-spacing:.05em;margin-bottom:3px}
  .about-band-range{font-family:'Playfair Display',serif;font-size:1.3rem;margin-bottom:4px}
  .about-band-desc{font-size:.72rem;color:#3a3a3a;line-height:1.6}

  .about-obs-title{font-size:.62rem;letter-spacing:.1em;text-transform:uppercase;color:#c9973a;margin-bottom:8px}
  .about-obs-list{display:flex;flex-wrap:wrap;gap:4px}
  .about-obs-tag{border-radius:3px;padding:2px 7px;font-size:.68rem}
  .about-obs-tag.high{background:rgba(160,30,30,.1);border:1px solid rgba(160,30,30,.45);color:#8a1a1a}
  .about-obs-tag.mod{background:rgba(130,90,10,.1);border:1px solid rgba(130,90,10,.4);color:#5c3d08}

  .about-callout{border:1px solid rgba(201,151,58,.35);background:rgba(201,151,58,.06);border-radius:7px;padding:16px 18px;margin-bottom:20px}
  .about-callout-title{font-size:.64rem;letter-spacing:.12em;text-transform:uppercase;color:#c9973a;margin-bottom:8px;font-weight:600}

  .about-toggle-row{display:flex;align-items:center;gap:12px;margin-bottom:12px}
  .about-toggle-label{font-size:.64rem;letter-spacing:.1em;text-transform:uppercase;color:#c9973a;white-space:nowrap}
  .about-pill-toggle{display:flex;border:1px solid rgba(120,80,20,.3);border-radius:20px;overflow:hidden;background:#f5f0e8}
  .about-pill-btn{padding:5px 14px;font-family:'DM Mono',monospace;font-size:.72rem;border:none;background:transparent;color:#5c3d08;cursor:pointer;transition:background .15s,color .15s}
  .about-pill-btn.active{background:#231c09;color:#c9973a}
  .about-pill-btn:not(.active):hover{background:rgba(120,80,20,.1)}

  @media(max-width:600px){.about-risk-bands{grid-template-columns:1fr 1fr}}
</style>

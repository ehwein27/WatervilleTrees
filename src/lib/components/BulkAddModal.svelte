<script>
  import { onMount } from 'svelte';
  import { trees, addTrees } from '$lib/stores/trees.js';
  import { sbGet, sbSet, insertTrees, updateTree as sbUpdateTree } from '$lib/api/supabase.js';
  import { currentUser } from '$lib/stores/auth.js';
  import { currentPage, mapInstance, bulkAddPrefill, speciesMap, streetsList, baPlacementData } from '$lib/stores/ui.js';
  import { showToast } from '$lib/stores/toast.js';
  import { get } from 'svelte/store';

  const BA_UPLOADS_KEY = 'bulk_add_uploads';
  const VALID_COND = new Set(['Good','Fair','Poor','Dead']);
  const VALID_AGE  = new Set(['Young','Semi-mature','Mature','Over-mature']);
  const GEO_THRESH = 0.00005;

  let step             = $state('upload');
  let rows             = $state([]);
  let geoResults       = $state([]);
  let geoProgress      = $state(0);
  let geoTotal         = $state(0);
  let error            = $state('');
  let dragOver         = $state(false);
  let savedUploads     = $state([]);
  let pendingFileBytes = $state(null);
  let pendingFileName  = $state('');
  let adding           = $state(false);
  let geocodeCancelled = $state(false);
  let manualInvId      = $state('');

  let toAdd = $derived(geoResults.filter(r =>
    r.lat !== null && !r.flagged && (r.dupMatch == null || r.dupAction === 'add')
  ));
  let toReplace = $derived(geoResults.filter(r =>
    r.dupMatch != null && r.dupAction === 'replace'
  ));
  let unresolvedDups = $derived(geoResults.filter(r =>
    r.lat !== null && !r.flagged && r.dupMatch != null && r.dupAction === null
  ));
  let flaggedResults = $derived(geoResults.filter(r => r.flagged));

  const DUP_PAGE_SIZE = 30;
  let dupPage = $state(0);
  let allDupItems = $derived(
    geoResults.reduce((acc, res, i) => {
      if (res.lat !== null && !res.flagged && res.dupMatch != null) acc.push({ res, i });
      return acc;
    }, [])
  );
  let dupTotalPages = $derived(Math.ceil(allDupItems.length / DUP_PAGE_SIZE) || 1);
  let dupPageItems  = $derived(allDupItems.slice(dupPage * DUP_PAGE_SIZE, (dupPage + 1) * DUP_PAGE_SIZE));

  onMount(async () => {
    // Returning from placement step — restore state and run dup detection
    const placement = get(baPlacementData);
    if (placement?.done) {
      pendingFileName  = placement.pendingFileName;
      pendingFileBytes = placement.pendingFileBytes;
      const allTrees = get(trees);
      geoResults = placement.geoResults.map(r => {
        if (r.lat === null) return { ...r, dupMatch: null, dupAction: null };
        const dupMatch = findDuplicate(r.lat, r.lng, r.row.n, allTrees);
        return { ...r, dupMatch: dupMatch ?? null, dupAction: null };
      });
      baPlacementData.set(null);
      step = 'review';
    }

    await loadSavedUploads();

    const prefill = get(bulkAddPrefill);
    if (prefill) {
      bulkAddPrefill.set(null);
      await handleFileFromBytes(prefill.bytes, prefill.name);
    }
  });

  function resetToEntry() {
    step = 'upload'; geoResults = []; rows = []; error = ''; dupPage = 0;
    pendingFileBytes = null; pendingFileName = ''; manualInvId = '';
  }

  // ── Saved uploads ─────────────────────────────────────────────────────────────

  async function loadSavedUploads() {
    try {
      const val = await sbGet(BA_UPLOADS_KEY);
      savedUploads = Array.isArray(val) ? val : JSON.parse(val);
    } catch { savedUploads = []; }
  }

  async function saveSavedUpload(fileName, fileBytes, treeCount, treeIds) {
    const b64 = await bufToB64(fileBytes);
    const uploads = [{
      id: 'bau_' + Date.now(), name: fileName, treeCount,
      date: new Date().toISOString(), b64,
      treeIds: treeIds ?? [],
    }, ...savedUploads];
    const trimmed = uploads.slice(0, 20);
    await sbSet(BA_UPLOADS_KEY, trimmed);
    savedUploads = trimmed;
  }

  function bufToB64(buf) {
    return new Promise(resolve => {
      const blob = new Blob([buf]);
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result.split(',')[1]);
      fr.readAsDataURL(blob);
    });
  }

  function downloadUpload(u) {
    const bin = atob(u.b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const mime = u.name.endsWith('.csv') ? 'text/csv'
      : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    const blob = new Blob([bytes], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = u.name;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  }

  async function downloadTemplate() {
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Waterville Trees';

    const ws = wb.addWorksheet('Trees');
    ws.columns = [
      { key: 'a', width: 14 }, { key: 'b', width: 26 }, { key: 'c', width: 24 },
      { key: 'd', width: 26 }, { key: 'e', width: 13 }, { key: 'f', width: 16 }, { key: 'g', width: 13 },
    ];

    const hRow = ws.addRow(['Street Number', 'Street Name', 'Common Name', 'Scientific Name', 'Condition', 'Age Class', 'DBH (inches)']);
    hRow.height = 26;
    hRow.eachCell(cell => {
      cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A5216' } };
      cell.font      = { bold: true, color: { argb: 'FFFFFFFF' }, name: 'Calibri', size: 11 };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border    = { bottom: { style: 'medium', color: { argb: 'FFC9973A' } } };
    });

    const exRow = ws.addRow(['123', 'Main St', 'American Elm', '← auto-fills from name', 'Good', 'Mature', '12.0']);
    exRow.height = 18;
    exRow.eachCell((cell, col) => {
      cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F7EE' } };
      cell.font      = { italic: true, color: { argb: 'FF777777' }, name: 'Calibri', size: 10 };
      cell.alignment = { vertical: 'middle', horizontal: col === 1 ? 'right' : 'left' };
      cell.border    = { bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } } };
    });

    for (let r = 3; r <= 202; r++) {
      const row = ws.getRow(r);
      row.height = 18;
      for (let c = 1; c <= 7; c++) {
        const cell = row.getCell(c);
        cell.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: r % 2 === 0 ? 'FFFFFFFF' : 'FFFAFDF9' } };
        cell.font   = { name: 'Calibri', size: 10 };
        cell.border = { bottom: { style: 'hair', color: { argb: 'FFDDDDDD' } }, right: { style: 'hair', color: { argb: 'FFDDDDDD' } } };
      }
      row.getCell(4).value = { formula: `IF(C${r}="","",IFERROR(VLOOKUP(C${r},Lists!$A:$B,2,FALSE),""))`, result: '' };
    }

    ws.views = [{ state: 'frozen', ySplit: 1, xSplit: 0, activeCell: 'A3' }];

    const listsWs = wb.addWorksheet('Lists');
    listsWs.state = 'veryHidden';

    const smap = get(speciesMap);
    const speciesData = Object.entries(smap.commonToSci || {}).sort((a, b) => a[0].localeCompare(b[0]));
    const streets = [...get(streetsList)];

    listsWs.getCell('A1').value = 'Common Name';
    listsWs.getCell('B1').value = 'Scientific Name';
    listsWs.getCell('C1').value = 'Street Name';
    speciesData.forEach(([cn, sn], i) => {
      listsWs.getCell(`A${i + 2}`).value = cn;
      listsWs.getCell(`B${i + 2}`).value = sn;
    });
    streets.forEach((st, i) => { listsWs.getCell(`C${i + 2}`).value = st; });

    if (streets.length > 0) {
      ws.dataValidations.add('B3:B202', {
        type: 'list', allowBlank: true, showDropDown: false,
        formulae: [`Lists!$C$2:$C$${streets.length + 1}`],
        promptTitle: 'Street Name', prompt: 'Select an existing street or type a new one',
      });
    }
    if (speciesData.length > 0) {
      ws.dataValidations.add('C3:C202', {
        type: 'list', allowBlank: true, showDropDown: false,
        formulae: [`Lists!$A$2:$A$${speciesData.length + 1}`],
        promptTitle: 'Common Name', prompt: 'Select a species or type a new one',
      });
    }
    ws.dataValidations.add('E3:E202', {
      type: 'list', allowBlank: true, showDropDown: false,
      formulae: ['"Good,Fair,Poor,Dead"'],
      showErrorMessage: true, errorTitle: 'Invalid Condition', error: 'Please select: Good, Fair, Poor, or Dead',
    });
    ws.dataValidations.add('F3:F202', {
      type: 'list', allowBlank: true, showDropDown: false,
      formulae: ['"Young,Semi-mature,Mature,Over-mature"'],
      showErrorMessage: true, errorTitle: 'Invalid Age Class', error: 'Please select: Young, Semi-mature, Mature, or Over-mature',
    });
    ws.addConditionalFormatting({
      ref: 'E3:E202',
      rules: [
        { type: 'expression', priority: 1, formulae: ['$E3="Good"'], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFC6EFCE' } }, font: { color: { argb: 'FF276221' }, name: 'Calibri', size: 10 } } },
        { type: 'expression', priority: 2, formulae: ['$E3="Fair"'], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFFEB9C' } }, font: { color: { argb: 'FF9C6500' }, name: 'Calibri', size: 10 } } },
        { type: 'expression', priority: 3, formulae: ['$E3="Poor"'], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFFCC99' } }, font: { color: { argb: 'FF9C3301' }, name: 'Calibri', size: 10 } } },
        { type: 'expression', priority: 4, formulae: ['$E3="Dead"'], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFFC7CE' } }, font: { color: { argb: 'FF9C0006' }, name: 'Calibri', size: 10 } } },
      ],
    });

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'WatervilleTreeInventory_BulkAdd_Template.xlsx';
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  }

  // ── File handling ─────────────────────────────────────────────────────────────

  async function handleFileFromBytes(bytes, name) {
    error = '';
    pendingFileBytes = bytes.buffer ?? bytes;
    pendingFileName  = name;
    const XLSX = await import('xlsx');
    const wb   = XLSX.read(bytes, { type: 'array' });
    const ws   = wb.Sheets[wb.SheetNames[0]];
    const raw  = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    const parsedRows = baParseRows(raw);
    if (!parsedRows.length) { error = 'No valid data rows found in the converted file.'; return; }
    rows = parsedRows;
    if (parsedRows.every(r => r.invId === null)) { manualInvId = ''; step = 'inv-id'; return; }
    await baStartGeocode(parsedRows);
  }

  function handleDrop(e) {
    e.preventDefault(); dragOver = false;
    const file = e.dataTransfer?.files[0];
    if (file) handleFile(file);
  }

  function handleFileInput(e) {
    const file = e.target.files?.[0];
    if (file) { handleFile(file); e.target.value = ''; }
  }

  async function handleFile(file) {
    error = '';
    const name = file.name.toLowerCase();
    const isXlsx = name.endsWith('.xlsx') || name.endsWith('.xls');
    const isCsv  = name.endsWith('.csv');
    if (!isXlsx && !isCsv) { error = 'Unsupported file type. Please upload a .xlsx or .csv file.'; return; }
    const buf = await file.arrayBuffer();
    pendingFileBytes = buf; pendingFileName = file.name;
    let parsedRows;
    if (isXlsx) {
      const XLSX = await import('xlsx');
      const wb = XLSX.read(new Uint8Array(buf), { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      parsedRows = baParseRows(raw);
    } else {
      const text = new TextDecoder().decode(buf);
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
      parsedRows = baParseRows(lines.map(l => parseCSVLine(l)));
    }
    if (!parsedRows.length) { error = 'No valid data rows found. Check that your file has an "Address" or "Street" column.'; return; }
    rows = parsedRows;
    if (parsedRows.every(r => r.invId === null)) { manualInvId = ''; step = 'inv-id'; return; }
    await baStartGeocode(parsedRows);
  }

  function baParseRows(raw) {
    if (!raw.length) return [];
    let headerIdx = -1;
    for (let i = 0; i < Math.min(raw.length, 6); i++) {
      const joined = raw[i].join(' ').toLowerCase();
      if (joined.includes('address') || joined.includes('street') ||
          joined.includes('common name') || joined.includes('species')) {
        headerIdx = i; break;
      }
    }
    if (headerIdx === -1) return [];
    const headers = raw[headerIdx].map(h => String(h).toLowerCase().trim());
    const addrCol      = headers.findIndex(h => h.includes('address'));
    const streetNumCol = headers.findIndex(h =>
      h.includes('street number') || h.includes('house number') || h === 'number' || h === '#' || h === 'street #'
    );
    const streetNameCol = headers.findIndex(h =>
      (h === 'street name' || h === 'street') && !h.includes('number')
    );
    const nameCol    = headers.findIndex(h => h.includes('common'));
    const sciCol     = headers.findIndex(h => h.includes('scientific'));
    const condCol    = headers.findIndex(h => h.includes('condition'));
    const ageCol     = headers.findIndex(h => h.includes('age'));
    const dbhCol     = headers.findIndex(h => h.includes('dbh'));
    const invIdCol   = headers.findIndex(h => h === 'inventory id' || h === 'inventory_id');
    const treeIdCol  = headers.findIndex(h => h === 'tree id' || h === 'tree_id');
    const hasSplitAddr = streetNumCol !== -1 || streetNameCol !== -1;
    if (addrCol === -1 && !hasSplitAddr) return [];
    const result = [];
    let rowPos = 0;
    for (let i = headerIdx + 1; i < raw.length; i++) {
      const r = raw[i];
      let addr;
      if (hasSplitAddr) {
        const num   = streetNumCol  >= 0 ? String(r[streetNumCol]  || '').trim() : '';
        const sname = streetNameCol >= 0 ? String(r[streetNameCol] || '').trim() : '';
        addr = [num, sname].filter(Boolean).join(' ');
      } else {
        addr = String(r[addrCol] || '').trim();
      }
      if (!addr || addr.toLowerCase().includes('e.g.') || addr.toLowerCase().includes('example')) continue;
      rowPos++;
      const rawInvId  = invIdCol  >= 0 ? String(r[invIdCol]  || '').trim() : '';
      const rawTreeId = treeIdCol >= 0 ? String(r[treeIdCol] || '').trim() : '';
      result.push({
        addr,
        n: nameCol >= 0 ? String(r[nameCol] || '').trim() : '',
        s: sciCol  >= 0 ? String(r[sciCol]  || '').trim() : '',
        c: condCol >= 0 ? String(r[condCol] || '').trim() : '',
        a: ageCol  >= 0 ? String(r[ageCol]  || '').trim() : '',
        d: dbhCol  >= 0 ? (parseFloat(r[dbhCol]) || null) : null,
        invId:  rawInvId  || null,
        treeId: rawTreeId || String(rowPos),
        rowPos,
      });
    }
    return result;
  }

  function parseCSVLine(line) {
    const result = []; let current = ''; let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQuotes = !inQuotes; }
      else if (ch === ',' && !inQuotes) { result.push(current); current = ''; }
      else { current += ch; }
    }
    result.push(current);
    return result;
  }

  // ── Duplicate detection ───────────────────────────────────────────────────────

  function findDuplicate(lat, lng, name, currentTrees = get(trees)) {
    const candidates = currentTrees.filter(t =>
      t.lt != null && t.ln != null &&
      Math.abs(lat - t.lt) <= GEO_THRESH && Math.abs(lng - t.ln) <= GEO_THRESH
    );
    if (!candidates.length) return null;
    const scored = candidates
      .map(t => ({ tree: t, score: (name && t.n && name.toLowerCase() === t.n.toLowerCase()) ? 3 : 0 }))
      .filter(x => x.score >= 3);
    if (!scored.length) return null;
    const cosLat = Math.cos(lat * Math.PI / 180);
    scored.sort((a, b) => {
      const da = (lat - a.tree.lt) ** 2 + ((lng - a.tree.ln) * cosLat) ** 2;
      const db = (lat - b.tree.lt) ** 2 + ((lng - b.tree.ln) * cosLat) ** 2;
      return da - db;
    });
    return scored[0].tree;
  }

  // ── Inventory ID prompt handlers ──────────────────────────────────────────────

  async function confirmInvId() {
    const id = manualInvId.trim();
    const finalRows = id ? rows.map(r => ({ ...r, invId: id })) : rows;
    rows = finalRows;
    await baStartGeocode(finalRows);
  }

  // ── Geocoding ─────────────────────────────────────────────────────────────────

  async function baStartGeocode(parsedRows) {
    step = 'geocoding'; geoTotal = parsedRows.length; geoProgress = 0; geoResults = []; error = ''; dupPage = 0;
    geocodeCancelled = false;

    // Build street → [tree] lookup from existing inventory to skip Nominatim for known streets
    const currentTrees = get(trees);
    const streetIdx = {};
    for (const t of currentTrees) {
      if (!t.st) continue;
      const key = t.st.trim().toLowerCase();
      if (!streetIdx[key]) streetIdx[key] = [];
      streetIdx[key].push(t);
    }

    let lastNominatimAt = 0;
    const batch = [];

    for (let i = 0; i < parsedRows.length; i++) {
      if (geocodeCancelled) break;
      geoProgress = i;

      const row = parsedRows[i];
      // Strip leading house number to get bare street name for lookup
      const streetKey = row.addr.replace(/^\d+\s*/, '').trim().toLowerCase();
      const invTrees = streetIdx[streetKey];

      let result;
      if (invTrees?.length) {
        // Known street — use median lat/lng from inventory, no Nominatim call needed
        const lats = invTrees.map(t => t.lt).filter(n => n != null).sort((a, b) => a - b);
        const lngs = invTrees.map(t => t.ln).filter(n => n != null).sort((a, b) => a - b);
        const mid = Math.floor(lats.length / 2);
        result = { lat: lats[mid], lng: lngs[mid], displayName: null, flagged: false, suggestion: null };
      } else {
        // Unknown street — call Nominatim, respecting 1 req/sec rate limit
        const elapsed = Date.now() - lastNominatimAt;
        if (elapsed < 1100) await new Promise(r => setTimeout(r, 1100 - elapsed));
        if (geocodeCancelled) break;
        result = await baGeocode(row.addr);
        lastNominatimAt = Date.now();
      }

      batch.push({ row, ...result, dupMatch: null, dupAction: null });
      if (batch.length >= 5 || i === parsedRows.length - 1) {
        geoResults = [...geoResults, ...batch.splice(0)];
      }
    }

    if (geocodeCancelled) { step = 'upload'; return; }
    geoProgress = parsedRows.length;

    baPlacementData.set({ geoResults: [...geoResults], idx: 0, done: false, pendingFileName, pendingFileBytes });
    currentPage.set('map');
  }

  async function baGeocode(addr) {
    const query = encodeURIComponent(addr + ', Waterville, ME');
    const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=2&addressdetails=1&countrycodes=us`;
    try {
      const r = await fetch(url, { headers: { 'Accept': 'application/json', 'Accept-Language': 'en' } });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const data = await r.json();
      if (!data.length) {
        const loose = addr.replace(/,.*/, '').trim();
        const url2 = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(loose + ' Waterville Maine')}&format=json&limit=1&countrycodes=us`;
        await new Promise(res => setTimeout(res, 600));
        const r2 = await fetch(url2, { headers: { 'Accept': 'application/json', 'Accept-Language': 'en' } });
        const data2 = await r2.json();
        if (!data2.length) return { lat: null, lng: null, displayName: null, flagged: true, suggestion: null };
        const hit = data2[0];
        return { lat: parseFloat(hit.lat), lng: parseFloat(hit.lon), displayName: hit.display_name, flagged: true, suggestion: baExtractStreet(hit) };
      }
      const hit = data[0];
      const street = baExtractStreet(hit);
      const inputStreet = addr.replace(/^\d+\s*/, '').toLowerCase().replace(/\s+/g, ' ').trim();
      const foundStreet = (street || '').toLowerCase().replace(/\s+/g, ' ').trim();
      const flagged = !!(foundStreet && !foundStreet.includes(inputStreet.split(' ')[0]) &&
                      !inputStreet.includes(foundStreet.split(' ')[0]));
      return { lat: parseFloat(hit.lat), lng: parseFloat(hit.lon), displayName: hit.display_name, flagged, suggestion: flagged ? street : null };
    } catch {
      return { lat: null, lng: null, displayName: null, flagged: true, suggestion: null };
    }
  }

  function baExtractStreet(hit) {
    const a = hit.address || {};
    return [[a.house_number, a.road || a.pedestrian || a.path].filter(Boolean).join(' ')][0] || null;
  }

  // ── Duplicate resolution ──────────────────────────────────────────────────────

  function resolveDup(idx, action) {
    geoResults = geoResults.map((r, i) => i === idx ? { ...r, dupAction: action } : r);
  }
  function resolveAllDups(action) {
    geoResults = geoResults.map(r =>
      (r.dupMatch != null && r.dupAction === null) ? { ...r, dupAction: action } : r
    );
  }

  // ── Submit ────────────────────────────────────────────────────────────────────

  function getTodayMmddyy() {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const yy = String(d.getFullYear()).slice(-2);
    return `${mm}${dd}${yy}`;
  }

  function buildDisplayId(row, spreadsheetN) {
    if (row.invId) {
      return `${row.invId}-${row.treeId}`;
    }
    return `${getTodayMmddyy()}-${spreadsheetN}-${row.rowPos}`;
  }

  async function baAddTrees() {
    if (!$currentUser || (!toAdd.length && !toReplace.length)) return;
    adding = true; error = '';
    try {
      const today = new Date().toISOString().slice(0, 10);
      const todayISO = new Date().toISOString().slice(0, 10);
      const uploadsToday = savedUploads.filter(u => (u.date || '').startsWith(todayISO));
      const spreadsheetN = uploadsToday.length + 1;
      let insertedCount = 0, replacedCount = 0;
      const insertedIds = [];

      if (toAdd.length) {
        const maxId = Math.max(0, ...get(trees).map(t => parseInt(t.id) || 0));
        let nextId = maxId + 1;
        const sbRows = toAdd.map(res => {
          const displayId = buildDisplayId(res.row, spreadsheetN);
          return {
            tree_id: nextId++, common_name: res.row.n || null, scientific_name: res.row.s || null,
            condition: VALID_COND.has(res.row.c) ? res.row.c : null,
            age_class: VALID_AGE.has(res.row.a) ? res.row.a : null,
            dbh1_in: res.row.d || null, latitude: res.lat, longitude: res.lng,
            last_updated: today, street_strata: null,
            survey_display_ids: [displayId],
            primary_survey_id: displayId,
          };
        });
        const inserted = await insertTrees(sbRows);
        addTrees(inserted);
        insertedCount = inserted.length;
        inserted.forEach(r => insertedIds.push(r.tree_id));
      }

      for (const res of toReplace) {
        const displayId = buildDisplayId(res.row, spreadsheetN);
        const currentIds = res.dupMatch.iids || [];
        const newIds = currentIds.includes(displayId) ? currentIds : [...currentIds, displayId];
        const fields = {
          last_updated: today,
          survey_display_ids: newIds,
          primary_survey_id: displayId,
        };
        if (res.row.n) fields.common_name = res.row.n;
        if (res.row.s) fields.scientific_name = res.row.s;
        if (VALID_COND.has(res.row.c)) fields.condition = res.row.c;
        if (VALID_AGE.has(res.row.a))  fields.age_class = res.row.a;
        if (res.row.d) fields.dbh1_in = res.row.d;
        await sbUpdateTree(res.dupMatch.id, fields);
        const local = { iids: newIds, pid: displayId };
        if (fields.common_name)     local.n = fields.common_name;
        if (fields.scientific_name) local.s = fields.scientific_name;
        if (fields.condition)       local.c = fields.condition;
        if (fields.age_class)       local.a = fields.age_class;
        if (fields.dbh1_in)         local.d = fields.dbh1_in;
        trees.update($t => $t.map(t => t.id === String(res.dupMatch.id) ? { ...t, ...local } : t));
        replacedCount++;
      }

      await saveSavedUpload(pendingFileName, pendingFileBytes, insertedCount + replacedCount, insertedIds);
      rows = []; geoResults = []; step = 'upload'; error = '';
      pendingFileBytes = null; pendingFileName = '';
      currentPage.set('map');
      const first = toAdd[0] ?? toReplace[0];
      if (first) setTimeout(() => get(mapInstance)?.setView([first.lat, first.lng], 16, { animate: true }), 300);
      let msg;
      if (insertedCount && replacedCount)
        msg = `${insertedCount} tree${insertedCount === 1 ? '' : 's'} added, ${replacedCount} updated.`;
      else if (insertedCount)
        msg = `${insertedCount} tree${insertedCount === 1 ? '' : 's'} added to the map.`;
      else
        msg = `${replacedCount} tree${replacedCount === 1 ? '' : 's'} updated.`;
      showToast(msg);
    } catch (e) {
      error = 'Error: ' + e.message;
    } finally {
      adding = false;
    }
  }
</script>

<div class="ba-view">
  <div class="ba-wrap">

    <div class="ba-topbar">
      <div class="ba-hero">
        <h1>Bulk Add Trees</h1>
        <p>Download the template, fill in your tree data, then upload. After geocoding you'll place each tree on the map before it's saved.</p>
      </div>
      <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
        <button class="ba-back-btn" onclick={() => currentPage.set('map')}>← Back to Map</button>
      </div>
    </div>

    {#if !$currentUser}
      <div class="ba-auth-notice">
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        You must be signed in to add trees. Use <strong style="margin:0 3px">Menu → Sign In</strong> to continue.
      </div>
    {/if}

    <!-- ── Upload section ───────────────────────────────────────────────────────── -->
    {#if step === 'upload'}
      <div class="ba-card">
        <div class="ba-card-title">Step 1 — Download the Template</div>
        <div class="ba-step">
          <div class="ba-step-num">1</div>
          <div class="ba-step-body">
            Download the spreadsheet template below. Fill in one row per tree —
            <strong>Street Number and Street Name are used for geocoding.</strong>
            The template includes dropdown menus for Condition, Age Class, Common Name (species), and Street Name pulled from the current inventory.
            Scientific Name auto-fills when a known species is entered.
            <br><br>
            <button class="ba-action-btn" onclick={downloadTemplate}>
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Download Template (.xlsx)
            </button>
          </div>
        </div>
      </div>

      <div class="ba-card">
        <div class="ba-card-title">Step 2 — Upload Your Filled Spreadsheet</div>
        <div class="ba-step">
          <div class="ba-step-num">2</div>
          <div class="ba-step-body">Drag and drop your saved file below, or click to browse. Accepted: <strong>.xlsx</strong> and <strong>.csv</strong>.</div>
        </div>
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="ba-drop-zone" class:drag={dragOver}
          ondragover={(e) => { e.preventDefault(); dragOver = true; }}
          ondragleave={() => dragOver = false}
          ondrop={handleDrop}
          onclick={() => document.getElementById('ba-file-input').click()}>
          <span class="ba-drop-icon">📂</span>
          <div class="ba-drop-title">Drop your spreadsheet here</div>
          <div class="ba-drop-sub">or click to browse files</div>
          <div class="ba-drop-accept">Accepts .xlsx and .csv</div>
          <input type="file" class="ba-file-input" id="ba-file-input"
            accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
            onchange={handleFileInput} />
        </div>
        {#if error}
          <div class="ba-err">{error}</div>
        {/if}
      </div>
    {/if}

    <!-- ── Inventory ID prompt ──────────────────────────────────────────────────── -->
    {#if step === 'inv-id'}
      <div class="ba-card">
        <div class="ba-card-title">Assign Inventory ID</div>
        <div class="ba-step">
          <div class="ba-step-num">2</div>
          <div class="ba-step-body">
            This upload has no <strong>Inventory ID</strong> column. You can assign one now — it will prefix every tree's survey ID
            (e.g. <strong>17481-1</strong>, <strong>17481-2</strong>…).
            Leave blank to auto-generate IDs as <strong>{getTodayMmddyy()}-N-row</strong>.
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:12px">
              <input class="ba-inv-input" type="text"
                placeholder="Inventory ID (optional)"
                bind:value={manualInvId}
                onkeydown={(e) => { if (e.key === 'Enter') confirmInvId(); }} />
              <button class="ba-submit-btn" onclick={confirmInvId}>
                {manualInvId.trim() ? `Use "${manualInvId.trim()}" →` : 'Continue without ID →'}
              </button>
            </div>
          </div>
        </div>
      </div>
    {/if}

    <!-- ── Geocoding progress ──────────────────────────────────────────────────── -->
    {#if step === 'geocoding'}
      <div class="ba-card">
        <div class="ba-card-title">Geocoding Addresses…</div>
        <div class="ba-progress">
          <div class="ba-progress-label">{geoProgress} of {geoTotal} addresses processed</div>
          <div class="ba-progress-bar-wrap">
            <div class="ba-progress-bar" style="width:{geoTotal ? Math.round((geoProgress/geoTotal)*100) : 0}%"></div>
          </div>
          <div class="ba-progress-label" style="color:var(--parch-dim);font-style:italic">
            You'll place each tree on the map in the next step.
          </div>
          <div>
            <button class="ba-back-btn" onclick={() => { geocodeCancelled = true; }}>Cancel</button>
          </div>
        </div>
      </div>
    {/if}

    <!-- ── Duplicate tree review ───────────────────────────────────────────────── -->
    {#if step === 'review' && (unresolvedDups.length > 0 || geoResults.some(r => r.dupMatch != null && r.dupAction != null))}
      <div class="ba-card">
        <div class="ba-card-title">Potential Duplicate Trees</div>
        <div class="ba-review-wrap">
          <div class="ba-review-sub">
            {#if unresolvedDups.length > 0}
              {unresolvedDups.length} tree{unresolvedDups.length === 1 ? ' matches' : 's match'} an existing tree at the same location. Choose what to do with each.
            {:else}
              All duplicates resolved.
            {/if}
          </div>
          <div class="ba-review-table">
            <table style="width:100%;border-collapse:collapse">
              <thead class="ba-review-thead">
                <tr>
                  <th>Your entry</th>
                  <th>Existing tree</th>
                  <th style="width:200px">Action</th>
                </tr>
              </thead>
              <tbody>
                {#each dupPageItems as { res, i }}
                  <tr class:ba-dup-row-resolved={res.dupAction !== null}>
                    <td class="ba-review-td">
                      <strong>{res.row.n || '(no species)'}</strong>
                      <div class="ba-dup-detail">{res.row.addr}</div>
                      {#if res.row.c}<div class="ba-dup-detail">Condition: {res.row.c}</div>{/if}
                    </td>
                    <td class="ba-review-td">
                      <strong>{res.dupMatch.n}</strong>
                      <div class="ba-dup-detail">{res.dupMatch.pid || ('#' + res.dupMatch.id)}</div>
                      {#if res.dupMatch.c}<div class="ba-dup-detail ba-dup-cond">Condition: {res.dupMatch.c}</div>{/if}
                    </td>
                    <td class="ba-review-actions ba-dup-actions">
                      {#if res.dupAction === null}
                        <button class="ba-dup-btn ba-dup-add" onclick={() => resolveDup(i, 'add')}>Add Anyway</button>
                        <button class="ba-dup-btn ba-dup-replace" onclick={() => resolveDup(i, 'replace')}>Replace</button>
                        <button class="ba-skip-btn" onclick={() => resolveDup(i, 'skip')}>Skip</button>
                      {:else}
                        <span class="ba-dup-resolved-label">
                          {res.dupAction === 'add' ? '+ Adding new' : res.dupAction === 'replace' ? '↻ Replacing' : '— Skipping'}
                        </span>
                        <button class="ba-skip-btn" onclick={() => resolveDup(i, null)}>Undo</button>
                      {/if}
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
          {#if dupTotalPages > 1}
            <div class="ba-pagination">
              <button class="ba-skip-btn" disabled={dupPage === 0} onclick={() => dupPage--}>← Prev</button>
              <span class="ba-progress-label">Page {dupPage + 1} of {dupTotalPages}</span>
              <button class="ba-skip-btn" disabled={dupPage >= dupTotalPages - 1} onclick={() => dupPage++}>Next →</button>
            </div>
          {/if}
          {#if unresolvedDups.length > 0}
            <div class="ba-bulk-actions">
              <button class="ba-skip-btn" onclick={() => resolveAllDups('skip')}>Skip all duplicates</button>
              <button class="ba-dup-btn ba-dup-replace" onclick={() => resolveAllDups('replace')}>Replace all</button>
            </div>
          {/if}
        </div>
      </div>
    {/if}

    <!-- ── Submit row ─────────────────────────────────────────────────────────── -->
    {#if step === 'review' && (toAdd.length > 0 || toReplace.length > 0 || unresolvedDups.length > 0)}
      <div class="ba-submit-row">
        <button class="ba-submit-btn" onclick={baAddTrees}
          disabled={adding || !$currentUser || unresolvedDups.length > 0}>
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          {#if adding}
            Processing…
          {:else if toAdd.length && toReplace.length}
            Add {toAdd.length} + Update {toReplace.length} Trees
          {:else if toReplace.length}
            Update {toReplace.length} Tree{toReplace.length === 1 ? '' : 's'}
          {:else}
            Add {toAdd.length} Tree{toAdd.length === 1 ? '' : 's'} to Map
          {/if}
        </button>
        {#if unresolvedDups.length > 0}
          <span class="ba-warn-label">Resolve {unresolvedDups.length} duplicate{unresolvedDups.length === 1 ? '' : 's'} above first</span>
        {:else}
          {@const skipped = geoResults.filter(r => r.lat === null).length + geoResults.filter(r => r.dupAction === 'skip').length}
          {#if skipped > 0}<span class="ba-muted-label">({skipped} skipped)</span>{/if}
        {/if}
      </div>
    {/if}

    {#if error && step !== 'upload'}
      <div class="ba-err">{error}</div>
    {/if}

    <!-- ── Previous uploads ───────────────────────────────────────────────────── -->
    <div class="ba-card">
      <div class="ba-card-title">Previous Uploads</div>
      {#if savedUploads.length}
        {#each savedUploads as u}
          <div class="ba-saved-row">
            <span class="ba-saved-name">{u.name}</span>
            <span class="ba-saved-meta">{u.treeCount} tree{u.treeCount === 1 ? '' : 's'} · {new Date(u.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
            <div class="ba-saved-btns">
              <button class="ba-mini-btn" onclick={() => downloadUpload(u)}>
                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Download
              </button>
            </div>
          </div>
        {/each}
      {:else}
        <div class="ba-empty-note">No uploads yet.</div>
      {/if}
    </div>

  </div>
</div>

<style>
  .ba-view {
    position: absolute; inset: 0;
    background: #fdf8f0;
    overflow-y: auto; z-index: 2;
  }
  .ba-wrap {
    width: 100%; max-width: 860px;
    margin: 0 auto; padding: 36px 28px 72px;
    display: flex; flex-direction: column; gap: 20px;
  }
  .ba-topbar { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
  .ba-hero { display: flex; flex-direction: column; gap: 5px; }
  .ba-hero h1 { font-family: 'Playfair Display', serif; font-size: 1.75rem; color: #0f2e14; margin: 0; }
  .ba-hero p { font-family: 'DM Mono', monospace; font-size: .65rem; color: #5c3d08; line-height: 1.7; max-width: 520px; margin: 0; }
  .ba-back-btn {
    flex-shrink: 0; background: transparent; border: 1px solid rgba(120,80,20,.25); border-radius: 4px;
    padding: 5px 13px; font-family: 'DM Mono', monospace; font-size: .68rem;
    color: #5c3d08; cursor: pointer; transition: all .13s; white-space: nowrap;
  }
  .ba-back-btn:hover { border-color: #5c3d08; background: rgba(92,61,8,.06); }
  .ba-auth-notice {
    display: flex; align-items: center; gap: 8px;
    background: rgba(92,61,8,.06); border: 1px solid rgba(120,80,20,.2);
    border-radius: 5px; padding: 10px 13px;
    font-family: 'DM Mono', monospace; font-size: .62rem; color: #5c3d08;
  }
  .ba-card {
    background: #f5ede0; border: 1px solid rgba(120,80,20,.18);
    border-radius: 8px; padding: 18px 20px;
    display: flex; flex-direction: column; gap: 12px;
  }
  .ba-card-title {
    font-family: 'DM Mono', monospace; font-size: .5rem; letter-spacing: .14em;
    text-transform: uppercase; color: #5c3d08;
    border-bottom: 1px solid rgba(120,80,20,.18); padding-bottom: 8px; font-weight: 600;
  }
  .ba-step { display: flex; align-items: flex-start; gap: 12px; }
  .ba-step-num {
    width: 22px; height: 22px; border-radius: 50%; background: #1a5216; color: #fdf8f0;
    font-size: .56rem; font-weight: 700; display: flex; align-items: center; justify-content: center;
    flex-shrink: 0; margin-top: 1px;
  }
  .ba-step-body { flex: 1; font-family: 'DM Mono', monospace; font-size: .63rem; color: #5c3d08; line-height: 1.65; }
  .ba-step-body strong { color: #1a1208; }
  .ba-action-btn {
    display: inline-flex; align-items: center; gap: 6px;
    background: transparent; border: 1px solid rgba(120,80,20,.25); border-radius: 4px; padding: 6px 14px;
    font-family: 'DM Mono', monospace; font-size: .61rem; color: #5c3d08; cursor: pointer; transition: all .13s;
  }
  .ba-action-btn:hover { border-color: #5c3d08; background: rgba(92,61,8,.06); }
  .ba-drop-zone {
    border: 2px dashed rgba(120,80,20,.2); border-radius: 7px; padding: 32px 20px;
    text-align: center; cursor: pointer; transition: all .18s; background: #f0e6d0; position: relative;
  }
  .ba-drop-zone:hover, .ba-drop-zone.drag { border-color: #1a5216; background: rgba(26,82,22,.04); }
  .ba-drop-zone.drag { border-style: solid; }
  .ba-drop-icon { font-size: 1.8rem; margin-bottom: 8px; display: block; opacity: .4; }
  .ba-drop-title { font-family: 'DM Mono', monospace; font-size: .7rem; color: #1a1208; font-weight: 500; margin-bottom: 4px; }
  .ba-drop-sub   { font-family: 'DM Mono', monospace; font-size: .58rem; color: #5c3d08; }
  .ba-drop-accept { font-family: 'DM Mono', monospace; font-size: .54rem; color: rgba(92,61,8,.5); margin-top: 6px; }
  .ba-file-input { display: none; }
  .ba-progress { display: flex; flex-direction: column; gap: 7px; }
  .ba-progress-label { font-family: 'DM Mono', monospace; font-size: .58rem; color: #5c3d08; }
  .ba-progress-bar-wrap { height: 5px; background: rgba(120,80,20,.1); border-radius: 3px; overflow: hidden; }
  .ba-progress-bar { height: 100%; background: #1a5216; border-radius: 3px; transition: width .3s ease; }
  .ba-review-wrap { display: flex; flex-direction: column; gap: 10px; }
  .ba-review-sub { font-family: 'DM Mono', monospace; font-size: .6rem; color: #5c3d08; }
  .ba-review-table { border: 1px solid rgba(120,80,20,.18); border-radius: 6px; overflow: hidden; font-family: 'DM Mono', monospace; font-size: .6rem; }
  .ba-review-thead { background: #e8ddc8; }
  .ba-review-thead :global(th) {
    padding: 7px 10px; text-align: left; font-size: .48rem; letter-spacing: .1em; text-transform: uppercase;
    color: #5c3d08; font-weight: 600; border-bottom: 1px solid rgba(120,80,20,.18);
  }
  .ba-review-td { padding: 8px 10px; border-bottom: 1px solid rgba(120,80,20,.08); color: #1a1208; vertical-align: middle; }
  .ba-review-actions { display: flex; gap: 5px; align-items: center; padding: 6px 10px; border-bottom: 1px solid rgba(120,80,20,.08); }
  .ba-dup-actions { flex-wrap: wrap; }
  .ba-dup-detail { font-size: .54rem; color: #5c3d08; margin-top: 2px; }
  .ba-dup-cond   { color: #1a5216; }
  .ba-dup-row-resolved { opacity: .55; }
  .ba-dup-resolved-label { font-size: .52rem; color: #5c3d08; font-style: italic; flex: 1; }
  .ba-bulk-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 2px; }
  .ba-accept-btn { background: #1a5216; border: none; border-radius: 3px; padding: 3px 10px; font-family: 'DM Mono', monospace; font-size: .52rem; color: #fdf8f0; font-weight: 600; cursor: pointer; }
  .ba-accept-btn:hover { opacity: .85; }
  .ba-skip-btn { background: transparent; border: 1px solid rgba(120,80,20,.25); border-radius: 3px; padding: 3px 10px; font-family: 'DM Mono', monospace; font-size: .52rem; color: #5c3d08; cursor: pointer; transition: all .12s; }
  .ba-skip-btn:hover { border-color: #5c3d08; background: rgba(92,61,8,.06); }
  .ba-dup-btn { border-radius: 3px; padding: 3px 10px; font-family: 'DM Mono', monospace; font-size: .52rem; cursor: pointer; border: 1px solid transparent; white-space: nowrap; }
  .ba-dup-add { background: rgba(26,82,22,.08); color: #1a5216; border-color: rgba(26,82,22,.22); }
  .ba-dup-add:hover { background: rgba(26,82,22,.15); }
  .ba-dup-replace { background: rgba(92,61,8,.08); color: #5c3d08; border-color: rgba(92,61,8,.22); }
  .ba-dup-replace:hover { background: rgba(92,61,8,.15); }
  .ba-submit-row { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
  .ba-submit-btn {
    display: inline-flex; align-items: center; gap: 7px; background: #1a5216; border: none;
    border-radius: 4px; padding: 8px 20px; font-family: 'DM Mono', monospace; font-size: .65rem;
    color: #fdf8f0; font-weight: 700; cursor: pointer; transition: opacity .13s;
  }
  .ba-submit-btn:hover { opacity: .88; }
  .ba-submit-btn:disabled { opacity: .35; cursor: not-allowed; }
  .ba-warn-label  { font-family: 'DM Mono', monospace; font-size: .58rem; color: #9e2020; font-style: italic; }
  .ba-muted-label { font-family: 'DM Mono', monospace; font-size: .58rem; color: #5c3d08; }
  .ba-err { font-family: 'DM Mono', monospace; font-size: .61rem; color: #9e2020; background: rgba(158,32,32,.06); border: 1px solid rgba(158,32,32,.2); border-radius: 4px; padding: 8px 12px; }
  .ba-saved-row { display: flex; align-items: center; gap: 10px; padding: 8px 12px; background: #f0e6d0; border-radius: 4px; border: 1px solid rgba(120,80,20,.15); }
  .ba-saved-name { flex: 1; font-family: 'DM Mono', monospace; font-size: .6rem; color: #1a1208; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .ba-saved-meta { font-family: 'DM Mono', monospace; font-size: .54rem; color: #5c3d08; white-space: nowrap; }
  .ba-saved-btns { display: flex; gap: 4px; flex-shrink: 0; }
  .ba-mini-btn { background: transparent; border: 1px solid rgba(120,80,20,.25); border-radius: 3px; padding: 2px 8px; font-family: 'DM Mono', monospace; font-size: .52rem; color: #5c3d08; cursor: pointer; display: inline-flex; align-items: center; gap: 3px; white-space: nowrap; transition: all .12s; }
  .ba-mini-btn:hover { border-color: #5c3d08; background: rgba(92,61,8,.06); }
  .ba-empty-note { font-family: 'DM Mono', monospace; font-size: .58rem; color: #7a6040; font-style: italic; padding: 4px 0; }
  .ba-pagination { display: flex; align-items: center; gap: 10px; justify-content: center; padding: 4px 0; }
  .ba-inv-input {
    background: #f0e6d0; border: 1px solid rgba(120,80,20,.28); border-radius: 4px;
    padding: 6px 11px; font-family: 'DM Mono', monospace; font-size: .63rem; color: #1a1208;
    width: 180px; outline: none; transition: border-color .12s;
  }
  .ba-inv-input:focus { border-color: #5c3d08; }
</style>

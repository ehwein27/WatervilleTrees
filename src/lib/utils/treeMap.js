// src/lib/utils/treeMap.js
// Shared database-row → internal tree object mapping used by both the
// client store (trees.js) and the SSR report loader (+page.server.js).

import { calcITree } from './itree.js';

// Partial object from the map-tier (column-projected) fetch.
// Detail fields are absent; _partial:true signals that a full fetch is needed on sidebar open.
export function rowToTreeMap(row) {
  const itree = calcITree(row.dbh1_in, row.condition);
  return {
    id:   String(row.tree_id),
    n:    row.common_name        || '',
    s:    row.scientific_name    || '',
    a:    row.age_class          || '',
    c:    row.condition          || '',
    d:    row.dbh1_in            || 0,
    lt:   row.latitude,
    ln:   row.longitude,
    st:   row.street_strata      || '',
    ui:   row.upload_information || '',
    iids: row.survey_display_ids || [],
    pid:  row.primary_survey_id  || '',
    vt:   itree ? itree[0] : null,
    vc:   itree ? itree[1] : null,
    va:   itree ? itree[2] : null,
    vs:   itree ? itree[3] : null,
    ve:   itree ? itree[4] : null,
    _partial: true,
  };
}

export function rowToTree(row) {
  const obs = [
    row.observation_1, row.observation_2, row.observation_3,
    row.observation_4, row.observation_5, row.observation_6,
  ].filter(Boolean);
  const itree = calcITree(row.dbh1_in, row.condition);
  return {
    id:   String(row.tree_id),
    n:    row.common_name      || '',
    s:    row.scientific_name  || '',
    a:    row.age_class        || '',
    c:    row.condition        || '',
    d:    row.dbh1_in          || 0,
    lt:   row.latitude,
    ln:   row.longitude,
    u:    row.last_updated     || '',
    st:   row.street_strata    || '',
    nt:   row.tree_notes       || undefined,
    o:    obs,
    iids: row.survey_display_ids || [],
    pid:  row.primary_survey_id  || '',
    vt:   itree ? itree[0] : null,
    vc:   itree ? itree[1] : null,
    va:   itree ? itree[2] : null,
    vs:   itree ? itree[3] : null,
    ve:   itree ? itree[4] : null,
    bm:   row.btm_nests          ?? null,
    dw:   row.distance_to_water  || '',
    ui:   row.upload_information || '',
    pd:   row.planting_date      || '',
    ap:   row.age_at_planting    || '',
    inf:  row.infestation_disease || '',
    pn:   row.protection_notes   || '',
    cp:   row.companion_plants   || '',
    ts:   row.tree_steward       || '',
    lmb:  row.last_modified_by  || '',
  };
}

const xml2js = require('xml2js');

// xml2js returns every field as an array; this safely grabs the first value
function first(val) {
  if (!val) return null;
  if (Array.isArray(val)) return first(val[0]);
  if (typeof val === 'object' && val._) return val._.trim() || null;
  return String(val).trim() || null;
}

// Some UN dates carry a timezone offset (e.g. "2015-03-27-04:00"); strip it
function sanitizeDate(val) {
  if (!val) return null;
  const match = String(val).match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

function buildFullName(...parts) {
  return parts
    .map(p => (p || '').trim())
    .filter(Boolean)
    .join(' ')
    .trim();
}

function parseIndividual(ind) {
  const primaryName = buildFullName(
    first(ind.FIRST_NAME),
    first(ind.SECOND_NAME),
    first(ind.THIRD_NAME),
    first(ind.FOURTH_NAME)
  );

  const aliases = [];
  if (ind.INDIVIDUAL_ALIAS) {
    const raw = Array.isArray(ind.INDIVIDUAL_ALIAS) ? ind.INDIVIDUAL_ALIAS : [ind.INDIVIDUAL_ALIAS];
    for (const a of raw) {
      const name = first(a.ALIAS_NAME);
      if (name) aliases.push({ alias_name: name, alias_type: 'alias', quality: first(a.QUALITY) });
    }
  }

  const dob = (() => {
    const block = ind.INDIVIDUAL_DATE_OF_BIRTH;
    if (!block) return null;
    const b = Array.isArray(block) ? block[0] : block;
    return first(b.DATE) || first(b.FROM_YEAR) || null;
  })();

  const doc = (() => {
    const block = ind.INDIVIDUAL_DOCUMENT;
    if (!block) return {};
    const b = Array.isArray(block) ? block[0] : block;
    return { type: first(b.TYPE_OF_DOCUMENT), number: first(b.NUMBER) };
  })();

  const address = (() => {
    const block = ind.INDIVIDUAL_ADDRESS;
    if (!block) return null;
    const b = Array.isArray(block) ? block[0] : block;
    return [first(b.STREET), first(b.CITY), first(b.COUNTRY)].filter(Boolean).join(', ') || null;
  })();

  return {
    source: 'UN',
    source_id: first(ind.DATAID),
    entity_type: 'individual',
    primary_name: primaryName || 'UNKNOWN',
    nationality: first(Array.isArray(ind.NATIONALITY) ? ind.NATIONALITY[0]?.VALUE : ind.NATIONALITY?.VALUE),
    dob,
    passport_number: doc.type?.toLowerCase().includes('passport') ? doc.number : null,
    national_id: doc.type?.toLowerCase().includes('national') ? doc.number : null,
    address,
    listed_on: sanitizeDate(first(ind.LISTED_ON)),
    additional_info: {
      reference_number: first(ind.REFERENCE_NUMBER),
      un_list_type: first(ind.UN_LIST_TYPE),
      comments: first(ind.COMMENTS1),
      interpol_link: first(ind.INTERPOL_LINK),
    },
    aliases: [
      { alias_name: primaryName, alias_type: 'primary', quality: null },
      ...aliases,
    ].filter(a => a.alias_name),
  };
}

function parseEntity(ent) {
  const primaryName = (first(ent.FIRST_NAME) || 'UNKNOWN').trim();

  const aliases = [];
  if (ent.ENTITY_ALIAS) {
    const raw = Array.isArray(ent.ENTITY_ALIAS) ? ent.ENTITY_ALIAS : [ent.ENTITY_ALIAS];
    for (const a of raw) {
      const name = first(a.ALIAS_NAME);
      if (name) aliases.push({ alias_name: name, alias_type: 'alias', quality: first(a.QUALITY) });
    }
  }

  const address = (() => {
    const block = ent.ENTITY_ADDRESS;
    if (!block) return null;
    const b = Array.isArray(block) ? block[0] : block;
    return [first(b.STREET), first(b.CITY), first(b.COUNTRY)].filter(Boolean).join(', ') || null;
  })();

  return {
    source: 'UN',
    source_id: first(ent.DATAID),
    entity_type: 'entity',
    primary_name: primaryName,
    nationality: null,
    dob: null,
    passport_number: null,
    national_id: null,
    address,
    listed_on: sanitizeDate(first(ent.LISTED_ON)),
    additional_info: {
      reference_number: first(ent.REFERENCE_NUMBER),
      un_list_type: first(ent.UN_LIST_TYPE),
      comments: first(ent.COMMENTS1),
      interpol_link: first(ent.INTERPOL_LINK),
    },
    aliases: [
      { alias_name: primaryName, alias_type: 'primary', quality: null },
      ...aliases,
    ].filter(a => a.alias_name),
  };
}

async function parseUN(xmlContent) {
  const result = await xml2js.parseStringPromise(xmlContent, { explicitArray: true, trim: true });
  const list = result.CONSOLIDATED_LIST;

  const records = [];

  const individuals = list.INDIVIDUALS?.[0]?.INDIVIDUAL || [];
  for (const ind of individuals) {
    try {
      records.push(parseIndividual(ind));
    } catch (e) {
      console.warn('Skipping UN individual:', e.message);
    }
  }

  const entities = list.ENTITIES?.[0]?.ENTITY || [];
  for (const ent of entities) {
    try {
      records.push(parseEntity(ent));
    } catch (e) {
      console.warn('Skipping UN entity:', e.message);
    }
  }

  return records;
}

module.exports = { parseUN };

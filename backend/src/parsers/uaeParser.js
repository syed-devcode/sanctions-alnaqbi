// ISO-2 country codes to full names (subset covering common nationalities)
const COUNTRY_CODES = {
  ae: 'UAE', lb: 'Lebanon', sy: 'Syria', iq: 'Iraq', ir: 'Iran',
  sa: 'Saudi Arabia', jo: 'Jordan', eg: 'Egypt', ly: 'Libya', ye: 'Yemen',
  af: 'Afghanistan', pk: 'Pakistan', sd: 'Sudan', so: 'Somalia',
  tn: 'Tunisia', ma: 'Morocco', dz: 'Algeria', ps: 'Palestine',
  kw: 'Kuwait', bh: 'Bahrain', qa: 'Qatar', om: 'Oman',
  us: 'United States', gb: 'United Kingdom', de: 'Germany', fr: 'France',
};

function arr(val) {
  if (!val) return [];
  return Array.isArray(val) ? val : [val];
}

function parseRecord(obj) {
  const props = obj.properties || {};
  const names = arr(props.name).filter(Boolean);
  if (!names.length) return null;

  const primaryName = obj.caption || names[0];
  const entityType = obj.schema === 'Person' ? 'individual' : 'entity';

  const nationality = arr(props.nationality)[0];
  const nationalityName = nationality ? (COUNTRY_CODES[nationality.toLowerCase()] || nationality.toUpperCase()) : null;

  const aliases = names.map((n, i) => ({
    alias_name: n,
    alias_type: i === 0 ? 'primary' : 'alias',
    quality: null,
  }));

  // Pull listing date from nested sanctions object if present
  const sanctionObj = arr(props.sanctions)[0];
  const listedOn = sanctionObj?.properties?.startDate?.[0] || null;

  // Pull ID numbers
  const idNumbers = arr(props.idNumber).filter(Boolean);
  const passportEntry = idNumbers.find(n => /passport/i.test(n));
  const idEntry = idNumbers.find(n => !/passport/i.test(n));

  return {
    source: 'UAE',
    source_id: obj.id,
    entity_type: entityType,
    primary_name: primaryName,
    nationality: nationalityName,
    dob: arr(props.birthDate)[0] || null,
    passport_number: passportEntry || null,
    national_id: idEntry || null,
    address: arr(props.address)[0] || null,
    listed_on: listedOn,
    additional_info: {
      program_id: arr(props.programId)[0] || null,
      birth_place: arr(props.birthPlace)[0] || null,
      datasets: obj.datasets,
      first_seen: obj.first_seen,
      last_seen: obj.last_seen,
    },
    aliases,
  };
}

function parseUAE(content) {
  const lines = content.split('\n').filter(Boolean);

  const records = [];
  for (const line of lines) {
    try {
      const obj = JSON.parse(line);
      if (!obj.target) continue;                    // only sanctioned targets
      if (obj.schema === 'Vessel') continue;        // skip vessels
      const record = parseRecord(obj);
      if (record) records.push(record);
    } catch (e) {
      console.warn('Skipping UAE record:', e.message);
    }
  }

  return records;
}

module.exports = { parseUAE };

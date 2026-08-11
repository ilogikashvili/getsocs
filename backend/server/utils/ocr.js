function parseGeorgianID(rawText) {
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
  const result = {
    rawText,
    firstName: null,
    lastName: null,
    dateOfBirth: null,
    dateOfExpiry: null,
    dateOfIssue: null,
    placeOfBirth: null,
    issuingAuthority: null,
    personalNo: null,
    sex: null,
    cardNo: null,
    nationality: null,
    mrzLine1: null,
    mrzLine2: null,
    mrzLine3: null,
    parsedFrom: 'ocr'
  };
  const mrzLines = lines.filter(l => /^[A-Z0-9<]{20,}$/.test(l.replace(/\s/g, '')));
  if (mrzLines.length >= 1) result.mrzLine1 = mrzLines[0];
  if (mrzLines.length >= 2) result.mrzLine2 = mrzLines[1];
  if (mrzLines.length >= 3) result.mrzLine3 = mrzLines[2];

  if (result.mrzLine2) {
    const mrz2 = result.mrzLine2.replace(/\s/g, '');
    const dobRaw = mrz2.substring(0, 6);
    if (/^\d{6}$/.test(dobRaw)) {
      const yr = parseInt(dobRaw.substring(0, 2));
      const mo = dobRaw.substring(2, 4);
      const dy = dobRaw.substring(4, 6);
      const fullYr = yr > 30 ? 1900 + yr : 2000 + yr;
      result.dateOfBirth = `${dy}.${mo}.${fullYr}`;
    }
    const sexChar = mrz2[6];
    if (sexChar === 'M') result.sex = 'Male';
    else if (sexChar === 'F') result.sex = 'Female';
    const expRaw = mrz2.substring(7, 13);
    if (/^\d{6}$/.test(expRaw)) {
      const yr = parseInt(expRaw.substring(0, 2));
      const mo = expRaw.substring(2, 4);
      const dy = expRaw.substring(4, 6);
      const fullYr = yr > 30 ? 1900 + yr : 2000 + yr;
      result.dateOfExpiry = `${dy}.${mo}.${fullYr}`;
    }
    const nat = mrz2.substring(14, 17).replace(/</g, '');
    if (nat) result.nationality = nat;
    const pno = mrz2.substring(17, 28).replace(/</g, '');
    if (pno) result.personalNo = pno;
  }

  const nameLine = result.mrzLine3 || result.mrzLine1;
  if (nameLine) {
    const parts = nameLine.split('<<');
    if (parts.length >= 2) {
      result.lastName = parts[0].replace(/</g, ' ').trim();
      result.firstName = parts[1].replace(/</g, ' ').trim();
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const upper = line.toUpperCase();
    if ((upper.includes('PLACE OF BIRTH') || upper.includes('დაბადების ადგილი')) && lines[i + 1]) {
      result.placeOfBirth = result.placeOfBirth || lines[i + 1].replace(/[^A-Za-zა-ჰ\s]/g, '').trim();
    }
    if ((upper.includes('DATE OF ISSUE') || upper.includes('გაცემის თარიღი')) && lines[i + 1]) {
      const dateMatch = lines[i + 1].match(/\d{2}[.\-/]\d{2}[.\-/]\d{4}/);
      if (dateMatch) result.dateOfIssue = result.dateOfIssue || dateMatch[0];
    }
    if ((upper.includes('ISSUING AUTHORITY') || upper.includes('გამცემი ორგანო')) && lines[i + 1]) {
      result.issuingAuthority = result.issuingAuthority || lines[i + 1].trim();
    }
    if (upper.includes('MINISTRY OF JUSTICE')) {
      result.issuingAuthority = result.issuingAuthority || 'MINISTRY OF JUSTICE';
    }
    if (upper.includes('CARD NO') || upper.includes('ბარათი')) {
      const cnMatch = line.match(/[A-Z0-9]{6,}/);
      if (cnMatch) result.cardNo = result.cardNo || cnMatch[0];
    }
    if (upper.includes('FIRST NAME') && lines[i + 1] && !result.firstName) {
      result.firstName = lines[i + 1].trim();
    }
    if (upper.includes('LAST NAME') && lines[i + 1] && !result.lastName) {
      result.lastName = lines[i + 1].trim();
    }
    if (upper.includes('PERSONAL NO') && lines[i + 1] && !result.personalNo) {
      const pnMatch = lines[i + 1].match(/\d{9,11}/);
      if (pnMatch) result.personalNo = pnMatch[0];
    }
    if ((upper.includes('DATE OF BIRTH') || upper.includes('დაბადების თარიღი')) && lines[i + 1] && !result.dateOfBirth) {
      const dateMatch = lines[i + 1].match(/\d{2}[.\-/]\d{2}[.\-/]\d{4}/);
      if (dateMatch) result.dateOfBirth = dateMatch[0];
    }
    if ((upper.includes('DATE OF EXPIRY') || upper.includes('მოქმედების ვადა')) && lines[i + 1] && !result.dateOfExpiry) {
      const dateMatch = lines[i + 1].match(/\d{2}[.\-/]\d{2}[.\-/]\d{4}/);
      if (dateMatch) result.dateOfExpiry = dateMatch[0];
    }
    if (upper.includes('SEX') && !result.sex) {
      const sMatch = line.match(/\b(M|F|MALE|FEMALE)\b/i);
      if (sMatch) result.sex = sMatch[1].length === 1
        ? (sMatch[1].toUpperCase() === 'M' ? 'Male' : 'Female')
        : sMatch[1];
    }
  }

  return result;
}

module.exports = { parseGeorgianID };

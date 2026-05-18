/**
 * Basic GEDCOM parser
 * Converts GEDCOM format to family tree structure
 */

export const parseGEDCOM = (gedcomText) => {
  const lines = gedcomText.split('\n');
  const people = {};
  const relationships = [];
  let currentPerson = null;
  let rootPersonId = null;

  const idMap = {}; // Map GEDCOM IDs to our IDs

  for (const line of lines) {
    const match = line.match(/^(\d+)\s+(@[^@]+@|\w+)(?:\s+(.*))?$/);
    if (!match) continue;

    const level = parseInt(match[1]);
    const tag = match[2];
    const value = match[3] || '';

    if (level === 0 && tag.startsWith('@')) {
      // New person
      const gedcomId = tag;
      currentPerson = {
        givenNames: '',
        surname: '',
        gender: '',
        birthDate: '',
        birthPlace: '',
        deathDate: '',
        email: '',
        photo: '',
        colorLabel: '',
      };
      idMap[gedcomId] = { ...currentPerson };
    } else if (level === 1 && currentPerson && tag === 'NAME') {
      // Parse name: "Given Names /Surname/"
      const nameMatch = value.match(/^(.+?)\s*\/(.+?)\/?$/);
      if (nameMatch) {
        currentPerson.givenNames = nameMatch[1].trim();
        currentPerson.surname = nameMatch[2].trim();
      } else {
        currentPerson.givenNames = value;
      }
    } else if (level === 1 && currentPerson && tag === 'SEX') {
      currentPerson.gender = value === 'M' ? 'Male' : value === 'F' ? 'Female' : 'Other';
    } else if (level === 1 && currentPerson && tag === 'BIRT') {
      // Next DATE tag will contain the date
      currentPerson._pendingBirth = true;
    } else if (level === 2 && currentPerson && tag === 'DATE' && currentPerson._pendingBirth) {
      currentPerson.birthDate = value;
      currentPerson._pendingBirth = false;
    } else if (level === 1 && currentPerson && tag === 'PLAC') {
      currentPerson.birthPlace = value;
    } else if (level === 1 && currentPerson && tag === 'DEAT') {
      currentPerson._pendingDeath = true;
    } else if (level === 2 && currentPerson && tag === 'DATE' && currentPerson._pendingDeath) {
      currentPerson.deathDate = value;
      currentPerson._pendingDeath = false;
    } else if (level === 1 && currentPerson && tag === 'EMAIL') {
      currentPerson.email = value;
    } else if (level === 1 && currentPerson && tag === 'OBJE') {
      // Next URL tag will have the photo
      currentPerson._pendingPhoto = true;
    } else if (level === 2 && currentPerson && tag === 'URL' && currentPerson._pendingPhoto) {
      currentPerson.photo = value;
      currentPerson._pendingPhoto = false;
    } else if (level === 1 && tag === 'FAM') {
      // Family relationships
      if (!currentPerson) continue;
      const familyId = value;
      currentPerson._familyId = familyId;
    } else if (level === 1 && (tag === 'FAMC' || tag === 'FAMS')) {
      // Child or spouse relationship
      if (currentPerson) {
        currentPerson._relationship = tag === 'FAMC' ? 'child' : 'spouse';
        currentPerson._relationshipId = value;
      }
    }
  }

  // Convert to our format
  let counter = 0;
  const newIdMap = {};
  for (const [gedcomId, person] of Object.entries(idMap)) {
    delete person._pendingBirth;
    delete person._pendingDeath;
    delete person._pendingPhoto;
    const newId = `person_${counter++}`;
    newIdMap[gedcomId] = newId;
    people[newId] = { id: newId, ...person };
    if (!rootPersonId) rootPersonId = newId;
  }

  return {
    people,
    relationships,
    rootPersonId,
  };
};

/**
 * Export family tree to GEDCOM format
 */
export const exportToGEDCOM = (people, relationships) => {
  let gedcom = '0 HEAD\n';
  gedcom += '1 SOUR FamilyTree\n';
  gedcom += '1 VERS 5.5.1\n';
  gedcom += '1 CHAR UTF-8\n';

  // Export people
  let personIndex = 1;
  const idMap = {};
  for (const [id, person] of Object.entries(people)) {
    const gedcomId = `@I${personIndex}@`;
    idMap[id] = gedcomId;
    personIndex++;

    gedcom += `0 ${gedcomId} INDI\n`;
    
    // Name
    const surname = person.surname || '';
    gedcom += `1 NAME ${person.givenNames || ''} /${surname}/\n`;
    
    // Gender
    if (person.gender) {
      const genderCode = person.gender === 'Male' ? 'M' : person.gender === 'Female' ? 'F' : 'U';
      gedcom += `1 SEX ${genderCode}\n`;
    }
    
    // Birth
    if (person.birthDate || person.birthPlace) {
      gedcom += '1 BIRT\n';
      if (person.birthDate) gedcom += `2 DATE ${person.birthDate}\n`;
      if (person.birthPlace) gedcom += `2 PLAC ${person.birthPlace}\n`;
    }
    
    // Death
    if (person.deathDate) {
      gedcom += '1 DEAT\n';
      gedcom += `2 DATE ${person.deathDate}\n`;
    }
    
    // Email
    if (person.email) {
      gedcom += `1 EMAIL ${person.email}\n`;
    }
    
    // Photo
    if (person.photo) {
      gedcom += '1 OBJE\n';
      gedcom += `2 URL ${person.photo}\n`;
    }
  }

  gedcom += '0 TRLR\n';
  return gedcom;
};

/**
 * Export to JSON format
 */
export const exportToJSON = (people, relationships, rootPersonId) => {
  return {
    version: 1,
    exportDate: new Date().toISOString(),
    people,
    relationships,
    rootPersonId,
  };
};

/**
 * Import from JSON format
 */
export const importFromJSON = (jsonData) => {
  if (!jsonData || jsonData.version !== 1) {
    throw new Error('Invalid JSON format');
  }
  return {
    people: jsonData.people || {},
    relationships: jsonData.relationships || [],
    rootPersonId: jsonData.rootPersonId,
  };
};

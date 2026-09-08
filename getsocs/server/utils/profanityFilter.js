// List of bad words and curses to filter
const badWords = [
  'damn', 'dammit', 'shit', 'shitty', 'fuck', 'fucking', 'bitch', 'bitching',
  'bastard', 'asshole', 'crap', 'dick', 'dickhead', 'prick', 'douche',
  'whore', 'slut', 'ass', 'cunt', 'hell', 'piss', 'cock', 'pussy'
];

function containsProfanity(text) {
  if (!text || typeof text !== 'string') return false;
  return badWords.some(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    return regex.test(text);
  });
}

function filterProfanity(text) {
  if (!text || typeof text !== 'string') return text;
  
  let filtered = text;
  badWords.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    filtered = filtered.replace(regex, '*'.repeat(word.length));
  });
  
  return filtered;
}

module.exports = { filterProfanity, containsProfanity };

const fs = require('fs');
const path = require('path');
const dbPath = path.join(__dirname, 'db.json');
const adminUsername = 'admin';
const adminEmail = 'iliko5.iliko5@gmail.com';
const hash = '$2b$10$fS2zLIEt8nEeAylPjMmVd.6DutqRVvqCBM3dh2ZPYxAvnAqbE3EBy';
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
let changed = false;
let foundAdmin = false;

for (const u of db.users) {
  if (u.username === adminUsername || u.role === 'admin' || u.email === adminEmail) {
    u.username = adminUsername;
    u.email = adminEmail;
    u.password = hash;
    u.role = 'admin';
    u.verified = true;
    u.verifiedAt = u.verifiedAt || new Date().toISOString();
    foundAdmin = true;
    changed = true;
  }
}

if (!foundAdmin) {
  db.users.push({
    id: Date.now().toString(),
    username: adminUsername,
    name: 'Admin',
    lastname: 'User',
    email: adminEmail,
    password: hash,
    role: 'admin',
    banned: false,
    verified: true,
    buyerVerified: false,
    hideProfile: false,
    knownIps: []
  });
  changed = true;
}

fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
console.log('updated', changed);

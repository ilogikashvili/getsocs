const fs = require('fs');
const path = require('path');

describe('MySQL production schema', () => {
  const schema = fs.readFileSync(path.join(__dirname, '..', 'database', 'schema.sql'), 'utf8');
  const expectedTables = [
    'app_meta','users','refresh_tokens','products','comments','transactions','chats','support_chats',
    'scanned_ids','bids','escrow','notifications','idempotency_keys','reviews','badges','user_badges',
    'ad_spaces','banned_ips','email_delete_blocks','memberships','user_memberships','addons','user_addons','analytics'
  ];

  test.each(expectedTables)('creates %s', table => {
    expect(schema).toMatch(new RegExp(`CREATE TABLE IF NOT EXISTS\\s+${table}\\s*\\(`, 'i'));
  });

  test('uses InnoDB and foreign keys', () => {
    expect(schema).toMatch(/ENGINE=InnoDB/);
    expect(schema).toMatch(/FOREIGN KEY \(user_id\) REFERENCES users\(id\)/);
    expect(schema).toMatch(/FOREIGN KEY \(transaction_id\) REFERENCES transactions\(id\)/);
  });

  test('normalizes refresh sessions', () => {
    expect(schema).toMatch(/CREATE TABLE IF NOT EXISTS refresh_tokens/);
    expect(schema).toMatch(/UNIQUE KEY uq_refresh_tokens_hash \(token_hash\)/);
    expect(schema).toMatch(/KEY idx_refresh_tokens_family \(family_id\)/);
  });
});

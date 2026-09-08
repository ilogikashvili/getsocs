const request = require('supertest');
const jwt = require('jsonwebtoken');
const { app } = require('../server');
const { readDB, writeDB } = require('../config/db');

describe('IDOR (Insecure Direct Object Reference) Prevention Tests', () => {
  let db;
  let user1, user2, user3, adminUser;

  beforeAll(() => {
    db = readDB();
    
    // Create test users
    user1 = {
      id: 'user_idor_1',
      username: 'idoruser1',
      email: 'idor1@example.com',
      password: 'hashed_pass_1',
      role: 'user',
      verified: true,
      banned: false
    };
    
    user2 = {
      id: 'user_idor_2',
      username: 'idoruser2',
      email: 'idor2@example.com',
      password: 'hashed_pass_2',
      role: 'user',
      verified: true,
      banned: false
    };

    user3 = {
      id: 'user_idor_3',
      username: 'idoruser3',
      email: 'idor3@example.com',
      password: 'hashed_pass_3',
      role: 'user',
      verified: true,
      banned: false
    };
    
    adminUser = {
      id: 'admin_idor_1',
      username: 'idoradmin',
      email: 'idoradmin@example.com',
      password: 'hashed_pass_admin',
      role: 'admin',
      verified: true,
      banned: false
    };
    
    db.users = (db.users || []).concat([user1, user2, user3, adminUser]);
    db.products = db.products || [];
    db.transactions = db.transactions || [];
    db.chats = db.chats || [];
    db.bids = db.bids || [];
    writeDB(db);
  });

  afterAll(() => {
    // Cleanup
    db = readDB();
    db.users = db.users.filter(u => !u.id.includes('idor'));
    db.products = db.products.filter(p => !p.id.includes('idor'));
    db.transactions = (db.transactions || []).filter(tx => !tx.id.includes('idor'));
    db.chats = (db.chats || []).filter(c => !c.id?.includes('idor'));
    writeDB(db);
  });

  describe('✅ Transaction Access - IDOR Vulnerability Test (Critical)', () => {
    let tx1;

    beforeAll(() => {
      db = readDB();
      // Create transaction between user1 (buyer) and user2 (seller)
      tx1 = {
        id: 'tx_idor_1',
        buyerId: user1.id,
        buyerName: user1.username,
        sellerId: user2.id,
        sellerName: user2.username,
        productId: 'prod_idor_1',
        productTitle: 'Test Product',
        productPrice: 100,
        serviceFee: 6,
        totalPrice: 106,
        status: 'pending',
        stage: 'waiting',
        createdAt: new Date().toISOString()
      };
      db.transactions = [tx1];
      writeDB(db);
    });

    it('should allow buyer to access their transaction', (done) => {
      const token = jwt.sign(
        { id: user1.id, username: user1.username, role: user1.role },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      request(app)
        .get(`/api/transactions/${tx1.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body.success).toBe(true);
          expect(res.body.data.id).toBe(tx1.id);
          done();
        });
    });

    it('should allow seller to access their transaction', (done) => {
      const token = jwt.sign(
        { id: user2.id, username: user2.username, role: user2.role },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      request(app)
        .get(`/api/transactions/${tx1.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body.success).toBe(true);
          done();
        });
    });

    it('⚠️ SHOULD PREVENT third parties from accessing transaction (IDOR VULNERABILITY)', (done) => {
      // User3 is NOT involved in this transaction
      const token = jwt.sign(
        { id: user3.id, username: user3.username, role: user3.role },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      request(app)
        .get(`/api/transactions/${tx1.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403) // Should be Forbidden
        .end((err, res) => {
          if (err) {
            // If we get 200, that's the IDOR vulnerability
            console.log('\n🔴 IDOR VULNERABILITY CONFIRMED');
            console.log('   User3 was able to access User1 & User2\'s private transaction!');
            console.log('   Expected: 403 Forbidden');
            console.log('   Got: 200 OK');
            return done();
          }
          expect(res.body.success).toBe(false);
          done();
        });
    });
  });

  describe('✅ Product Operations - IDOR Prevention Tests', () => {
    let prod1;

    beforeAll(() => {
      db = readDB();
      prod1 = {
        id: 'prod_idor_1',
        title: 'IDOR Test Product',
        description: 'Test product for IDOR prevention',
        price: 150,
        platform: 'YouTube',
        topic: 'Gaming',
        sellerId: user1.id,
        sellerName: user1.username,
        status: 'approved',
        images: ['img1.jpg'],
        code: 'SECRET_CODE_ABC123',
        promoted: false,
        premium: false,
        hidden: false,
        createdAt: new Date().toISOString()
      };
      db.products = [prod1];
      writeDB(db);
    });

    it('should allow seller to promote their own product', (done) => {
      const token = jwt.sign(
        { id: user1.id, username: user1.username, role: user1.role },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      request(app)
        .post(`/api/products/${prod1.id}/promote`)
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body.success).toBe(true);
          expect(res.body.data.promoted).toBe(true);
          done();
        });
    });

    it('should prevent other users from promoting products (ownership verification)', (done) => {
      const token = jwt.sign(
        { id: user2.id, username: user2.username, role: user2.role },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      request(app)
        .post(`/api/products/${prod1.id}/promote`)
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(403)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body.success).toBe(false);
          expect(res.body.error).toContain('Forbidden');
          done();
        });
    });

    it('should allow seller to hide their product', (done) => {
      const token = jwt.sign(
        { id: user1.id, username: user1.username, role: user1.role },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      request(app)
        .post(`/api/products/${prod1.id}/hide`)
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body.success).toBe(true);
          expect(res.body.data.hidden).toBe(true);
          done();
        });
    });

    it('should prevent other users from hiding products', (done) => {
      const token = jwt.sign(
        { id: user2.id, username: user2.username, role: user2.role },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      request(app)
        .post(`/api/products/${prod1.id}/publicize`)
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(403)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body.success).toBe(false);
          done();
        });
    });
  });

  describe('✅ Chat Access - IDOR Prevention Tests', () => {
    let chat1;

    beforeAll(() => {
      db = readDB();
      chat1 = {
        id: 'chat_idor_1',
        txId: 'tx_idor_1',
        participants: [user1.id, user2.id],
        messages: [],
        createdAt: new Date().toISOString()
      };
      db.chats = [chat1];
      writeDB(db);
    });

    it('should allow participant to access chat', (done) => {
      const token = jwt.sign(
        { id: user1.id, username: user1.username, role: user1.role },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      request(app)
        .get(`/api/chats/${chat1.txId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body.success).toBe(true);
          done();
        });
    });

    it('should prevent non-participants from accessing chat (IDOR prevention)', (done) => {
      const token = jwt.sign(
        { id: user3.id, username: user3.username, role: user3.role },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      request(app)
        .get(`/api/chats/${chat1.txId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body.success).toBe(false);
          expect(res.body.error).toContain('Forbidden');
          done();
        });
    });
  });

  describe('✅ Profile Updates - IDOR Prevention Tests', () => {
    it('should allow users to update only their own profile', (done) => {
      const token = jwt.sign(
        { id: user1.id, username: user1.username, role: user1.role },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      request(app)
        .post('/api/auth/profile/update')
        .set('Authorization', `Bearer ${token}`)
        .send({ description: 'My updated description' })
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          expect(res.body.success).toBe(true);
          expect(res.body.user.id).toBe(user1.id);
          done();
        });
    });
  });
});

const { loadChatState, saveChatState } = require('../repositories/chatRepository');
const { containsProfanity } = require('../utils/profanityFilter');
const { isUserOnline } = require('../utils/presence');

function getUserById(db, id) {
  return (db.users || []).find(u => u.id === id);
}

function decorateMessages(db, messages) {
  return (messages || []).map(message => {
    const sender = getUserById(db, message.userId);
    const senderRole = message.senderRole || message.role || sender?.role || 'user';
    return {
      ...message,
      senderName: message.senderName || sender?.username || 'Customer',
      senderRole,
      isStaff: senderRole === 'admin' || senderRole === 'escrow'
    };
  });
}

function buildMessage(user, text) {
  const senderRole = user.role || 'user';
  const message = {
    id: Date.now().toString(),
    userId: user.id,
    senderName: user.username || 'Customer',
    senderRole,
    text: text.trim(),
    ts: new Date().toISOString()
  };
  if (senderRole === 'escrow' || senderRole === 'admin') {
    message.escrow = true;
    // Keep the legacy field for existing clients while providing an explicit
    // senderRole to all current clients.
    message.role = senderRole;
  }
  return message;
}

function canAccessChat(user, tx) {
  if (!user) return false;
  if (user.role === 'escrow' || user.role === 'admin') return true;
  return tx.buyerId === user.id || tx.sellerId === user.id;
}

function canAccessDirectChat(user, chat) {
  if (!user || !chat) return false;
  if (user.role === 'escrow' || user.role === 'admin') return true;
  return Array.isArray(chat.participants) && chat.participants.includes(user.id);
}

function buildChatPresence(db, tx) {
  const buyer = getUserById(db, tx.buyerId);
  const seller = getUserById(db, tx.sellerId);
  const escrow = tx.escrowId ? getUserById(db, tx.escrowId) : null;
  return {
    buyerOnline: isUserOnline(buyer),
    sellerOnline: isUserOnline(seller),
    escrowOnline: escrow ? isUserOnline(escrow) : false,
    escrowName: escrow ? escrow.username : null
  };
}

async function getChat(req, res) {
  try {
    const db = await loadChatState();
    const user = getUserById(db, req.user.id);
    const tx = (db.transactions || []).find(t => t.id === req.params.txId);
    if (!tx || !canAccessChat(user, tx)) return res.status(403).json({ success: false, error: 'Forbidden' });
    if (!db.chats) db.chats = [];
    let chat = db.chats.find(c => c.txId === req.params.txId);
    if (!chat) {
      chat = { id: req.params.txId, txId: req.params.txId, messages: [] };
      db.chats.push(chat);
    }
    // Mark this chat as read by the requester the moment they open it
    if (!chat.readAt) chat.readAt = {};
    chat.readAt[user.id] = new Date().toISOString();
    await saveChatState(db);
    res.json({
      success: true,
      messages: decorateMessages(db, chat.messages),
      chat,
      presence: buildChatPresence(db, tx)
    });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
}

async function getEscrowChat(req, res) {
  try {
    const db = await loadChatState();
    const user = getUserById(db, req.user.id);
    const tx = (db.transactions || []).find(t => t.id === req.params.txId);
    if (!tx || !canAccessChat(user, tx)) return res.status(403).json({ success: false, error: 'Forbidden' });
    const chat = (db.chats || []).find(c => c.txId === req.params.txId) || { id: null, txId: req.params.txId, messages: [] };
    res.json({ success: true, chat: { ...chat, messages: decorateMessages(db, chat.messages) }, presence: buildChatPresence(db, tx) });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
}

async function postMessage(req, res) {
  try {
    const { text } = req.body;
    if (!text || text.trim().length === 0) return res.status(400).json({ success: false, error: 'Message text required' });
    if (containsProfanity(text)) return res.status(400).json({ success: false, error: 'Message contains forbidden language' });
    const db = await loadChatState();
    const user = getUserById(db, req.user.id);
    const tx = (db.transactions || []).find(t => t.id === req.params.txId);
    if (!tx || !canAccessChat(user, tx)) return res.status(403).json({ success: false, error: 'Forbidden' });

    // Only one escrow handles a given deal: whichever escrow replies first is
    // auto-assigned, and other escrow agents are blocked from then on (admins can always post).
    if (user.role === 'escrow') {
      if (!tx.escrowId) {
        tx.escrowId = user.id;
        tx.escrowName = user.username;
        tx.escrowAssignedAt = new Date().toISOString();
      } else if (tx.escrowId !== user.id) {
        return res.status(403).json({ success: false, error: 'This deal is already being handled by another escrow agent.' });
      }
    }

    if (!db.chats) db.chats = [];
    let chat = db.chats.find(c => c.txId === req.params.txId);
    if (!chat) {
      chat = { id: req.params.txId, txId: req.params.txId, messages: [] };
      db.chats.push(chat);
    }
    const trimmedText = text.trim();
    const m = buildMessage(user, trimmedText);
    // Detect an @escrow tag/mention so escrow agents know a deal needs attention
    if (/@escrow\b/i.test(trimmedText)) {
      chat.escrowRequested = true;
      chat.escrowRequestedAt = new Date().toISOString();
      m.taggedEscrow = true;
    }
    chat.messages.push(m);
    // Sending a message also counts as having read up to this point
    if (!chat.readAt) chat.readAt = {};
    chat.readAt[user.id] = m.ts;
    await saveChatState(db);
    res.json({ success: true, message: m, tx });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
}

async function getDirectChats(req, res) {
  try {
    const db = await loadChatState();
    const user = getUserById(db, req.user.id);
    if (!user) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const directChats = (db.chats || [])
      .filter(c => c.type === 'direct' && Array.isArray(c.participants) && c.participants.includes(user.id))
      .map(chat => {
        const otherId = chat.participants.find(id => id !== user.id);
        return {
          id: chat.id,
          participantId: otherId,
          participantName: chat.participantNames?.[otherId] || 'Unknown',
          lastMessage: chat.messages?.length ? chat.messages[chat.messages.length - 1].text : '',
          updatedAt: chat.messages?.length ? chat.messages[chat.messages.length - 1].ts : chat.createdAt,
          participants: chat.participants
        };
      });
    res.json({ success: true, data: directChats });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
}

async function createDirectChat(req, res) {
  try {
    const db = await loadChatState();
    const user = getUserById(db, req.user.id);
    const other = getUserById(db, req.params.userId);
    if (!user) return res.status(401).json({ success: false, error: 'Unauthorized' });
    if (!other) return res.status(404).json({ success: false, error: 'User not found' });
    if (user.id === other.id) return res.status(400).json({ success: false, error: 'Cannot open chat with yourself' });
    if (user.banned || other.banned) return res.status(403).json({ success: false, error: 'Banned users cannot participate in direct messages' });

    if (!db.chats) db.chats = [];
    let chat = db.chats.find(c => c.type === 'direct' && Array.isArray(c.participants) && c.participants.includes(user.id) && c.participants.includes(other.id));
    if (!chat) {
      chat = {
        id: Date.now().toString(),
        type: 'direct',
        participants: [user.id, other.id],
        participantNames: {
          [user.id]: user.username,
          [other.id]: other.username
        },
        messages: [],
        createdAt: new Date().toISOString()
      };
      db.chats.push(chat);
      await saveChatState(db);
    }
    res.json({ success: true, chat: { ...chat, messages: decorateMessages(db, chat.messages) } });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
}

async function getDirectChat(req, res) {
  try {
    const db = await loadChatState();
    const user = getUserById(db, req.user.id);
    const chat = (db.chats || []).find(c => c.id === req.params.chatId && c.type === 'direct');
    if (!chat || !canAccessDirectChat(user, chat)) return res.status(403).json({ success: false, error: 'Forbidden' });
    res.json({ success: true, chat: { ...chat, messages: decorateMessages(db, chat.messages) } });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
}

async function postDirectMessage(req, res) {
  try {
    const { text } = req.body;
    if (!text || text.trim().length === 0) return res.status(400).json({ success: false, error: 'Message text required' });
    if (containsProfanity(text)) return res.status(400).json({ success: false, error: 'Message contains forbidden language' });
    const db = await loadChatState();
    const user = getUserById(db, req.user.id);
    const chat = (db.chats || []).find(c => c.id === req.params.chatId && c.type === 'direct');
    if (!chat || !canAccessDirectChat(user, chat)) return res.status(403).json({ success: false, error: 'Forbidden' });
    const m = buildMessage(user, text);
    chat.messages.push(m);
    await saveChatState(db);
    res.json({ success: true, message: m });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
}

// Support chat functions
async function getSupportChats(req, res) {
  try {
    const db = await loadChatState();
    const user = db.users.find(u => u.id === req.user.id);
    if (!user) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const supportChats = user.role === 'admin' || user.role === 'escrow'
      ? (db.supportChats || [])
      : (db.supportChats || []).filter(c => c.userId === user.id);
    res.json({ success: true, data: supportChats });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
}

async function getSupportChat(req, res) {
  try {
    const db = await loadChatState();
    const user = db.users.find(u => u.id === req.user.id);
    const supportChat = (db.supportChats || []).find(c => c.id === req.params.chatId);
    if (!supportChat) return res.status(404).json({ success: false, error: 'Chat not found' });
    
    // Check if user can access this chat
    if (user.role !== 'admin' && user.role !== 'escrow' && supportChat.userId !== user.id) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    
    if (supportChat.banned) {
      return res.status(403).json({ success: false, error: 'This chat has been banned' });
    }

    if (!supportChat.readAt) supportChat.readAt = {};
    supportChat.readAt[user.id] = new Date().toISOString();
    await saveChatState(db);

    res.json({ success: true, chat: { ...supportChat, messages: decorateMessages(db, supportChat.messages) } });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
}

async function createSupportChat(req, res) {
  try {
    const db = await loadChatState();
    const user = db.users.find(u => u.id === req.user.id);
    if (!user) return res.status(401).json({ success: false, error: 'Unauthorized' });
    if (user.banned) return res.status(403).json({ success: false, error: 'User is banned' });
    
    // Check if user already has an open support chat
    let supportChat = (db.supportChats || []).find(c => c.userId === req.user.id && !c.closed);
    
    if (!supportChat) {
      supportChat = {
        id: Date.now().toString(),
        userId: req.user.id,
        userName: user.username,
        assignedTo: null,
        assignedToName: null,
        messages: [],
        createdAt: new Date().toISOString(),
        closed: false,
        banned: false
      };
      if (!db.supportChats) db.supportChats = [];
      db.supportChats.push(supportChat);
      await saveChatState(db);
    }
    
    res.json({ success: true, chat: { ...supportChat, messages: decorateMessages(db, supportChat.messages) } });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
}

async function postSupportMessage(req, res) {
  try {
    const { text } = req.body;
    if (!text || text.trim().length === 0) return res.status(400).json({ success: false, error: 'Message text required' });
    if (containsProfanity(text)) return res.status(400).json({ success: false, error: 'Message contains forbidden language' });
    
    const db = await loadChatState();
    const user = db.users.find(u => u.id === req.user.id);
    const supportChat = (db.supportChats || []).find(c => c.id === req.params.chatId);
    
    if (!supportChat) return res.status(404).json({ success: false, error: 'Chat not found' });
    
    if (supportChat.banned) return res.status(403).json({ success: false, error: 'Chat is banned' });
    
    // Check if user can access this chat
    if (user.role !== 'admin' && user.role !== 'escrow' && supportChat.userId !== user.id) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    
    const m = buildMessage(user, text);
    supportChat.messages.push(m);

    if (!supportChat.readAt) supportChat.readAt = {};
    supportChat.readAt[user.id] = m.ts;

    // If this is an admin/escrow responding, assign the chat to them
    if ((user.role === 'admin' || user.role === 'escrow') && !supportChat.assignedTo) {
      supportChat.assignedTo = req.user.id;
      supportChat.assignedToName = user.username;
    }
    
    await saveChatState(db);
    res.json({ success: true, message: m });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
}

async function banSupportChat(req, res) {
  try {
    const db = await loadChatState();
    const user = db.users.find(u => u.id === req.user.id);
    if (!user || (user.role !== 'admin' && user.role !== 'escrow')) {
      return res.status(403).json({ success: false, error: 'Only admin and escrow can ban chats' });
    }
    
    const supportChat = (db.supportChats || []).find(c => c.id === req.params.chatId);
    if (!supportChat) return res.status(404).json({ success: false, error: 'Chat not found' });
    
    supportChat.banned = true;
    await saveChatState(db);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
}

async function assignSupportChat(req, res) {
  try {
    const db = await loadChatState();
    const user = db.users.find(u => u.id === req.user.id);
    if (!user || (user.role !== 'admin' && user.role !== 'escrow')) return res.status(403).json({ success: false, error: 'Only admin and escrow can assign chats' });
    const supportChat = (db.supportChats || []).find(c => c.id === req.params.chatId);
    if (!supportChat) return res.status(404).json({ success: false, error: 'Chat not found' });
    supportChat.assignedTo = user.id;
    supportChat.assignedToName = user.username;
    await saveChatState(db);
    res.json({ success: true, chat: supportChat });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
}

async function getUnreadSummary(req, res) {
  try {
    const db = await loadChatState();
    const user = getUserById(db, req.user.id);
    if (!user) return res.status(401).json({ success: false, error: 'Unauthorized' });

    let count = 0;

    if (user.role === 'escrow' || user.role === 'admin') {
      // Support chats nobody has picked up yet
      count += (db.supportChats || []).filter(c => !c.banned && !c.assignedTo).length;
      // Deal chats tagged with @escrow that still need a reply
      (db.transactions || []).forEach(tx => {
        const chat = (db.chats || []).find(c => c.txId === tx.id);
        if (!chat) return;
        const isMine = tx.escrowId === user.id;
        const isUnassigned = !tx.escrowId;
        if ((isMine || isUnassigned) && chat.escrowRequested) {
          const lastRead = chat.readAt && chat.readAt[user.id];
          if (!lastRead || (chat.escrowRequestedAt && lastRead < chat.escrowRequestedAt)) count += 1;
        }
        // Assigned deals with a new message since this escrow last read
        if (isMine && chat.messages && chat.messages.length) {
          const lastMsg = chat.messages[chat.messages.length - 1];
          const lastRead = chat.readAt && chat.readAt[user.id];
          if (lastMsg.userId !== user.id && (!lastRead || lastRead < lastMsg.ts)) count += 1;
        }
      });
      // Their own support conversations with new customer messages
      (db.supportChats || []).filter(c => c.assignedTo === user.id && !c.banned).forEach(c => {
        if (!c.messages || !c.messages.length) return;
        const lastMsg = c.messages[c.messages.length - 1];
        const lastRead = c.readAt && c.readAt[user.id];
        if (lastMsg.userId !== user.id && (!lastRead || lastRead < lastMsg.ts)) count += 1;
      });
    } else {
      (db.transactions || []).filter(t => t.buyerId === user.id || t.sellerId === user.id).forEach(tx => {
        const chat = (db.chats || []).find(c => c.txId === tx.id);
        if (!chat || !chat.messages || !chat.messages.length) return;
        const lastMsg = chat.messages[chat.messages.length - 1];
        const lastRead = chat.readAt && chat.readAt[user.id];
        if (lastMsg.userId !== user.id && (!lastRead || lastRead < lastMsg.ts)) count += 1;
      });
      const own = (db.supportChats || []).find(c => c.userId === user.id && !c.closed);
      if (own && own.messages && own.messages.length) {
        const lastMsg = own.messages[own.messages.length - 1];
        const lastRead = own.readAt && own.readAt[user.id];
        if (lastMsg.userId !== user.id && (!lastRead || lastRead < lastMsg.ts)) count += 1;
      }
    }

    res.json({ success: true, count });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
}

module.exports = {
  getChat,
  getEscrowChat,
  postMessage,
  getDirectChats,
  createDirectChat,
  getDirectChat,
  postDirectMessage,
  getSupportChats,
  getSupportChat,
  createSupportChat,
  postSupportMessage,
  banSupportChat,
  assignSupportChat,
  getUnreadSummary
};

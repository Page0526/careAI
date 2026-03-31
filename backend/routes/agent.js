/**
 * Agent Chat API Routes
 */
const express = require('express');
const router = express.Router();
const { route, sendJson } = require('../lib/http');
const { handleAgentChat } = require('../services/agent-service');

// POST /api/agent/chat
router.post('/chat', route(async (req, res) => {
  sendJson(res, await handleAgentChat(req.body));
}));

module.exports = router;

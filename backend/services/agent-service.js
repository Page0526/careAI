const { processMessage } = require('../agent/agent-core');
const { badRequest } = require('../lib/http');

async function handleAgentChat(payload = {}) {
  const message = typeof payload.message === 'string' ? payload.message.trim() : '';
  if (!message) {
    throw badRequest('Message is required');
  }

  const patientId = payload.patient_id ? Number.parseInt(payload.patient_id, 10) : null;
  const conversationHistory = Array.isArray(payload.conversation_history) ? payload.conversation_history : [];

  const result = await processMessage(
    message,
    Number.isInteger(patientId) ? patientId : null,
    conversationHistory
  );

  return {
    response: result.response,
    mode: result.mode,
    patient: result.patient,
    intent: result.intent,
    timestamp: new Date().toISOString(),
  };
}

module.exports = { handleAgentChat };
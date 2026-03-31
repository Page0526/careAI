function safeParseJson(value, fallback = null) {
  if (value === undefined || value === null) {
    return fallback;
  }

  if (typeof value !== 'string') {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

module.exports = { safeParseJson };

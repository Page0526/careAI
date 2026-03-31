/**
 * Dashboard API Routes
 */
const express = require('express');
const router = express.Router();
const { parsePositiveInt, route, sendJson } = require('../lib/http');
const { getDashboardStats, getRecentAlerts } = require('../services/dashboard-service');

// GET /api/dashboard/stats
router.get('/stats', route((req, res) => {
  sendJson(res, getDashboardStats());
}));

// GET /api/dashboard/recent-alerts
router.get('/recent-alerts', route((req, res) => {
  const limit = parsePositiveInt(req.query.limit, { field: 'limit', defaultValue: 20 });
  sendJson(res, { alerts: getRecentAlerts(limit) });
}));

module.exports = router;

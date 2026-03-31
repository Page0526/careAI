const express = require('express');

const router = express.Router();

router.use('/dashboard', require('./dashboard'));
router.use('/patients', require('./patients'));
router.use('/validation', require('./validation'));
router.use('/fhir', require('./fhir'));
router.use('/agent', require('./agent'));
router.use('/medical-record', require('./medical-record'));

module.exports = router;
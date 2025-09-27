const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const UnknownPersonReport = require('../models/UnknownPersonReport');

// @route   POST api/report/unknown-person
// @desc    Report an unknown person sighting
// @access  Private
router.post('/unknown-person', auth, async (req, res) => {
  try {
    const { photoURL, location, dateTime, description } = req.body;
    
    // Validate input
    if (!photoURL) {
      return res.status(400).json({ message: 'Photo is required' });
    }
    
    if (!location) {
      return res.status(400).json({ message: 'Location is required' });
    }
    
    // Create new report
    const newReport = new UnknownPersonReport({
      user: req.user.id,
      photoURL,
      location,
      dateTime: dateTime || Date.now(),
      description,
      status: 'pending'
    });
    
    // Save report to database
    const savedReport = await newReport.save();
    
    // Process image for facial recognition (this would be implemented separately)
    // This could trigger a background job to compare the image against missing persons database
    
    res.status(201).json({
      success: true,
      report: savedReport,
      message: 'Sighting reported successfully'
    });
    
  } catch (error) {
    console.error('Error reporting unknown person:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET api/report/unknown-person
// @desc    Get all unknown person reports for a user
// @access  Private
router.get('/unknown-person', auth, async (req, res) => {
  try {
    const reports = await UnknownPersonReport.find({ user: req.user.id })
      .sort({ dateTime: -1 });
    
    res.json(reports);
  } catch (error) {
    console.error('Error fetching reports:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET api/report/unknown-person/:id
// @desc    Get a specific unknown person report
// @access  Private
router.get('/unknown-person/:id', auth, async (req, res) => {
  try {
    const report = await UnknownPersonReport.findById(req.params.id);
    
    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }
    
    // Check if user owns the report or is an admin
    if (report.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to access this report' });
    }
    
    res.json(report);
  } catch (error) {
    console.error('Error fetching report:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   PUT api/report/unknown-person/:id
// @desc    Update a report status (for admins/police)
// @access  Private (Admin/Police)
router.put('/unknown-person/:id', auth, async (req, res) => {
  try {
    // Check if user is admin or police
    if (req.user.role !== 'admin' && req.user.role !== 'police') {
      return res.status(403).json({ message: 'Not authorized to update report status' });
    }
    
    const { status, notes } = req.body;
    
    const report = await UnknownPersonReport.findById(req.params.id);
    
    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }
    
    // Update report
    if (status) report.status = status;
    if (notes) report.adminNotes = notes;
    
    // Add status update history
    report.statusHistory.push({
      status: status || report.status,
      updatedBy: req.user.id,
      notes,
      timestamp: Date.now()
    });
    
    const updatedReport = await report.save();
    
    res.json({
      success: true,
      report: updatedReport,
      message: 'Report updated successfully'
    });
    
  } catch (error) {
    console.error('Error updating report:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
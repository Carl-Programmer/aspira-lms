const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const auth = require('../middleware/auth');
const Course = require('../models/Course');

// ===== Get attendance list for a course =====
router.get('/:courseId', auth, async (req, res) => {
  try {
    const course = await Course.findById(req.params.courseId)
      .populate('attendance.records.student', 'firstname lastname email');

    if (!course) return res.status(404).json({ msg: 'Course not found' });

    res.json(course.attendance || []);
  } catch (err) {
    console.error('❌ Error fetching attendance:', err);
    res.status(500).json({ msg: 'Server error while fetching attendance' });
  }
});

// ===== Mark attendance for a course =====
router.post('/:courseId/mark', auth, async (req, res) => {
  try {
    const { date, records } = req.body;
    const course = await Course.findById(req.params.courseId);
    if (!course) return res.status(404).json({ msg: 'Course not found' });

    if (!course.attendance) course.attendance = [];

    // ✅ Filter invalid or missing student ObjectIds to prevent blank names
    // ✅ Normalize structure: convert studentId → student, ensure valid ObjectIds
    const validRecords = (records || [])
      .filter(r => (r.student || r.studentId) && mongoose.Types.ObjectId.isValid(r.student || r.studentId))
      .map(r => ({
        student: r.student || r.studentId,   // normalize field name
        status: r.status || 'Absent'
      }));

    // ✅ Match attendance by same date
    const sameDay = course.attendance.find(
      (a) => new Date(a.date).toDateString() === new Date(date).toDateString()
    );

    if (sameDay) {
      sameDay.records = validRecords;
    } else {
      course.attendance.push({ date, records: validRecords });
    }

    await course.save();

    console.log('🟢 Attendance saved for:', date);
    console.log('📦 Stored records:', course.attendance.map(a => ({
      date: a.date,
      records: a.records.length
    })));

    // ✅ Re-fetch with populated student names
    const updatedCourse = await Course.findById(req.params.courseId)
      .populate('attendance.records.student', 'firstname lastname email');

    res.json({
      msg: '✅ Attendance saved successfully',
      attendance: updatedCourse.attendance,
    });
  } catch (err) {
    console.error('❌ Error marking attendance:', err);
    res.status(500).json({ msg: 'Server error while marking attendance' });
  }
});

// ===== Recover a previous attendance session by date =====
router.post('/:courseId/recover', auth, async (req, res) => {
  try {
    const { date } = req.body;
    const course = await Course.findById(req.params.courseId)
      .populate('attendance.records.student', 'firstname lastname email');

    if (!course) return res.status(404).json({ msg: 'Course not found' });
    if (!date) return res.status(400).json({ msg: 'Date required to recover attendance' });

    console.log('📅 Requested recover date:', date);
    console.log('📦 Stored attendance dates:', course.attendance.map(a => a.date));

    // ✅ Compare using UTC day/month/year (timezone-safe)
    const target = new Date(date);
    const record = course.attendance.find(a => {
      const stored = new Date(a.date);
      const match =
        stored.getUTCFullYear() === target.getUTCFullYear() &&
        stored.getUTCMonth() === target.getUTCMonth() &&
        stored.getUTCDate() === target.getUTCDate();
      if (match) console.log('✅ Matched record:', stored);
      return match;
    });

    if (!record) {
      console.log('❌ No record matched.');
      return res.status(404).json({ msg: 'No attendance record found for that date' });
    }

    res.json({
      msg: '✅ Attendance recovered successfully',
      record,
    });
  } catch (err) {
    console.error('❌ Error recovering attendance:', err);
    res.status(500).json({ msg: 'Server error while recovering attendance' });
  }
});


module.exports = router;


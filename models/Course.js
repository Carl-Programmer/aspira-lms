const mongoose = require('mongoose');

// ✅ Content uploaded by teacher
const ContentSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  file: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// ✅ Student submission (for activities, quizzes, etc.)
const SubmissionSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  file: {
    type: String,
    required: true
  },
  notes: {
    type: String,
    default: ''
  },
  grade: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['Submitted', 'Under Review', 'Graded'],
    default: 'Submitted'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// ✅ Attendance per course
const AttendanceSchema = new mongoose.Schema({
  date: { type: Date, default: Date.now },
  records: [
    {
      student: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      status: {
        type: String,
        enum: ['Present', 'Absent', 'Late', 'Excused'],
        default: 'Absent'
      }
    }
  ]
});

// ✅ Main Course Schema
const CourseSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  teacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  contents: [ContentSchema],
  students: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  ],
  submissions: [SubmissionSchema],
  attendance: [AttendanceSchema], // ✅ Properly nested inside schema
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Course', CourseSchema);

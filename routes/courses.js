const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Course = require('../models/Course');
const User = require('../models/User');
const multer = require('multer');
const path = require('path');

// ==== File Upload Setup ====
const contentStorage = multer.diskStorage({
  destination: (r, f, cb) => cb(null, './uploads/contents/'),
  filename: (r, f, cb) => cb(null, Date.now() + path.extname(f.originalname))
});

const submissionStorage = multer.diskStorage({
  destination: (r, f, cb) => cb(null, './uploads/submissions/'),
  filename: (r, f, cb) => cb(null, Date.now() + path.extname(f.originalname))
});

const uploadContent = multer({ storage: contentStorage });
const uploadSubmission = multer({ storage: submissionStorage });

// ===== Helper: check if admin or teacher =====
function canManage(user) {
  return user.role === 'teacher' || user.role === 'admin';
}

// ✅ Create a course (admin or teacher)
router.post('/', auth, async (req, res) => {
  try {
    if (!canManage(req.user))
      return res.status(403).json({ msg: 'Forbidden' });

    const { title, description, teacher } = req.body;
    if (!title) return res.status(400).json({ msg: 'Title required' });

    let teacherId = req.user._id;

    // ✅ Allow admin to assign any teacher
    if (req.user.role === 'admin' && teacher) {
      const teacherUser = await User.findById(teacher);
      if (!teacherUser || teacherUser.role !== 'teacher') {
        return res.status(400).json({ msg: 'Invalid teacher ID' });
      }
      teacherId = teacherUser._id;
    }

    const course = new Course({
      title,
      description,
      teacher: teacherId
    });

    await course.save();
    const populated = await Course.findById(course._id)
      .populate('teacher', 'firstname lastname');
    res.json(populated);
  } catch (err) {
    console.error('❌ Error creating course:', err);
    res.status(500).json({ msg: 'Server error while creating course' });
  }
});


// ✅ List courses (role-based visibility)
router.get('/', auth, async (req, res) => {
  try {
    let filter = {};

    // 🧑‍🏫 Teacher → show only their own courses
    if (req.user.role === 'teacher') {
      filter = { teacher: req.user._id };
    }

    // 🧑‍🎓 Student → show only courses where they are enrolled
    else if (req.user.role === 'student') {
      filter = { students: req.user._id };
    }

    // 🧑‍💼 Admin → can see all
    const courses = await Course.find(filter)
      .populate('teacher', 'firstname lastname')
      .populate('students', 'firstname lastname');

    res.json(courses);
  } catch (err) {
    console.error('❌ Error fetching courses:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// ✅ Add student to course (admin or teacher)
router.post('/:id/add-student', auth, async (req, res) => {
  try {
    if (!canManage(req.user))
      return res.status(403).json({ msg: 'Forbidden' });

    const course = await Course.findById(req.params.id);
    if (!course) return res.status(404).json({ msg: 'Course not found' });

    const studentId = req.body.studentId;
    if (!course.students.includes(studentId)) {
      course.students.push(studentId);
      await course.save();
    }

    res.json(course);
  } catch (err) {
    console.error('❌ Error adding student:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// ✅ Upload content (admin or teacher)
router.post('/upload-content', auth, uploadContent.single('file'), async (req, res) => {
  try {
    if (!canManage(req.user))
      return res.status(403).json({ msg: 'Forbidden' });

    const { courseId, title } = req.body;
    const course = await Course.findById(courseId);
    if (!course) return res.status(404).json({ msg: 'Course not found' });

    if (!req.file) return res.status(400).json({ msg: 'No file uploaded' });

    const newContent = {
      title: title && title.trim() !== '' ? title : req.file.originalname,
      file: req.file.filename,
      createdAt: new Date()
    };

    course.contents.push(newContent);
    await course.save();

    res.json({ msg: 'File uploaded successfully', content: newContent });
  } catch (err) {
    console.error('❌ Upload failed:', err);
    res.status(500).json({ msg: 'Server error during upload' });
  }
});

// ✅ Upload content directly to course ID
router.post('/:id/upload-content', auth, uploadContent.single('file'), async (req, res) => {
  try {
    if (!canManage(req.user))
      return res.status(403).json({ msg: 'Forbidden' });

    const course = await Course.findById(req.params.id);
    if (!course)
      return res.status(404).json({ msg: 'Course not found' });

    if (!req.file)
      return res.status(400).json({ msg: 'No file uploaded' });

    const title = req.body.title && req.body.title.trim() !== ''
      ? req.body.title
      : req.file.originalname;

    const newContent = {
      title,
      file: '/uploads/contents/' + req.file.filename,
      createdAt: new Date()
    };

    course.contents.push(newContent);
    await course.save();

    res.json({ msg: 'Content uploaded successfully', content: newContent });
  } catch (err) {
    console.error('❌ Upload failed:', err);
    res.status(500).json({ msg: 'Server error during upload' });
  }
});

// ✅ Student submit assignment
router.post('/:id/submit', auth, uploadSubmission.single('file'), async (req, res) => {
  try {
    if (req.user.role !== 'student')
      return res.status(403).json({ msg: 'Only students can submit' });

    const course = await Course.findById(req.params.id);
    if (!course) return res.status(404).json({ msg: 'Course not found' });

    course.submissions.push({
      student: req.user._id,
      file: '/uploads/submissions/' + req.file.filename,
      notes: req.body.notes || ''
    });

    await course.save();
    res.json({ msg: 'Submitted' });
  } catch (err) {
    console.error('❌ Submit failed:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// ✅ Teacher/Admin: List submissions
router.get('/:id/submissions', auth, async (req, res) => {
  try {
    if (!canManage(req.user))
      return res.status(403).json({ msg: 'Forbidden' });

    const course = await Course.findById(req.params.id)
      .populate('submissions.student', 'firstname lastname email');
    if (!course) return res.status(404).json({ msg: 'Not found' });

    res.json(course.submissions);
  } catch (err) {
    console.error('❌ Error listing submissions:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});


// ✅ Update course (admin or teacher)
router.put('/:id', auth, async (req, res) => {
  try {
    if (!canManage(req.user))
      return res.status(403).json({ msg: 'Forbidden' });

    const { title, description, teacher } = req.body;
    const course = await Course.findById(req.params.id);
    if (!course) return res.status(404).json({ msg: 'Course not found' });

    // Allow title and description edits
    course.title = title || course.title;
    course.description = description || course.description;

    // ✅ Allow admin to reassign teacher
    if (req.user.role === 'admin' && teacher) {
      const teacherUser = await User.findById(teacher);
      if (!teacherUser || teacherUser.role !== 'teacher') {
        return res.status(400).json({ msg: 'Invalid teacher ID' });
      }
      course.teacher = teacherUser._id;
    }

    await course.save();
    const populated = await Course.findById(course._id)
      .populate('teacher', 'firstname lastname');
    res.json({ msg: 'Course updated successfully', course: populated });
  } catch (err) {
    console.error('❌ Error updating course:', err);
    res.status(500).json({ msg: 'Server error while updating course' });
  }
});


// ✅ Delete course (admin or teacher)
router.delete('/:id', auth, async (req, res) => {
  try {
    if (!canManage(req.user))
      return res.status(403).json({ msg: 'Forbidden' });

    const course = await Course.findByIdAndDelete(req.params.id);
    if (!course) return res.status(404).json({ msg: 'Course not found' });

    res.json({ msg: 'Course deleted successfully' });
  } catch (err) {
    console.error('❌ Error deleting course:', err);
    res.status(500).json({ msg: 'Server error while deleting course' });
  }
});

// ===== COURSE CONTENT MANAGEMENT =====

// Upload new content (Admin/Teacher)
router.post('/:id/content', auth, uploadContent.single('file'), async (req, res) => {
  try {
    if (!canManage(req.user)) return res.status(403).json({ msg: 'Forbidden' });

    const course = await Course.findById(req.params.id);
    if (!course) return res.status(404).json({ msg: 'Course not found' });

    if (!req.file) return res.status(400).json({ msg: 'No file uploaded' });

    const content = {
      title: req.body.title && req.body.title.trim() !== '' ? req.body.title : req.file.originalname,
      file: '/uploads/contents/' + req.file.filename, // ✅ use correct upload path
      createdAt: new Date()
    };

    course.contents.push(content);
    await course.save();

    res.json({ msg: 'Content added successfully', content });
  } catch (err) {
    console.error('❌ Error uploading content:', err);
    res.status(500).json({ msg: 'Server error while uploading content' });
  }
});


// Delete content
router.delete('/:id/content/:contentId', auth, async (req, res) => {
  try {
    if (!canManage(req.user)) return res.status(403).json({ msg: 'Forbidden' });
    const course = await Course.findById(req.params.id);
    if (!course) return res.status(404).json({ msg: 'Course not found' });

    course.contents = course.contents.filter(c => c._id.toString() !== req.params.contentId);
    await course.save();
    res.json({ msg: 'Content deleted' });
  } catch (err) {
    console.error('Error deleting content:', err);
    res.status(500).json({ msg: 'Server error while deleting content' });
  }
});


// ===== Update grade for a submission =====
router.put('/:id/grade/:submissionId', auth, async (req, res) => {
  try {
    if (!['teacher', 'admin'].includes(req.user.role))
      return res.status(403).json({ msg: 'Forbidden' });

    const { grade } = req.body;
    const { id, submissionId } = req.params;

    const course = await Course.findById(id);
    if (!course) return res.status(404).json({ msg: 'Course not found' });

    const submission = course.submissions.id(submissionId);
    if (!submission) return res.status(404).json({ msg: 'Submission not found' });

    submission.grade = grade;
    submission.status = 'Graded';
    await course.save();

    res.json({ msg: '✅ Grade updated successfully', submission });
  } catch (err) {
    console.error('❌ Error grading submission:', err);
    res.status(500).json({ msg: 'Server error while grading' });
  }
});

// ✅ Supports frontend PATCH route style
router.patch('/:courseId/submissions/:submissionId/grade', auth, async (req, res) => {
  try {
    if (!['teacher', 'admin'].includes(req.user.role))
      return res.status(403).json({ msg: 'Forbidden' });

    const { grade } = req.body;
    const { courseId, submissionId } = req.params;

    const course = await Course.findById(courseId);
    if (!course) return res.status(404).json({ msg: 'Course not found' });

    const submission = course.submissions.id(submissionId);
    if (!submission) return res.status(404).json({ msg: 'Submission not found' });

    submission.grade = grade;
    submission.status = 'Graded';
    await course.save();

    res.json({ msg: '✅ Grade updated successfully', submission });
  } catch (err) {
    console.error('❌ Error grading submission (PATCH):', err);
    res.status(500).json({ msg: 'Server error while grading' });
  }
});

// ✅ Student: Get only their own submissions for a course (must be BEFORE /:id)
router.get('/:id/my-submission', auth, async (req, res) => {
  try {
    if (req.user.role !== 'student')
      return res.status(403).json({ msg: 'Forbidden' });

    const course = await Course.findById(req.params.id).populate({
      path: 'submissions.student',
      select: 'firstname lastname email',
    });

    if (!course) return res.status(404).json({ msg: 'Course not found' });

    const mySubs = course.submissions.filter(
      (s) => s.student && s.student._id.toString() === req.user._id.toString()
    );

    res.json(mySubs);
  } catch (err) {
    console.error('❌ Error fetching my submissions:', err);
    res.status(500).json({ msg: 'Server error while fetching submissions' });
  }
});

// ✅ Teacher/Admin: List submissions (keep this ABOVE /:id)
router.get('/:id/submissions', auth, async (req, res) => {
  try {
    if (!['teacher', 'admin'].includes(req.user.role))
      return res.status(403).json({ msg: 'Forbidden' });

    const course = await Course.findById(req.params.id)
      .populate('submissions.student', 'firstname lastname email');

    if (!course) return res.status(404).json({ msg: 'Course not found' });

    const submissions = course.submissions.map((s) => ({
      _id: s._id,
      student: s.student
        ? {
            _id: s.student._id,
            firstname: s.student.firstname,
            lastname: s.student.lastname,
            email: s.student.email,
          }
        : null,
      file: s.file,
      notes: s.notes,
      grade: s.grade || '',
      status: s.status,
      createdAt: s.createdAt,
    }));

    res.json(submissions);
  } catch (err) {
    console.error('❌ Error listing submissions:', err);
    res.status(500).json({ msg: 'Server error while listing submissions' });
  }
});

// ✅ Get single course (this goes LAST!)
router.get('/:id', auth, async (req, res) => {
  try {
    const course = await Course.findById(req.params.id)
      .populate('teacher', 'firstname lastname')
      .populate('students', 'firstname lastname email');
    if (!course) return res.status(404).json({ msg: 'Course not found' });

    res.json(course);
  } catch (err) {
    console.error('❌ Error fetching course details:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});


module.exports = router;

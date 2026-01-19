const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Announcement = require('../models/Announcement');
const User = require('../models/User');

router.get('/', auth, async (req,res)=>{
  const anns = await Announcement.find().populate('author','firstname lastname').sort({createdAt:-1});
  res.json(anns);
});

router.post('/', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'teacher')
      return res.status(403).json({ msg: 'Forbidden' });

    const { title, body, message } = req.body;
    if (!title) return res.status(400).json({ msg: 'Title required' });

    const ann = new Announcement({
      title,
      message: body || message || '', // ✅ handle either field
      author: req.user._id
    });

    await ann.save();
    res.json({ msg: 'Announcement added successfully', ann });
  } catch (err) {
    console.error('❌ Error creating announcement:', err);
    res.status(500).json({ msg: 'Server error while creating announcement' });
  }
});


// ✅ Update announcement (admin or teacher)
router.put('/:id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'teacher')
      return res.status(403).json({ msg: 'Forbidden' });

    const { title, body, message } = req.body;
    const ann = await Announcement.findById(req.params.id);
    if (!ann) return res.status(404).json({ msg: 'Announcement not found' });

    ann.title = title || ann.title;
    ann.message = body || message || ann.message;

    await ann.save();
    res.json({ msg: 'Announcement updated successfully', ann });
  } catch (err) {
    console.error('❌ Error updating announcement:', err);
    res.status(500).json({ msg: 'Server error while updating announcement' });
  }
});


// ✅ Delete announcement (admin or teacher)
router.delete('/:id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'teacher')
      return res.status(403).json({ msg: 'Forbidden' });

    const ann = await Announcement.findByIdAndDelete(req.params.id);
    if (!ann) return res.status(404).json({ msg: 'Announcement not found' });

    res.json({ msg: 'Announcement deleted successfully' });
  } catch (err) {
    console.error('❌ Error deleting announcement:', err);
    res.status(500).json({ msg: 'Server error while deleting announcement' });
  }
});


module.exports = router;

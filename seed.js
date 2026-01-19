require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const User = require('./models/User');
const Course = require('./models/Course');
const Announcement = require('./models/Announcement');

async function seed(){
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/aspira_lms', {useNewUrlParser:true, useUnifiedTopology:true});
  // admin
  let admin = await User.findOne({email:'admin@aspira.edu'});
  if(!admin){
    const hash = await bcrypt.hash('AdminPass123', 10);
    admin = new User({firstname:'Super', lastname:'Admin', email:'admin@aspira.edu', password:hash, role:'admin'});
    await admin.save();
    console.log('Admin created: admin@aspira.edu / AdminPass123');
  }
  // teacher
  let teacher = await User.findOne({email:'prof.jane@aspira.edu'});
  if(!teacher){
    const hash = await bcrypt.hash('TeacherPass123', 10);
    teacher = new User({firstname:'Jane', lastname:'Professor', email:'prof.jane@aspira.edu', password:hash, role:'teacher'});
    await teacher.save();
    console.log('Teacher created: prof.jane@aspira.edu / TeacherPass123');
  }
  // students
  let s1 = await User.findOne({email:'student1@aspira.edu'});
  if(!s1){
    const hash = await bcrypt.hash('Student123', 10);
    s1 = new User({firstname:'Student', lastname:'One', email:'student1@aspira.edu', password:hash, role:'student'});
    await s1.save();
    console.log('Student1 created: student1@aspira.edu / Student123');
  }
  let s2 = await User.findOne({email:'student2@aspira.edu'});
  if(!s2){
    const hash = await bcrypt.hash('Student123', 10);
    s2 = new User({firstname:'Student', lastname:'Two', email:'student2@aspira.edu', password:hash, role:'student'});
    await s2.save();
    console.log('Student2 created: student2@aspira.edu / Student123');
  }

  // courses
  let c1 = await Course.findOne({title:'Introduction to Programming'});
  if(!c1){
    c1 = new Course({title:'Introduction to Programming', description:'Learn programming basics', teacher: teacher._id, students: [s1._id, s2._id], contents: [{title:'Syllabus', file:'/uploads/contents/lecture1.pdf'}] });
    await c1.save();
    console.log('Course 1 created');
  }
  let c2 = await Course.findOne({title:'Foundations of Information Security'});
  if(!c2){
    c2 = new Course({title:'Foundations of Information Security', description:'Security fundamentals', teacher: teacher._id, students: [s1._id], contents: [{title:'Lecture 1', file:'/uploads/contents/lecture1.pdf'}] });
    await c2.save();
    console.log('Course 2 created');
  }

  // announcement
  let a = await Announcement.findOne({title:'Welcome to Aspira'});
  if(!a){
    a = new Announcement({title:'Welcome to Aspira', message:'Platform seeded with example data', author: teacher._id});
    await a.save();
    console.log('Announcement created');
  }

  mongoose.disconnect();
  console.log('Seeding complete');
}
seed().catch(e=>{console.error(e); process.exit(1);});

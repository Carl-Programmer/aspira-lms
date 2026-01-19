const mongoose = require('mongoose');
const AnnouncementSchema = new mongoose.Schema({
  title:String, message:String, author:{type:mongoose.Schema.Types.ObjectId, ref:'User'}, createdAt:{type:Date, default:Date.now}
});
module.exports = mongoose.model('Announcement', AnnouncementSchema);

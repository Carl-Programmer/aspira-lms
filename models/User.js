const mongoose = require('mongoose');
const UserSchema = new mongoose.Schema({
  firstname:{type:String, default:''},
  lastname:{type:String, default:''},
  email:{type:String, unique:true, required:true},
  password:{type:String, required:true},
  role:{type:String, enum:['admin','teacher','student'], default:'student'},
  profilePicture:{type:String, default:''},
  createdAt:{type:Date, default:Date.now},
  resetToken: { type: String },
  resetTokenExpire: { type: Date }

});
module.exports = mongoose.model('User', UserSchema);

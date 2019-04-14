
var mongoose = require("mongoose");
var passportLocalMongoose = require("passport-local-mongoose");

var userSchema = new mongoose.Schema({
    firstName:String,
    lastName:String,
    username:String,
    password:String,
    isAdmin:{type:Boolean, default:false},
    avatar: {
        url: { type: String, default: '/img/profilePic.jpeg' },
        public_id: String
    },
    email:String,
    notifications:[{
        type:mongoose.Schema.Types.ObjectId,
        ref:"Notification"
    }],
    followers:[{
        type:mongoose.Schema.Types.ObjectId,
        ref:"User"
    }],
    resetPasswordToken:String,
    resetPasswordExpires:Date,
});

userSchema.plugin(passportLocalMongoose,{
    usernameCaseInsensitive:true
});

module.exports = mongoose.model("User",userSchema);
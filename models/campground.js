var mongoose = require("mongoose");



var campgroundSchema = new mongoose.Schema({
    campName:String,
    images:[{ url:String, public_id:String}],
    image:String,
    cost:String,
    address:String,
    city:String,
    cash:String,
    paypal:String,
    knet:String,
    phone:String,
    campDescription:String,
    location:String,
    lat: Number,
    lng: Number,
    createdAt:{type:Date,default:Date.now},
    booking:{
        month:{type:String,default:"Month"},
        day:Number
    },
    likes:[
        {
            type:mongoose.Schema.Types.ObjectId,
            ref:"Review"
        }
    ],
    owner:{
        id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
         },
         username:String,
         firstName:String,
         lastName:String,
         avatar:String,
    },
    reviews:[
        {
            type: mongoose.Schema.Types.ObjectId,
            ref:"Review"
        }
    ],
    rating:{
        type:Number,
        default:0
    }
});

module.exports = mongoose.model("Campground",campgroundSchema);
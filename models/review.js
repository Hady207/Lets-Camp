var mongoose = require("mongoose");

var reviewSchema = new mongoose.Schema({
    rating: {
        // Setting the field type
        type: Number,
        required: "Please provide a rating (1-5 stars)",
        //defining min and max values
        min: 1,
        max: 5,
        //Adding validation to see if the entry is an integer
        validate: {
            //validator accepts a function definition which it uses for validation
            validator: Number.isInteger,
            message: "{VALUE} is not an integer value"
        }
    },
    likes_count:Number,
    title: String,
    body: String,
    likes:[
        {
            type:mongoose.Schema.Types.ObjectId,
            ref:"User"
        }
    ],
    
    //author id and fields
    author: {
        id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        },
        username: String,
        firstName: String,
        lastName: String,
        avatar: String,
    },
    //campground associated with the review
    campground: {
        id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Campground"
        },
        campName: String,
    }
},{timestamps: true,});

module.exports = mongoose.model("Review", reviewSchema);
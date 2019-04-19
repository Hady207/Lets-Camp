var express = require("express");
var router  = express.Router({mergeParams:true}); //allow to access req.params.id from the parent router
var Campground = require("../models/campground");
var Review = require("../models/review");
var User = require("../models/user");
var Notification = require("../models/notification");
var passport = require("passport");
var middleware = require("../middleware")

// Reviews New
router.get("/new",middleware.isLoggedIn,middleware.checkReviewExist,function(req,res){
    //find campground by id
    Campground.findById(req.params.id,function(err,campground){
        if(err){
            console.log(err);
        } else {
            res.render("reviews/new",{campground:campground});
        }
    }); 
});
// Reviews Create
router.post("/",middleware.isLoggedIn,middleware.checkReviewExist,function(req,res){
    Campground.findById(req.params.id).populate("reviews").exec(function(err,campground){
        if(err){
            req.flash("error",err.message);
            return res.redirect("back")
        }
        Review.create(req.body.review,function(err,review){
            if(err){
                req.flash("error","Something went wrong");
                console.log(err)
                return res.redirect("back")
            } 
                //add user information to review
                review.author.id = req.user._id;
                review.author.firstName = req.user.firstName;
                review.author.lastName = req.user.lastName;
                review.author.email   = req.user.username;
                review.author.avatar = req.user.avatar.url;
                review.campground.id = req.params.id;
                review.campground.campName = campground.campName;
                review.save();
                //connect new review to campground
                campground.reviews.push(review);
                // calculate the new average review for the campground
                campground.rating = calculateAverage(campground.reviews)
                //save the campground
                campground.save();
                req.flash("success","Successfully added review");
                //redirect campground show page
                res.redirect("/campgrounds/"+campground._id);
            
        });
        
    });
});

//Review Like Route
router.post("/:review_id/like",middleware.isLoggedIn,function(req,res){
    Review.findById(req.params.review_id,async function(err,foundReview){
        if(err){
            console.log(err);
            return res.redirect("/campgrounds/"+req.params.id);
        }
        // check if req.user.exists in foundCampground.likes
        var foundUserLike = foundReview.likes.some(function(like){
            return like.equals(req.user._id);
        });

        if(foundUserLike){
            //user already liked, removing like
            foundReview.likes.pull(req.user._id);
        } else {
            //adding the new user like
            foundReview.likes.push(req.user);
            let newNotification = {
                username: req.user.username,
                campgroundId: req.params.id,
                message:"Liked your Review"
            }
            //find the user and populate its followers array
            let user = await User.findById(req.user._id).populate('followers').exec();
            // create a new notifications and push it to the array
            for(const follower of user.followers) {
                let notification = await Notification.create(newNotification);
                follower.notifications.push(notification);
                follower.save();
              }
        }
        foundReview.save(function(err){
            if(err){
                console.log(err);
                return res.redirect("/campgrounds/"+req.params.id);
            }
            //add a like notification
            return res.redirect("/campgrounds/"+req.params.id);
        });
    });
});


// Reviews Edit
router.get("/:review_id/edit",middleware.checkAuthor,function(req,res){
    Review.findById(req.params.review_id,function(error,foundReview){
        if(error){
            req.flash("error",err.message)
            return res.redirect("back");
        } else{
            Campground.findById(req.params.id,function(err,foundCamp){
                res.render("reviews/edit",{review:foundReview,campground_id:req.params.id ,campground:foundCamp})
            })
        }
    });
});


// Reviews Update
router.put("/:review_id", middleware.checkAuthor, function (req, res) {
    Review.findByIdAndUpdate(req.params.review_id, req.body.review, {new: true}, function (err, updatedReview) {
        if (err) {
            req.flash("error", err.message);
            return res.redirect("back");
        }
        Campground.findById(req.params.id).populate("reviews").exec(function (err, campground) {
            if (err) {
                req.flash("error", err.message);
                return res.redirect("back");
            }
            // recalculate campground average
            campground.rating = calculateAverage(campground.reviews);
            //save changes
            campground.save();
            req.flash("success", "Your review was successfully edited.");
            res.redirect('/campgrounds/' + campground._id);
        });
    });
});

// Reviews Delete route
router.delete("/:review_id",middleware.checkAuthor,function(req,res){
    Review.findByIdAndDelete(req.params.review_id,function(err){
        if(err){
            req.flash("error","Deletion couldn't be compeleted")
            res.redirect("/campgrounds/"+req.params.id);
        }
        // find all the campgrounds and remove the reviews associated to it
        Campground.findByIdAndUpdate(req.params.id,{$pull:{reviews:req.params.review_id}},{new:true}).populate("review").exec(function(err,campground){
            if(err){
                req.flash("error",err.message);
                return res.redirect("back");
            }
            //recalculate campground average
            campground.rating = calculateAverage(campground.reviews);
            //save changes
            campground.save();
            req.flash("success","Review Deleted");
            res.redirect("/campgrounds/"+req.params.id);
        
        })
        
    })
})


// calculate the averages of the star rating 
function calculateAverage(reviews) {
    if (reviews.length === 0) {
        return 0;
    }
    var sum = 0;
    reviews.forEach(function (element) {
        sum += element.rating;
    });
    return sum / reviews.length;
}

module.exports = router;
var Campground = require("../models/campground");
var Review = require("../models/review");
var User = require("../models/user");

// all the middleware goes here
var middlewareObj = {};

middlewareObj.checkCampOwner = function (req, res, next) {
    //returns true or false using the passport method 
    if (req.isAuthenticated()) {
        Campground.findById(req.params.id, function (err, foundCamp) {
            if (err) {
                req.flash("error","Campground not found");
                res.redirect("back");
                //does the user own the camp or is admin
            } else if (foundCamp.owner.id.equals(req.user._id) || req.user.isAdmin) {
                next()
            } else {
                req.flash("error","You don't have permission to do that");
                res.redirect("back");
            }
        });
    } else {
        req.flash("error","You need to be logged in to do that");
        res.redirect("back")
    }
}


//Method for authoritation for reviews
middlewareObj.checkAuthor = function (req, res, next) {
    //returns true or false using the passport method 
    if (req.isAuthenticated()) {
        Review.findById(req.params.review_id, function (err, foundReview) {
            if (err) {
                res.redirect("back");
                //does the user own the camp
            } else if (foundReview.author.id.equals(req.user._id) || req.user.isAdmin) {
                next();
            } else {
                req.flash("error","You don't have permission to do that");
                res.redirect("back");
            }
        });
    } else {
        req.flash("error","You need to be logged in to do that");
        res.redirect("back")
    }
};

// for writing only one reivew
middlewareObj.checkReviewExist = function(req,res,next){
    if(req.isAuthenticated()){
        Campground.findById(req.params.id).populate("reviews").exec(function(err,foundCampground){
            if(err || !foundCampground){
                req.flash("error","Campground not found.");
                res.redirect("back");
            } else {
                //Check if req.user._id exists in found Camground reviews
                var foundUser = foundCampground.reviews.some(function(review){
                    return review.author.id.equals(req.user._id);
                });
                if(foundUser){
                    req.flash("error","You already wrote a review.");
                    return res.redirect("/campgrounds/"+foundCampground._id);
                }
                //if the reviews was not found, go to the next middleware
                next();
            }
        });
    } else {
        req.flash("error","You need to login first");
        res.redirect("back")
    }
}

middlewareObj.isLoggedIn = function(req,res,next){
    // if user is authenticated then go to the next function in the middleware chain
    if(req.isAuthenticated()){
        return next();
    }
    // otherwise disrupt the middleware chain, set the session property of redirectTo equal to the originalUrl from the request
    req.session.redirectTo = req.originalUrl;
    // flash an error message
    req.flash("error", "You need to be logged in to do that");
    // and redirect to /login where, once the user logs in, they will be redirected back to the previous page
    res.redirect("/login");
}

module.exports = middlewareObj
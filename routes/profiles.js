var express = require("express");
var router = express.Router();
var User = require("../models/user");
var Campground = require("../models/campground");
var Review = require("../models/review");
var Notification = require("../models/notification");
var middleware = require("../middleware");
var multer = require('multer');

// API CONFIG for Cloudnairy
var storage = multer.diskStorage({
    filename: function (req, file, callback) {
        callback(null, Date.now() + file.originalname);
    }
});

var imageFilter = function (req, file, cb) {
    // accept image files only
    if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/i)) {
        return cb(new Error('Only image files are allowed!'), false);
    }
    cb(null, true);
};

var upload = multer({
    storage: storage,
    fileFilter: imageFilter
})

var cloudinary = require('cloudinary');
cloudinary.config({
    cloud_name: 'himagecloud',
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

//routes 
// profile page route
router.get("/profile", function (req, res) {
    res.render("profilePage");
});

// get profile page
router.get("/profile/:id", function (req, res) {
    User.findById(req.params.id, function (err, foundUser) {
        if (err) {
            console.log(err);
        } else {
            Campground.find({
                "owner.id": foundUser._id
            }, function (err, foundCamp) {
                if (err) {
                    console.log(err);
                } else {
                    Review.find({
                        "author.id": foundUser._id
                    }, function (err, foundReview) {
                        if (err) {
                            console.log(err)
                        } else {
                            res.render("profiles/profilePage", {
                                user: foundUser,
                                campgrounds: foundCamp,
                                reviews: foundReview
                            });
                        }
                    });
                }
            });
        }
    });
});


// follow user route
router.get('/follow/:id', middleware.isLoggedIn, async function (req, res) {
    try {
        let user = await User.findById(req.params.id);
        // return a boolean value if the the user is in the followers array
        var foundUserfollow = user.followers.some(function (follow) {
            return follow.equals(req.user._id);
        });
        if (foundUserfollow) {
            // remove the user from the followers array
            user.followers.pull(req.user._id)
            req.flash('success', 'Successfully unfollowed ' + user.username + '!');
        } else {
            //add the user to the followers array
            user.followers.push(req.user._id);
            req.flash('success', 'Successfully followed ' + user.username + '!');
        }
        user.save();

        res.redirect('/users/' + req.currentUser._id);
    } catch (err) {
        req.flash('error', err.message);
        res.redirect('back');
    }
});

// View all notifications,
router.get('/notifications', middleware.isLoggedIn, async function (req, res) {
    try {
        let user = await User.findById(req.user._id).populate({
            path: 'notifications',
            options: { sort: {"_id": -1 }} // sort in descending order.
        }).exec();
        let allNotifications = user.notifications;
        res.render('notifications/index', {
            allNotifications
        });
    } catch (err) {
        req.flash('error', err.message);
        res.redirect('back');
    }
});

// handle notification
router.get('/notifications/:id', middleware.isLoggedIn, async function (req, res) {
    try {
        let notification = await Notification.findById(req.params.id);
        notification.isRead = true;
        notification.save();
        res.redirect(`/campgrounds/${notification.campgroundId}`);
    } catch (err) {
        req.flash('error', err.message);
        res.redirect('back');
    }
});

router.delete("/notifications/:id", middleware.isLoggedIn, async function (req, res) {
    //remove the notification from the user array and the model
    try {
        let notification = await Notification.findById(req.params.id)
        let user = await User.findById(req.user._id);
        var foundNotify = user.notifications.some(function (notify) {
            return notify.equals(notification._id);
        });
        if (foundNotify) {
            user.notifications.pull(notification._id);
        }
        user.save()
        notification.remove();
        res.redirect("/notifications")
    } catch (err) {
        req.flash('error', err.message);
        res.redirect('back');
    }
})

// Edit profile route

router.get("/profile/:id/edit", function (req, res) {
    User.findById(req.params.id, function (err, foundUser) {
        res.render("profiles/editProfile", {
            user: foundUser
        });
    });
});

// editing profile route
router.put("/profile/:id", upload.single('avatar'), async function (req, res) {
    //  user edit object
    var editUser = {
        username: req.body.username,
        firstName: req.body.firstname,
        lastName: req.body.lastname,
        email: req.body.email
    };
    // if there is a new picture to upload
    if (req.file) {
        if (req.user.avatar.public_id) {
            //remove the old picture from cloudnairy
            cloudinary.v2.uploader.destroy(req.user.avatar.public_id)
        }
        // add the new one to the object edit user object
        let avatar = await cloudinary.uploader.upload(req.file.path);
        editUser.avatar = {
            url: avatar.secure_url,
            public_id: avatar.public_id
        };
    }
    //update the user
    User.findByIdAndUpdate(req.params.id, editUser, function (err, updateUser) {
        if (err) {
            console.log(err);
            res.redirect("back");
        } else {
            updateUser.setPassword(req.body.password,function(err){
                if(err){
                    console.log(err)
                } else {
                    updateUser.resetPasswordToken = undefined;
                    updateUser.resetPasswordExpires = undefined;
                    updateUser.save();
                }
            })
            console.log(updateUser)
            res.redirect("/profile/" + req.params.id);
        }
    });
});



module.exports = router;
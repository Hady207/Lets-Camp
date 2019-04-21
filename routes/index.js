var express = require("express");
var router = express.Router();
var Campground = require("../models/campground");
var Review = require("../models/review");
var User = require("../models/user");
var nodemailer = require("nodemailer");
var async = require("async");
var crypto = require("crypto");
var passport = require("passport");
var multer = require("multer");

// API CONFIG for Cloudnairy
var storage = multer.diskStorage({
  filename: function(req, file, callback) {
    callback(null, Date.now() + file.originalname);
  }
});

var imageFilter = function(req, file, cb) {
  // accept image files only
  if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/i)) {
    return cb(new Error("Only image files are allowed!"), false);
  }
  cb(null, true);
};

var upload = multer({ storage: storage, fileFilter: imageFilter });

var cloudinary = require("cloudinary");
cloudinary.config({
  cloud_name: "himagecloud",
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});


// Routes 
//homepage
router.get("/", function(req, res) {
  Campground.find({rating:{$gte:4}}).sort({createdAt:-1}).exec(function(err,foundCamp){
    Review.findOne({likes:{$size:2}},function(err,likedReview){
      if(err){
        console.log(foundCamp)
        console.log(err)
        res.redirect("/campgrounds")
      }else{
        Review.find({}).sort({createdAt:-1}).exec(function(err,latestReview){
          Campground.find({}).sort({createdAt:-1}).exec(function(err,latestCamps){
            res.render("Homepage", { campground:foundCamp,campgrounds:latestCamps, review:likedReview, reviews:latestReview, page: "homepage" });  
          });
        });
      }
    });
  });
});

//show all the reviews in the DB in one page 
router.get("/reviews",function(req,res){
  Review.find({}).populate("likes").exec(function(err,foundreivew){
      if(err){
        console.log(err)
      } else {
        Campground.find({},function(err,campground){
          res.render("reviews/index",{reviews:foundreivew , campground:campground})
        });
      }
  });
});


//show register form
router.get("/register", function(req, res) {
  res.render("register");
});

//handle sign up logic
router.post("/register", upload.single("avatar"), async function(req, res) {
  try {
    //create a new user object.
    var newUser = {
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        username: req.body.username,
        email: req.body.email
    }
    if(req.file){
      let image =  await cloudinary.uploader.upload(req.file.path);
      newUser.avatar = {
        url: image.secure_url,
        public_id: image.public_id
      }
    }
    // check if the admin code equals the input form the new user
    let user = await User.register(new User(newUser), req.body.password);
    if(req.body.adminCode === process.env.ADMINCODE){
      user.isAdmin = true; // a new admin has been created.
      user.save();
    }
    passport.authenticate("local")(req, res, function() {
      req.flash("success","Welcome to Kuwait Campground " +user.firstName +" " +user.lastName);
      res.redirect("/campgrounds");
    });
  } catch (err) {
    console.log(err);
    return res.render("register", { error: err.message });
  }
});

  
//Show login form
router.get("/login", function(req, res) {
  res.render("login");
});


router.post("/login", function(req, res, next) {
  // run passport.authenticate method with local argument
  passport.authenticate("local", function(err, user) {
    // if there's an error then return call of next with err as argument
    if (err) {
      return next(err);
    }
    // if there isn't a user object then return out of function by redirecting to /login
    if (!user) {
      req.flash("error","you are not registered")
      return res.redirect("/login");
    }
    req.logIn(user, function(err) {
      // if there's an error then return next function call with err argument
      if (err) {
        return next(err);
      }
      //If you put the property on the session object then it is available in the next route even after a redirect.
      // otherwise if there's a redirectTo property on the session then set the redirectTo variable equal to it,
      // else set redirectTo var equal to /campgrounds (default url)
      var redirectTo = req.session.redirectTo ? req.session.redirectTo: "/campgrounds";
      // delete the redirectTo property from session, whether it exists or not
      delete req.session.redirectTo;
      req.flash(
        "success",
        "Welcome to Kuwait Campground " + user.firstName + " " + user.lastName
      );
      // redirect to whatever was stored inside of redirectTo variable (either previous page or /campgrounds)
      res.redirect(redirectTo);
    });
  })(req, res, next);
});

//logout route
router.get("/logout", function(req, res) {
  req.logout();
  req.flash("success", "Good bye");
  res.redirect("/");
});

//forgot password
router.get("/forgot", function(req, res) {
  res.render("forgot");
});

// forgot post route
router.post("/forgot", function(req, res, next) {
  async.waterfall(
    [
      function(done) {
        // create a hexdecimal token
        crypto.randomBytes(20, function(err, buf) {
          var token = buf.toString("hex");
          done(err, token);
        });
      },
      function(token, done) {
        // check if the user exist
        User.findOne({ email: req.body.email }, function(err, user) {
          if (!user) {
            req.flash("error", "No account with that email address exists.");
            return res.redirect("/forgot");
          }
          // change properties of the user
          user.resetPasswordToken = token;
          user.resetPasswordExpires = Date.now() + 3600000; // 1 hour

          // apply these changes and save it
          user.save(function(err) {
            done(err, token, user);
          });
        });
      },
      // a function that send an email to a user
      function(token, user, done) {
        var smtpTransport = nodemailer.createTransport({
          service: "Gmail",
          auth: {
            user: "hadimaher207@gmail.com",
            pass: process.env.GMAILPW
          },
          tls: {
            rejectUnauthorized: false
          }
        });
        var mailOptions = {
          to: user.email,
          from: "hadimaher207@gmail.com",
          subject: "LetsCamp Password Reset",
          text:
            "You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n" +
            "Please click on the following link, or paste this into your browser to complete the process:\n\n" +
            "http://" +
            req.headers.host +
            "/reset/" +
            token +
            "\n\n" +
            "If you did not request this, please ignore this email and your password will remain unchanged.\n"
        };
        smtpTransport.sendMail(mailOptions, function(err) {
          // confirmation for the deveolper that the email has been sent
          console.log("mail sent");
          req.flash(
            "success",
            "An e-mail has been sent to " +
              user.email +
              " with further instructions."
          );
          done(err, "done");
        });
      }
    ],
    function(err) {
      if (err) return next(err);
      res.redirect("/forgot");
    }
  );
});

// gets the new password form
router.get("/reset/:token", function(req, res) {
  User.findOne(
    {
      resetPasswordToken: req.params.token,
      resetPasswordExpires: { $gt: Date.now() }
    },
    function(err, user) {
      if (!user) {
        req.flash("error", "Password reset token is invalid or has expired.");
        return res.redirect("/forgot");
      }
      res.render("reset", { token: req.params.token });
    }
  );
});

//the route that changes the password
router.post("/reset/:token", function(req, res) {
  async.waterfall(
    [
      function(done) {
        User.findOne(
          {
            resetPasswordToken: req.params.token,
            resetPasswordExpires: { $gt: Date.now() }
          },
          function(err, user) {
            if (!user) {
              req.flash(
                "error",
                "Password reset token is invalid or has expired."
              );
              return res.redirect("back");
            }
            if (req.body.password === req.body.confirm) {
              user.setPassword(req.body.password, function(err) {
                user.resetPasswordToken = undefined;
                user.resetPasswordExpires = undefined;

                user.save(function(err) {
                  req.logIn(user, function(err) {
                    done(err, user);
                  });
                });
              });
            } else {
              req.flash("error", "Passwords do not match.");
              return res.redirect("back");
            }
          }
        );
      },
      function(user, done) {
        var smtpTransport = nodemailer.createTransport({
          service: "Gmail",
          auth: {
            user: "hadimaher207@gmail.com",
            pass: process.env.GMAILPW
          },
          tls: {
            rejectUnauthorized: false
          }
        });
        var mailOptions = {
          to: user.email,
          from: "hadimaher207@gmail.com",
          subject: "Your password has been changed",
          text:
            "Hello,\n\n" +
            "This is a confirmation that the password for your letsCamp account " +
            user.email +
            " has just been changed.\n"
        };
        smtpTransport.sendMail(mailOptions, function(err) {
          req.flash("success", "Success! Your password has been changed.");
          done(err);
        });
      }
    ],
    function(err) {
      res.redirect("/campgrounds");
    }
  );
});

module.exports = router;

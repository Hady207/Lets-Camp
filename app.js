// As early as possible in your application, require and configure dotenv.
require('dotenv').config()
var express = require("express"),
    app = express(),
    path   = require("path")
    bodyParser = require("body-parser"),
    flash     = require("connect-flash"),
    mongoose = require("mongoose"),
    Campground = require("./models/campground"),
    Review = require("./models/review"),
    User   = require("./models/user"),
    methodOverride = require("method-override"),
    passport = require("passport"),
    localStratgy =require("passport-local"),
    cookieParser = require('cookie-parser'),
    passportLocalMongoose = require("passport-local-mongoose");

// requiring routes 
var campgroundRoutes = require("./routes/campgrounds");
var reviewRoutes     = require("./routes/reviews");
var indexRoutes      = require("./routes/index");
var profileRoutes    = require("./routes/profiles");


//App Config
app.use(express.static(path.join(__dirname,"public")));
mongoose.set("useFindAndModify", false);
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({extended: true}));
app.use(methodOverride("_method"));
//mongodb+srv://hady:hady@cluster0-01fm4.mongodb.net/test?retryWrites=true
var url = "mongodb://localhost:27017/letsCamp_appv1"||process.env.LETCAMPDB;
mongoose.connect(process.env.LETCAMPDB, {useNewUrlParser: true});
app.use(flash());
app.use(cookieParser());

//PASSPORT CONFIGURATION
app.use(require("express-session")({
    secret: "In the Bleak Midwinter",
    resave:false,
    saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());
passport.use(new localStratgy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());
//app.use(flash());
//this will work in all routes
app.use(async function(req,res,next){
    res.locals.currentUser = req.user;
    if(req.user) {
        try {
          let user = await User.findById(req.user._id).populate('notifications', null, { isRead: false }).exec();
          res.locals.notifications = user.notifications.reverse();
        } catch(err) {
          console.log(err.message);
        }
       }
    
    res.locals.error = req.flash("error");
    res.locals.success = req.flash("success");
    res.locals.moment  = require("moment");
    next();
});

//Use the routes

app.use("/campgrounds",campgroundRoutes);
app.use("/campgrounds/:id/reviews",reviewRoutes);
app.use(indexRoutes);
app.use(profileRoutes);



// open the server
app.listen(3000, function () {
    console.log("Server has started");
});
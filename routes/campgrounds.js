var express = require("express");
var router = express.Router();
var Campground = require("../models/campground");
var Review = require("../models/review");
var Notification = require("../models/notification");
var nodemailer = require("nodemailer");
var User = require("../models/user");
var middleware = require("../middleware");
var NodeGeocoder = require('node-geocoder');
var multer = require('multer');

//API CONFIGS
// API for uploading images
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

//Using a npm package called geocoder
var options = {
    provider: 'google',
    httpAdapter: 'https',
    apiKey: process.env.GEOCODER_API_KEY,
    formatter: null
};

var geocoder = NodeGeocoder(options);

//Show - campgrounds on the DB
router.get("/", function (req, res) {
    if(req.query.search){
        //fuzzy search queries 
        const regex = new RegExp(escapeRegex(req.query.search), 'gi');
        const cost = req.query.cost;
        const rating =  req.query.rating;
        Campground.find({$or: [{"owner.username": regex,},{campName: regex,}, {cost:cost},{rating:rating}]}, function (err, allCampgrounds) {
            if (err) {
                console.log(err);
            } else {
                if(allCampgrounds.length < 1){
                    req.flash("error","no campground with the given name")
                    res.redirect("/campgrounds")
                }
                res.render("campgrounds/campgrounds", {
                    campgrounds: allCampgrounds,
                    page: "campgrounds"
                });
            }
        })
    } else {
        // console.log(req.query.cost)
        if(req.query.cost){
            Campground.find({cost:req.query.cost},function(err,foundcamp){
                if(foundcamp.length < 1){
                    req.flash("error","no campground with this cost")
                    res.redirect("/campgrounds")
                }
                res.render("campgrounds/campgrounds", {
                    campgrounds: foundcamp,
                    page: "campgrounds"
                }); 
            })
        }else if(req.query.rating){
            // console.log(req.query.rating)
            Campground.find({rating:req.query.rating},function(err,foundcamp){
                if(err){
                    if(foundcamp.length < 1){
                        req.flash("error","no campground with this rating")
                        res.redirect("/campgrounds")
                    }
                }
                res.render("campgrounds/campgrounds", {
                    campgrounds: foundcamp,
                    page: "campgrounds"
                }); 
            });
        } else if(req.query.city) {
            // console.log(req.query.city)
            Campground.find({city:req.query.city},function(err,foundcamp){
                if(err){
                    if(foundcamp.length < 1){
                        req.flash("error","no campground in this location")
                        res.redirect("/campgrounds")
                    }
                }
                res.render("campgrounds/campgrounds", {
                    campgrounds: foundcamp,
                    page: "campgrounds"
                }); 
            });
        }else{
        Campground.find({}).sort({createdAt:-1}).exec(function (err, allCampgrounds) {
            if (err) {
                console.log(err);
            } else {
                res.render("campgrounds/campgrounds", {
                    campgrounds: allCampgrounds,
                    page: "campgrounds"
                });
            }
        }); 
       }
    }
});

//New - show form to create new campground
router.get("/new", middleware.isLoggedIn, function (req, res) {

    res.render("campgrounds/new", {
        page: "add"
    });
})

//Create - add new campground to DB
router.post("/", middleware.isLoggedIn, upload.array('images',4), function (req, res) {
    //get data from form and add to campground database
    req.body.Camp.owner = {
        id: req.user._id,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        avatar: req.user.avatar,
        username: req.user.username,
        email:req.user.email
    }
    // adding the map information to the database
    geocoder.geocode(req.body.Camp.location,async function (err, data) {
        if (err || !data.length) {
            req.flash('error', 'Invalid address');
            return res.redirect('back');
        }
        var lat = data[0].latitude;
        var lng = data[0].longitude;
        var location = data[0].formattedAddress

        req.body.Camp.location = location
        req.body.Camp.lng = lng
        req.body.Camp.lat = lat

        req.body.Camp.images=[];
        for(const file of req.files) {
            let image = await cloudinary.v2.uploader.upload(file.path)
            req.body.Camp.images.push({
                url: image.secure_url,
                public_id: image.public_id
            })
          }
        req.body.Camp.image = req.body.Camp.images[0].url;
        try {
            let campground = await Campground.create(req.body.Camp);
            let user = await User.findById(req.user._id).populate('followers').exec();
            let newNotification = {
                username: req.user.username,
                campgroundId: campground.id,
                message:"created a new campground"
            }
            for(const follower of user.followers) {
                let notification = await Notification.create(newNotification);
                follower.notifications.push(notification);
                follower.save();
            }
        
            //redirect back to campgrounds page
            res.redirect(`/campgrounds/${campground.id}`);
            } catch(err) {
            req.flash('error', err.message);
            res.redirect('back');
            }
    });
});


//SHOW - show more info about one campground
router.get("/:id", function (req, res) {
    //find the campground with provided ID
    Campground.findById(req.params.id).populate({
        path:"reviews",
        options:{sort:{createdAt:-1}} // sorting the populated reviews array to show the latest first
    }).populate("likes").exec(function (err, foundCamp) {
        if (err || !foundCamp) {
            req.flash("error",err.message)
            return res.redirect("back")
        } else {
            //render the camppage with the campground
            res.render("campgrounds/campPage", {
                campground: foundCamp
            });
        }
    });
});

//Booking Route for campgrounds
//Show page
router.get("/:id/booking", middleware.isLoggedIn, function (req, res) {
    Campground.findById(req.params.id, function (err, foundCamp) {
        if (err) {
            req.flash("error", "Cant find the campground booking page");
        } else {
            res.render("campgrounds/booking", {
                campground: foundCamp
            })
        }
    });
});

// send email after booking
router.post("/:id/booking",async function (req, res) {
    var camp = await Campground.findById(req.params.id)

    var smtpTransport = nodemailer.createTransport({
        service: "Gmail",
          auth: {
            user: "hadimaher207@gmail.com",
            pass: process.env.GMAILPW
          },
          tls: {rejectUnauthorized: false}
    });
    var mailOptions = {
        to: req.body.email,
        from: "hadimaher207@gmail.com",
        subject: "LetsCamp booking receipt",
        text:
          "You are receiving this because you booked the '"+ camp.campName +"' Campgroud.\n\n" +
          "The transcation is complete and the amount payed is $"+camp.cost+"\n\n" +
          "Please be there at the selected time"+
          "\n\n" +
          "Thank you for choosing LetsCamp.\n"
      };
    // email sent confirmation 
    smtpTransport.sendMail(mailOptions, function(err) {
        console.log("mail sent");
        req.flash(
          "success",
          "An e-mail has been sent to " +
            " with the booking receipt."
        );
        res.redirect("/campgrounds")
      });

});



//Edit Route for Campgrounds
router.get("/:id/edit", middleware.checkCampOwner, function (req, res) {
    Campground.findById(req.params.id, function (err, foundCamp) {
        res.render("campgrounds/edit", {
            campground: foundCamp
        })
    });
});


//Update Route for Campgrounds
router.put("/:id", middleware.checkCampOwner, upload.array('images',4), async function (req, res) {
    try{
        //delete the rating input just to be safe from any manipulation
        delete req.body.Camp.rating;
        // find the campground by id
		let campground = await Campground.findById(req.params.id);
		// check if there's any images for deletion
		if(req.body.deleteImages && req.body.deleteImages.length) {			
			// assign deleteImages from req.body to its own variable
			let deleteImages = req.body.deleteImages;
			// loop over deleteImages
			for(const public_id of deleteImages) {
				// delete images from cloudinary
				await cloudinary.v2.uploader.destroy(public_id);
				// delete image from campground.images
				for(const image of campground.images) {
					if(image.public_id === public_id) {
						let index = campground.images.indexOf(image);
						campground.images.splice(index, 1);
					}
				}
			}
		}
		// check if there are any new images for upload
		if(req.files) {
			// upload images
			for(const file of req.files) {
				let image = await cloudinary.v2.uploader.upload(file.path);
				// add images to post.images array
				campground.images.push({
					url: image.secure_url,
					public_id: image.public_id
				});
			}
		}
            geocoder.geocode(req.body.Camp.location, function (err, data) {
                if (err || !data.length) {
                    req.flash('error', 'Invalid address');
                    return res.redirect('back');
                }
                // edit the campground data
                campground.lat = data[0].latitude;
                campground.lng = data[0].longitude;
                campground.location = data[0].formattedAddress;
                campground.campName = req.body.Camp.campName;
                campground.phone    = req.body.Camp.phone;
                campground.image    = campground.images[0].url;
                campground.campDescription = req.body.Camp.campDescription;
                campground.address = req.body.Camp.address;
                campground.city = req.body.Camp.city
                campground.cost = req.body.Camp.cost;
                campground.save();
                req.flash("success", "Successfully Updated!");
                res.redirect("/campgrounds/" + campground._id);
            })
        } catch(err){
            console.log(err)
            req.flash("error", err.message);
            res.redirect("back")
        }
    
});


//Delete Route for Campgrounds
router.delete("/:id", middleware.checkCampOwner, async function (req, res) {
        try {
            let campground = await Campground.findById(req.params.id);
            for(const image of campground.images){
                await cloudinary.v2.uploader.destroy(image.public_id);
            }
            //remove reviews associated with the campgrounds
            Review.remove({"_id": { $in: campground.reviews}},function(err){
                if(err){
                    console.log(err);
                    return res.redirect("/campgrounds");
                }
                campground.remove();
                req.flash('success', 'Campground deleted successfully!');
                res.redirect('/campgrounds');
            })
        } catch (err) {
            console.log(err)
            req.flash("error", err.message);
            return res.redirect("back");
        }
});



//fuzzy search function
function escapeRegex(text) {
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
};




module.exports = router;
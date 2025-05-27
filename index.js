const { faker } = require('@faker-js/faker');
const mysql = require('mysql2');
const express = require('express');
const app = express();
const path = require("path");
const methodOverride = require("method-override");
const publicDirectory = path.join(__dirname, './public');
const session = require('express-session'); //session handeling for login
const multer  = require('multer');  // required multer npm package for file upload
const upload = multer({ dest: 'uploads/events/' }); // set destination of uploads
const fs = require('fs'); // rename uploaded file



app.use(express.static('uploads'));                   // setting static to access
app.use(methodOverride("_method"));
app.use(express.urlencoded({extended : true}));
app.use(express.json());
app.use(express.static(publicDirectory));
app.set("view engine", "ejs");                        // setting ejs
app.set("views", path.join(__dirname, "/views"));
app.use(session({
  secret: 'secretKey',
  resave: false,
  saveUninitialized: false,
  cookie: {maxAge: 24 * 60 * 60 * 1000}
}));


// Get the client


// Create the connection to database
// const connection = mysql.createConnection({
//   host: 'localhost',
//   user: 'root',
//   database: 'community_pulse',
//   password: 'Code@123'
// });

const connection = mysql.createConnection({
  host: process.env.DB_HOST || 'community-pulse-community-pulse.l.aivencloud.com',
  port: process.env.DB_PORT || 16088,
  user: process.env.DB_USER || 'avnadmin',
  password: process.env.DB_PASSWORD || 'AVNS_vpDLlN5gIhqeJY-cqnr',
  database: process.env.DB_NAME || 'defaultdb',
  ssl: {
    rejectUnauthorized: false
  }
});

// Test the connection
// connection.connect((err) => {
//   if (err) {
//     console.error('❌ Failed to connect to database:', err.message);
//     return;
//   }
//   console.log('✅ Successfully connected to Aiven MySQL database!');
  
  // Optional: Test a simple query
  // connection.query('SELECT 1 + 1 AS result', (error, results) => {
  //   if (error) {
  //     console.error('❌ Query failed:', error.message);
  //   } else {
  //     console.log('✅ Query successful! Result:', results[0].result);
  //   }
    
    // Close the connection
//     connection.end();
//   });
// });

// HOMEPAGE - showing total no. of datas
app.get("/", (req, res) => {
  let q = `SELECT * FROM events`;
  try{
    connection.query(q, (err,result) => {
      if (err) throw err;
        if (req.session.user){
          res.render("loggedHome.ejs", {result});
        } else {
          res.render("publicHome.ejs", {result});
        }
    });
  } catch (err) {
    console.log(err);
    res.send("some err in DB");
  }

});

//LOGIN SYSTEM
app.get("/login", (req, res) => {
    res.render("login.ejs");
});

app.get("/dashboard", (req, res) => {
  if (req.session.user){
    res.render("dashboard.ejs");
  } else {
    res.redirect("/login");
  }
})

app.post("/login", (req, res) => {
  const {emailID, pass} = req.body;
  let q = `SELECT * FROM user WHERE email = ? AND password = ?`;

  connection.query(q, [emailID, pass], (err, result) => {
    if (err) throw err;
    if (result.length > 0){
      req.session.user = result[0];
      res.redirect("/");
      console.log("logged in success");
    } else {
      res.send("Invalid Credentials");
    }
  });

});


//LOGOUT SYSTEM
app.get("/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/");
});

//REGISTER SYSTEM

//ADD USER
app.get("/register", (req, res) => {
    res.render("register.ejs");
});

app.post("/register", (req, res) => {
  let {firstN, lastN, userN, emailID, phoneN, pass, city, state, pincode, country} = req.body;
  let values = [userN, firstN, lastN, emailID, phoneN, city, state, pincode, country, pass];
  let q = `INSERT INTO user (username, firstName, lastName, email, phone, city, state, pincode, password) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  let q2 = `SELECT username, email FROM user WHERE username = ? OR email = ?`;

  try{
    connection.query(q2, [userN, emailID], (err,result) => {
      if (err) throw err;
      if (result.length > 0){
        req.session.user = result[0];
        res.send("user already exist");
      } else {
        connection.query(q, values, (err, result) => {
          if (err) throw err;
          res.redirect("/login");
        });
      }
    });
  } catch (err) {
    console.log(err);
    res.send("some err in DB");
  }
});

//ADD EVENT 
app.get("/event/add", (req, res) => {
  if (req.session.user){
    res.render("addEvent.ejs");
  } else {
    res.redirect("/login");
  }
});

const cpUpload = upload.fields([{ name: 'eventImg', maxCount: 1 }]);

app.post('/event/add', cpUpload, (req, res) => {
  const file = req.files['eventImg']?.[0];

  if (!file) {
    return res.status(400).send('No image uploaded');
  }

  // Step 1: Generate Event ID
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, ''); // e.g. "20250522"
  const randomPart = Math.random().toString(36).substring(2, 5).toUpperCase(); // 3 random alphanumerics
  const eventID = `${datePart}-${randomPart}`;

  // Step 2: Preserve extension
  const ext = path.extname(file.originalname); // e.g. ".jpg"

  // Step 3: Rename image
  const oldPath = file.path; // current full path (e.g. uploads/events/abc123.jpg)
  const newFilename = `${eventID}${ext}`;
  const newPath = path.join(path.dirname(oldPath), newFilename);

  fs.rename(oldPath, newPath, (err) => {
    if (err) {
      console.error("Rename failed:", err);
      return res.status(500).send('File rename failed');
    }
  });

  // Step 4: Determine final category
  const category =
    req.body.eventCategory === 'other'
    ? req.body.customCategory
      : req.body.eventCategory;

  
  // Step 5: Build full array of data

  const formData = {
    eventID,
    eventTitle: req.body.eventTitle,
    organizerName: req.body.organizerName,
    category,
    eventDate: req.body.eventDate,
    eventLocation: req.body.eventLocation,
    contactEmail: req.body.contactEmail,
    eventD: req.body.eventD,
    regStatus: req.body.regStatus,
    maxAttend: req.body.maxAttend === '' ? null : req.body.maxAttend,
    socialMedia: req.body.socialMedia,
    imagePath: `${newFilename}`,
    username: req.session.user.username
  };
  const eventValues = [
  formData.eventID,
  formData.eventTitle,
  formData.organizerName,
  formData.category,
  formData.eventDate,
  formData.eventLocation,
  formData.contactEmail,
  formData.eventD,
  formData.regStatus,
  formData.maxAttend,
  formData.socialMedia,
  formData.imagePath,
  formData.username
  ];

  //upload to database
  let q = `INSERT INTO events (
    eventID,
    eventTitle,
    organizerName,
    category,
    eventDate,
    eventLocation,
    contactEmail,
    eventDescription,
    regStatus,
    maxAttend,
    socialMedia,
    imagePath,
    username
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  
  try{
    connection.query(q, eventValues, (err,result) => {
      if (err) throw err;
      res.send("<h1>Event add request sent to Admin</h1>");
    });
  } catch (err) {
    console.log(err);
    res.send("some err in DB");
  }

  // Convert object to array (order matters for SQL)
  const eventData = Object.values(formData);

  console.log("Renamed file to:", newFilename);
  console.log("Form Data:", req.body);
  console.log("Upload to server : ", formData);
});





// REGISTERED EVENTS BY USER
app.get("/event/registered", (req, res) => {
  res.render("registeredEvent.ejs");
})

app.get("/event/host", (req, res) => {
  res.render("myEvent.ejs");
})

app.get("event/detail:evID", (req, res) => {
  res.render("event.ejs");
})

app.get("/user/profile", (req, res) => {
  if (req.session.user){
    let data = req.session.user;
    res.render("userProfile.ejs", {data});
  } else {
    res.redirect("/login");
  }
});


const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`app is listening on port ${port}`);
});




// USELESS     ===============      USELESS        ====================          USELESS       ===================        USELESS


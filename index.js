// requiring necessary modules
var express = require('express');
var ejs = require('ejs');
var bodyParser = require('body-parser');
const mysql = require('mysql');
var session = require('express-session');
var validator = require ('express-validator');
const expressSanitizer = require('express-sanitizer');

// creating express app
const app = express()
const port = 8000

// middleware configurations
app.use(bodyParser.urlencoded({ extended: true }));
app.use(expressSanitizer());

// session configuration
app.use(session({
    secret: 'somerandomstuff',
    resave: false,
    saveUninitialized: false,
    cookie: {
        expires: 600000
    }
}));

// serving static files
app.use(express.static(__dirname + '/public'));
app.use('/uploads', express.static('uploads'));

// connecting to MySQL database
const db = mysql.createConnection({
    host: 'localhost',
    user: 'appuser',
    password: 'app2024',
    database: 'myForum'
});

// handling database connection
db.connect((err) => {
    if (err) {
        console.error('Error connecting to database:', err.stack);
        return;
    }
    console.log('Connected to database');
});
global.db = db;

// setting up views and view engine
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.engine('html', ejs.renderFile);

// defining forum data
var forumData = {
    forumName: "Teyvat Tales"
}

// requiring routes
require("./routes/main")(app, forumData);

// starting server
app.listen(port, () => console.log(`Example app listening on port ${port}!`))
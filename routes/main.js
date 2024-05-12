// import necessary modules
const {
    check,
    validationResult
} = require('express-validator'); // brings in validation functions

const multer = require('multer'); // for handling file uploads
const path = require('path'); // for managing file paths

// configure storage for multer
const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        // set destination folder to 'uploads'
        cb(null, 'uploads/')
    },
    filename: function(req, file, cb) {
        // generate unique filename using current timestamp and a random number
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        // set filename as the field name plus unique suffix and original file extension
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

// initialize multer with configured storage
const upload = multer({
    storage: storage
});

module.exports = function(app, forumData) {
    // redirect to login page if user is not logged in
    const redirectLogin = (req, res, next) => {
        if (!req.session.userId) {
            res.redirect('/login') // if no user session, redirect to login page
        } else {
            next(); // otherwise, continue to the next middleware/route handler
        }
    }

    // for securely hashing passwords
    const bcrypt = require('bcrypt');

    // route handler for the home page
    app.get('/', function(req, res) {
        const userLoggedIn = req.session.userId ? true : false; // check if the user is logged in
        const username = userLoggedIn ? req.session.userId : ''; // get the username if logged in
        res.render('index.ejs', {
            forumName: forumData.forumName, // provide forum name for the page
            userLoggedIn: userLoggedIn, // indicate whether a user is logged in
            username: username // provide username for display or use
        });
    });

    // route handler for the about page
    app.get('/about', function(req, res) {
        const userLoggedIn = req.session.userId ? true : false;
        const username = userLoggedIn ? req.session.userId : '';
        res.render('about.ejs', {
            forumName: forumData.forumName,
            userLoggedIn: userLoggedIn,
            username: username
        });
    });

    // route handler for the contact page
    app.get('/contact', function(req, res) {
        const userLoggedIn = req.session.userId ? true : false;
        const username = userLoggedIn ? req.session.userId : '';
        res.render('contact.ejs', {
            forumName: forumData.forumName,
            userLoggedIn: userLoggedIn,
            username: username
        });
    });

    // route handler for creating a new post
    app.get("/createPost", redirectLogin, function(req, res) {
        const userLoggedIn = req.session.userId ? true : false;
        const username = userLoggedIn ? req.session.userId : '';
        const role = userLoggedIn ? req.session.role : ''; // get the user's role if logged in

        res.render("createPost.ejs", {
            forumName: forumData.forumName,
            userLoggedIn: userLoggedIn,
            username: username,
            role: role // get the user's role
        });
    });

    // route handler for submitting a new post
    app.post("/createPost", upload.single("thumbnail"), function(req, res) {
        const errors = validationResult(req); // check for validation errors
        if (!errors.isEmpty()) {
            // collect error messages
            const errorMessages = errors.array().map(error => error.msg);
            return res.render('createPost.ejs', {
                forumName: forumData.forumName,
                userLoggedIn: true, // ensure the user is logged in
                username: req.session.userId, // get the username from the session
                role: req.session.role, // get the user role from the session
                errors: errorMessages // show validation errors
            });
        }

        // get form data
        const {title, tag, description} = req.body;
        // set thumbnail if file is uploaded
        const thumbnail = req.file ? '/uploads/' + req.file.filename : '';

        // query to insert a new post into the database
        const insertPostQuery = "INSERT INTO posts (title, content, thumbnail, username, user_id, tag, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())";
        const insertPostValues = [title, description, thumbnail, req.session.userId, req.session.userDbId, tag];

        // execute the database query to insert the post
        db.query(insertPostQuery, insertPostValues, (err, results) => {
            if (err) {
                // handle database errors
                console.error('Error inserting post into database:', err);
                return res.status(500).render('createPost.ejs', {
                    forumName: forumData.forumName,
                    userLoggedIn: true,
                    username: req.session.userId,
                    role: req.session.role,
                    errors: ['Failed to create post due to database error.'] // show database error
                });
            }

            // query to log post creation in recent activity
            const activityQuery = "INSERT INTO recent_activity (user_id, action_type, reference_id, timestamp) VALUES (?, ?, ?, NOW())";
            const activityValues = [req.session.userDbId, 'Create post', results.insertId];

            // run the query to save this action to recent activity
            db.query(activityQuery, activityValues, (activityErr) => {
                if (activityErr) {
                    console.error('Error logging activity:', activityErr); // log error if activity logging fails
                }
                res.redirect('/posts'); // redirect to the posts page after successfully creating the post and logging the activity
            });
        });
    });

    // route handler for fetching and rendering posts
    app.get('/posts', function(req, res) {
        // query to get all non-deleted posts, ordered by most recent
        db.query('SELECT * FROM posts WHERE isDeleted = 0 ORDER BY created_at DESC', (err, posts) => {
            if (err) {
                console.error('Error fetching posts:', err); // log an error if the query fails
                return res.status(500).send('Error fetching posts'); // send error message
            }
            res.render('posts.ejs', {
                posts: posts, // provide the list of posts
                forumName: forumData.forumName,
                userLoggedIn: req.session.userId ? true : false, // check if user is logged in
                username: req.session.userId
            });
        });
    });

    // route handler for submitting a new post via form submission
    app.post('/posts', redirectLogin, upload.single('thumbnail'), [
        // validate and sanitize form inputs
        check('title').trim().isLength({
            min: 1
        }).withMessage('Title is required'),
        check('tag').trim().isLength({
            min: 1
        }).withMessage('Tag is required'),
        check('description').trim().isLength({
            min: 1
        }).withMessage('Description is required')
    ], (req, res) => {
        // handle validation errors if any
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            const errorMessages = errors.array().map(error => error.msg);
            return res.render('createPost.ejs', {
                forumName: forumData.forumName,
                userLoggedIn: true,
                username: req.session.userId,
                role: req.session.role,
                errors: errorMessages
            });
        }

        // get form data
        const {title, tag, description} = req.body;
        const thumbnail = req.file ? req.file.path : '';

        // query to insert a new post into the database
        const insertPostQuery = "INSERT INTO posts (title, content, thumbnail, username, user_id, tag, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())";
        const insertPostValues = [title, description, thumbnail, req.session.userId, req.session.userDbId, tag];

        // execute the query to save the new post
        db.query(insertPostQuery, insertPostValues, (err, results) => {
            if (err) {
                // handle database errors
                console.error('Error inserting post into database:', err);
                return res.status(500).render('createPost.ejs', {
                    forumName: forumData.forumName,
                    userLoggedIn: true,
                    username: req.session.userId,
                    role: req.session.role,
                    errors: ['Failed to create post due to database error.'] // show database error
                });
            }
            res.redirect('/posts');
        });
    });

    // route handler for viewing a specific post and its comments
    app.get("/view-post/:postId", async function(req, res) {
        try {
            const postId = req.params.postId; // get the post ID
            const order = req.query.order || "DESC"; // get the sorting order, default is DESC

            if (!postId) {
                return res.status(400).json({ // return a 400 error if postId is missing
                    message: `Missing required field "postId"`
                });
            }

            // query the database to fetch the post to ensure it exists and isn't deleted
            db.query(
                "SELECT * FROM posts WHERE isDeleted = FALSE AND id = ?", [postId], (err, result) => {
                    if (err) {
                        console.error("Error fetching post:", err); // log the error if there's an issue fetching the post
                        return res.status(500).send("Internal Server Error");
                    }

                    if (result.length === 0) {
                        return res.status(404).json({
                            message: "Post not found" // respond with message if the post doesn't exist in the database
                        });
                    }

                    // store the post data
                    const post = result[0];

                     // determine if the provided order is valid, defaulting to DESC
                    const validOrder = ["ASC", "DESC"].includes(order.toUpperCase()) ? order.toUpperCase() : "DESC";
                    const orderClause = `ORDER BY created_at ${validOrder}`;

                    // query to fetch comments associated with the post
                    const query = `
                        SELECT user_comments.*, userDetails.username, userDetails.profileImage
                        FROM user_comments
                        JOIN userDetails ON user_comments.user_id = userDetails.id
                        WHERE user_comments.isDeleted = FALSE AND user_comments.post_id = ${db.escape(postId)}
                        ${orderClause};
                    `;

                    // execute the query to fetch comments
                    db.query(query, (err, comments) => {
                        if (err) {
                            console.error("Error fetching comments:", err); // log the error if comments query fails
                            return res.status(500).send("Internal Server Error");
                        }
                        res.render("postDetails.ejs", {
                            post: post, // pass the post data
                            comments: comments, // pass the comments associated with the post
                            forumName: forumData.forumName,
                            userLoggedIn: req.session.userId ? true : false,
                            username: req.session.username, // provide the username from the session
                            session: req.session, // pass all session data
                            currentRoute: "/view-post/" + postId, // show the current URL path being viewed
                            postId: postId, // pass the post ID
                            role: req.session.role,
                            tag: post.tag // pass the tag associated with the post
                        });

                    });
                }
            );
        } catch (error) {
            return res.status(500).json({ // respond with a 500 internal server error status
                message: error.message
            });
        }
    });

    // route handler for editing a post
    app.get("/edit-post/:postId", redirectLogin, async function(req, res) {
        const userLoggedIn = req.session.userId ? true : false;
        const username = req.session.username || ""; // get the username from the session
        const role = req.session.role || ""; // get the user role from the session

        const postId = req.params.postId;
        if (!postId) {
            return res.status(400).json({
                message: `Missing required field "postId"` // respond with error if post ID is missing
            });
        }

        // query the database to fetch the post by its ID
        db.query("SELECT * FROM posts WHERE id = ?", [postId], (err, postResult) => {
            if (err) {
                console.error("Error fetching post:", err); // log the error if there's an issue fetching the post from the database
                return res.status(500).send("Internal Server Error");
            }

            if (postResult.length === 0) {
                return res.status(404).json({
                    message: "Post not found" // respond with message if no post matches the given ID
                });
            }

            // store the fetched post
            const post = postResult[0];

            // query to fetch comments associated with the post
            const commentsQuery = `
                SELECT user_comments.*, userDetails.username, userDetails.profileImage
                FROM user_comments
                JOIN userDetails ON user_comments.user_id = userDetails.id
                WHERE user_comments.isDeleted = FALSE AND user_comments.post_id = ?;
            `;

            // execute the comments query
            db.query(commentsQuery, [postId], (err, comments) => {
                if (err) {
                    console.error("Error fetching comments:", err); // log the error if the comments query fails
                    return res.status(500).send("Internal Server Error");
                }

                res.render("editPost.ejs", {
                    forumName: forumData.forumName,
                    userLoggedIn: userLoggedIn,
                    username: username,
                    role: role,
                    currentRoute: "edit-post", // provide the current route
                    postData: post, // pass the fetched post data
                    postId: postId,
                    comments: comments
                });
            });
        });
    });

    // route handler for updating a post
    app.post("/update-post/:postId", upload.single("thumbnail"), function(req, res) {
        try {
            const postId = req.params.postId;
            const userId = req.session.userDbId; // get the user ID from the session

            // query the database to fetch the post to ensure it exists and isn't deleted
            db.query("SELECT * FROM posts WHERE isDeleted = FALSE AND id = ?", [postId], (err, result) => {
                if (err) {
                    console.error("Error fetching post:", err); // log the error if there's an issue retrieving the post from the database
                    return res.status(500).send("Internal Server Error");
                }

                if (result.length === 0) {
                    return res.status(404).json({
                        message: "Post not found" // respond with message if the post doesn't exist
                    });
                }

                // store the fetched post
                const post = result[0];

                if (post.user_id !== userId) {
                    return res.status(403).json({
                        message: "You are not authorized to update this post", // respond with error message if the user does not own the post
                    });
                }

                const updateData = {
                    edited: 1 // mark the post as edited
                };
                // update post details if they are provided
                if (req.body.title) updateData.title = req.sanitize(req.body.title);
                if (req.body.tag) updateData.tag = req.body.tag;
                if (req.body.content) updateData.content = req.sanitize(req.body.content);
                if (req.file) {
                    updateData.thumbnail = `/uploads/${req.file.filename}`; // update thumbnail if a new file is uploaded
                }
                updateData.updated_at = new Date(); // set the updated timestamp

                // execute the update query on the database
                db.query("UPDATE posts SET ? WHERE id = ?", [updateData, postId], (err, updateResult) => {
                    if (err) {
                        console.error("Error updating post:", err); // log the error if there's an issue updating the post in the database
                        return res.status(500).send("Internal Server Error");
                    }

                    // log the post update action in recent activity
                    const activityQuery = "INSERT INTO recent_activity (user_id, action_type, reference_id, timestamp) VALUES (?, 'Update post', ?, NOW())";
                    const activityValues = [userId, postId];

                    db.query(activityQuery, activityValues, (activityErr) => {
                        if (activityErr) {
                            console.error('Error logging update activity:', activityErr);
                        }
                        res.redirect(`/view-post/${postId}`); // redirect to the updated post's view page
                    });
                });
            });
        } catch (error) {
            console.error("Exception handling update:", error);
            return res.status(500).json({
                message: error.message // return error message if there's an exception
            });
        }
    });

    // route handler for deleting a post
    app.get("/delete-post/:postId", function(req, res) {
        try {
            const postId = req.params.postId;
            const userId = req.session.userDbId;

            // query the database to check the ownership of the post
            db.query("SELECT user_id, title FROM posts WHERE isDeleted = FALSE AND id = ?", [postId], (err, result) => {
                    if (err) {
                        console.error("Error checking post ownership:", err); // log the error if there's an issue checking the ownership of the post
                        return res.status(500).send("Internal Server Error");
                    }

                    if (result.length === 0) {
                        return res.status(404).json({
                            message: "Post not found" // respond with message if no post matches the ID
                        });
                    }

                    const post = result[0];
                    const postUserId = post.user_id;
                    if (postUserId !== userId) {
                        return res.status(403).json({
                            message: "You are not authorized to delete this post" // respond with message if the user does not own the post
                        });
                    }

                    // query to delete the post by setting isDeleted to TRUE
                    db.query("UPDATE posts SET isDeleted = TRUE WHERE id = ?", [postId], (err, updateResult) => {
                            if (err) {
                                console.error("Error deleting post:", err); // log an error if the delete operation fails
                                return res.status(500).send("Internal Server Error");
                            }

                            // insert an activity log for deleting the post
                            const activityQuery = "INSERT INTO recent_activity (user_id, action_type, reference_id, isPublic, timestamp) VALUES (?, 'Delete post', ?, TRUE, NOW())";
                            db.query(activityQuery, [userId, postId], (err, result) => {
                                if (err) {
                                    console.error("Error recording delete post activity:", err); // log an error if logging the activity fails
                                    return res.status(500).send("Internal Server Error");
                                }
                                res.redirect('/'); // redirect to the home page after deletion
                            });
                        }
                    );
                }
            );
        } catch (error) {
            return res.status(500).json({
                message: error.message // return error message if there's an exception
            });
        }
    });

    // route handler for adding a comment to a post
    app.post("/add-comment", async (req, res) => {
        try {
            const user_id = req.session.userDbId; // get the user ID from session data
            const {postId, comment} = req.body; // get postId and comment

            if (!postId || !comment) {
                return res.status(400).json({ // return a 400 error if postId or comment are missing
                    message: "Add required fields"
                });
            }

            // query to insert the new comment into the database
            const insertCommentQuery = "INSERT INTO user_comments (user_id, post_id, comment) VALUES (?, ?, ?)";
            db.query(insertCommentQuery, [user_id, postId, comment], (err, result) => {
                if (err) {
                    console.error("Error adding comment to database:", err); // log the error if there's an issue inserting the comment into the database
                    return res.status(500).send("Internal Server Error");
                }

                // get the ID of the newly inserted comment
                const commentId = result.insertId;
                // query to log this comment action in the recent_activity table
                const insertActivityQuery = `INSERT INTO recent_activity (user_id, reference_id, action_type, isPublic, timestamp) VALUES (?, ?, 'Comment on post', true, NOW())`;

                db.query(insertActivityQuery, [user_id, commentId], (err, result) => {
                    if (err) {
                        console.error("Error while adding activity log to database:", err); // log the error if there's an issue inserting the activity log into the database
                        return res.status(500).send("Internal Server Error");
                    }
                    return res.redirect(`/view-post/${postId}`); // redirect to the post's view page after adding the comment
                });
            });
        } catch (error) {
            return res.status(500).json({
                message: error.message // return error message if there's an exception
            });
        }
    });

    // route handler for fetching comments of a post
    app.get("/post-comments/:id", function(req, res) {
        try {
            let postId = req.params.id; // extract the post ID from the request parameters
            if (!postId) {
                // if post ID is missing in the URL, return an error
                return res.status(400).json({
                    message: `Missing required field "postId"`
                });
            }

            // determine the sort order for comments; default to ASC if not specified
            let order = req.query.order && ["ASC", "DESC"].includes(req.query.order.toUpperCase()) ? req.query.order.toUpperCase() : "ASC";

            // query to select comments from the database where the post ID matches and comments are not deleted
            let query = `SELECT uc.id, uc.user_id, uc.post_id, uc.comment, uc.created_at, uc.updated_at
                        FROM user_comments uc
                        WHERE uc.post_id = ${postId} AND uc.isDeleted = FALSE
                        ORDER BY uc.created_at ${order}`;

            // execute the database query to fetch comments
            db.query(query, (err, result) => {
                if (err) {
                    console.error("Error fetching comments:", err); // log the error if there's an issue fetching the comments
                    return res.status(500).send("Internal Server Error");
                }

                // return the fetched comments
                return res.status(200).json({
                    comments: result
                });
            });
        } catch (error) {
            return res.status(500).json({
                message: error.message // return an error message if there's an exception
            });
        }
    });

    // route handler for rendering the login page
    app.get('/login', function(req, res) {
        res.render('login.ejs', {
            forumName: forumData.forumName,
            errorMessage: ''
        });
    });

    // route handler for user login
    app.post('/login', function(req, res) {
        // sanitize and standardize the username input
        const username = req.sanitize(req.body.username.toLowerCase());
        const password = req.body.password; // get password from request body

        // query to retrieve user details based on the username
        let sqlQuery = "SELECT id, username, hashedPassword FROM userDetails WHERE username = ?";
        db.query(sqlQuery, [username], (err, result) => {
            if (err) {
                console.error(err); // log any database errors
                return res.status(500).send("Error accessing the database. Please try again later."); // send error response
            }

            if (result.length > 0) {
                // if user exists, get user data from the database result
                const userDbId = result[0].id;
                const storedUsername = result[0].username;
                const hashedPassword = result[0].hashedPassword;

                // compare the provided password with the hashed password stored in the database
                bcrypt.compare(password, hashedPassword, function(err, isMatch) {
                    if (err) {
                        console.error(err);  // log any errors during password comparison
                        return res.status(500).send("Error. Please try again later."); // send error response
                    } else if (isMatch) {
                        // if password matches, update the user's last login time in the database
                        let updateLoginTimeSql = "UPDATE userDetails SET lastlogin = NOW() WHERE id = ?";
                        db.query(updateLoginTimeSql, [userDbId], (updateErr, updateResult) => {
                            if (updateErr) {
                                console.error(updateErr); // log any errors during the login time update
                                return res.status(500).send("Error updating login time. Please try again later."); // send error response
                            }

                            // set user session variables
                            req.session.userId = storedUsername;
                            req.session.userDbId = userDbId;

                            // redirect user to the homepage
                            res.redirect('/');
                        });
                    } else {
                        res.render('login.ejs', {
                            // if password does not match, render the login page with an error message
                            forumName: forumData.forumName,
                            errorMessage: 'Incorrect username or password'
                        });
                    }
                });
            } else {
                // if no user found, render the login page with an error message
                res.render('login.ejs', {
                    forumName: forumData.forumName,
                    errorMessage: 'User not found. Please try again.'
                });
            }
        });
    });

    // route handler for user logout
    app.get('/logout', (req, res) => {
         // destroy the session to log the user out
        req.session.destroy(err => {
            if (err) {
                console.error(err); // log any errors that occur during session destruction
            }
            res.redirect('/'); // redirect to the homepage after logging out
        });
    });

    // route handler for rendering the registration page
    app.get('/register', function(req, res) {
        res.render('register.ejs', {
            forumName: forumData.forumName,
            errorMessage: '',
            successMessage: ''
        });
    });

    // route handler for user registration
    app.post('/register', [
        // validate that the email field contains a valid email
        check('email').isEmail().withMessage('Please enter a valid email address'),
    ], function(req, res) {
        const errors = validationResult(req); // perform validation and store any errors
        if (!errors.isEmpty()) {
            // if validation errors exist, extract and format them
            const errorMessages = errors.array().map(error => error.msg);
            return res.render('register.ejs', {
                forumName: forumData.forumName,
                errorMessage: errorMessages.join('<br>'),
                successMessage: ''
            });
        } else {
            const saltRounds = 10; // specify the cost factor for hashing the password
            const plainPassword = req.body.password; // get the plain text password from the request

            bcrypt.hash(plainPassword, saltRounds, function(err, hashedPassword) {
                if (err) {
                    // handle hashing errors
                    return res.render('register.ejs', {
                        forumName: forumData.forumName,
                        errorMessage: 'An error occurred during password encryption.',
                        successMessage: ''
                    });
                }

                const firstName = req.sanitize(req.body.first); // sanitize first name
                const lastName = req.sanitize(req.body.last); // sanitize last name
                const email = req.sanitize(req.body.email); // sanitize email
                const username = req.sanitize(req.body.username.toLowerCase()); // sanitize and lower-case the username

                // query to check if the username or email already exists in the database
                let checkExistingQuery = "SELECT * FROM userDetails WHERE email = ? OR LOWER(username) = ?";
                let checkExistingValues = [req.body.email, username];

                db.query(checkExistingQuery, checkExistingValues, (err, results) => {
                    if (err) {
                        // handle database errors when checking if user already exists
                        return res.render('register.ejs', {
                            forumName: forumData.forumName,
                            errorMessage: 'Database error while checking existing user details.',
                            successMessage: ''
                        });
                    }

                    if (results.length > 0) {
                        // if the user exists, check which attribute conflicts (email or username)
                        let emailExists = results.some(result => result.email === req.body.email);
                        let usernameExists = results.some(result => result.username.toLowerCase() === username);
                        let errorMessage = '';
                        if (emailExists && usernameExists) {
                            errorMessage = 'The provided email and/or username is already in use';
                        } else if (emailExists) {
                            errorMessage = 'Email is already in use';
                        } else if (usernameExists) {
                            errorMessage = 'Username is already taken';
                        }

                        res.render('register.ejs', {
                            forumName: forumData.forumName,
                            errorMessage: errorMessage,
                            successMessage: ''
                        });
                    } else {
                        // if no existing user is found, insert the new user into the database
                        let insertQuery = "INSERT INTO userDetails (username, first, last, email, hashedPassword, joindate, lastlogin) VALUES (?, ?, ?, ?, ?, NOW(), NULL)";
                        let newUser = [username, req.body.first, req.body.last, req.body.email, hashedPassword];

                        db.query(insertQuery, newUser, (err, result) => {
                            if (err) {
                                // handle errors during user insertion
                                return res.render('register.ejs', {
                                    forumName: forumData.forumName,
                                    errorMessage: 'Database error while registering new user',
                                    successMessage: ''
                                });
                            } else {
                                // on successful registration, display a welcome message
                                let successMessage = 'Welcome ' + username + '! You can now log in as you have successfully registered.';
                                res.render('register.ejs', {
                                    forumName: forumData.forumName,
                                    errorMessage: '',
                                    successMessage: successMessage
                                });
                            }
                        });
                    }
                });
            });
        }
    });

    // route handler for rendering the characters page
    app.get('/characters', function(req, res) {
        const userLoggedIn = req.session.userId ? true : false;
        const username = userLoggedIn ? req.session.userId : '';
        res.render('characters.ejs', {
            forumName: forumData.forumName,
            userLoggedIn: userLoggedIn,
            username: username
        });
    });

    // route handler for rendering the user account page
    app.get('/myAccount', redirectLogin, function(req, res) {
        const userId = req.session.userDbId;

        // query to fetch user details from the database
        db.query('SELECT id, username, email, joindate, lastlogin, profileImage FROM userDetails WHERE id = ?', [userId], (err, userDetailsResult) => {
            if (err) {
                console.error('Error fetching user details:', err); // log error if there's a failure in retrieving user details from the database
                return res.status(500).send('Internal Server Error');
            }

            if (userDetailsResult.length > 0) {
                // store the user details
                const userDetails = userDetailsResult[0];
                // set a default image if none is specified
                userDetails.profileImage = userDetails.profileImage || '/assets/primogem.png';

                // query to fetch recent activity related to the user
                const activityQuery = `
                SELECT ra.action_type, ra.timestamp,
                CASE
                    WHEN ra.action_type = 'Comment on post' THEN (
                        SELECT p.title FROM posts p
                        INNER JOIN user_comments uc ON uc.post_id = p.id
                        WHERE uc.id = ra.reference_id
                    )
                    WHEN ra.action_type = 'Create post' THEN (
                        SELECT p.title FROM posts p WHERE p.id = ra.reference_id
                    )
                    WHEN ra.action_type = 'Update post' THEN (
                        SELECT p.title FROM posts p WHERE p.id = ra.reference_id
                    )
                    WHEN ra.action_type = 'Delete post' THEN (
                        SELECT p.title FROM posts p WHERE p.id = ra.reference_id
                    )
                    ELSE 'N/A'
                END AS post_title
                FROM recent_activity ra
                WHERE ra.user_id = ?
                ORDER BY ra.timestamp DESC
                LIMIT 10
                `;

                // execute the query to get the recent activities
                db.query(activityQuery, [userId], (err, activityResult) => {
                    if (err) {
                        console.error('Error fetching recent activity:', err); // log error if there's an issue fetching recent activity
                        return res.status(500).send('Internal Server Error');
                    }

                    res.render('myAccount.ejs', {
                        forumName: forumData.forumName,
                        userDetails: userDetails, // pass the user's details
                        userLoggedIn: true,
                        username: req.session.userId,
                        userActivity: activityResult, // pass the user's recent activities
                        userId: userId // pass the user's database ID
                    });
                });
            } else {
                // redirect to login if no user details are found
                res.redirect('/login');
            }
        });
    });

    // route handler for deleting user account
    app.post('/delete-account', redirectLogin, function(req, res) {
        const userId = req.session.userDbId;

        // query to mark all posts by the user as deleted
        const deletePostsQuery = 'UPDATE posts SET isDeleted = TRUE WHERE user_id = ?';
        db.query(deletePostsQuery, [userId], (err, postResult) => {
            if (err) {
                console.error('Error marking posts as deleted:', err); // log error if there's an issue updating the post status to 'deleted'
                return res.status(500).send('Internal Server Error');
            }

            // query to permanently delete the user account from the database
            db.query('DELETE FROM userDetails WHERE id = ?', [userId], (err, userResult) => {
                if (err) {
                    console.error('Error deleting user account from the database:', err); // log error if the delete fails
                    return res.status(500).send('Internal Server Error');
                }

                // destroy the session to log out the user after account deletion
                req.session.destroy(err => {
                    if (err) {
                        console.error(err); // log any error during session destruction
                    }
                    res.redirect('/'); // redirect to the home page after successful logout and account deletion
                });
            });
        });
    });

    // route handler for searching posts
    app.get('/search-posts', function(req, res) {
        const searchTerm = req.query.term; // get search term from request query
        if (!searchTerm) { // if search term is not provided
            // render posts page with empty list and no posts found message
            res.render('posts.ejs', {
                posts: [],
                noPostsFound: true,
                forumName: forumData.forumName,
                userLoggedIn: req.session.userId ? true : false,
                username: req.session.userId
            });
        } else {
             // query to search posts based on title or content matching search term
            const searchQuery = "SELECT * FROM posts WHERE (title LIKE ? OR content LIKE ?) AND isDeleted = FALSE ORDER BY created_at DESC";
            db.query(searchQuery, [`%${searchTerm}%`, `%${searchTerm}%`], (err, posts) => {
                if (err) {
                    console.error('Error fetching search results:', err); // log the error if there's an issue fetching search results
                    return res.status(500).send('Error fetching search results');
                }
                if (posts.length === 0) {
                    // render posts page with empty list and no posts found message if no posts found matching search term
                    res.render('posts.ejs', {
                        posts: [],
                        noPostsFound: true,
                        forumName: forumData.forumName,
                        userLoggedIn: req.session.userId ? true : false,
                        username: req.session.userId
                    });
                } else {
                    // render posts page with search results if posts found matching search term
                    res.render('posts.ejs', {
                        posts: posts,
                        noPostsFound: false,
                        forumName: forumData.forumName,
                        userLoggedIn: req.session.userId ? true : false,
                        username: req.session.userId
                    });
                }
            });
        }
    });

    // route handler for deleting a comment
    app.delete("/delete-comment/:commentId", async function(req, res) {
        const commentId = req.params.commentId;
        const userId = req.session.userDbId;

        if (!commentId) {
            return res.status(400).json({
                message: "Missing required parameter: commentId"
            });
        }

        // query to soft delete the comment
        const deleteQuery = `
        UPDATE user_comments
        SET isDeleted = TRUE
        WHERE id = ? AND user_id = ?
    `;

        // execute the delete query
        db.query(deleteQuery, [commentId, userId], (err, result) => {
            if (err) {
                console.error("Error deleting comment:", err);  // log the error if there's an issue deleting the comment
                return res.status(500).send("Internal Server Error");
            }

            if (result.affectedRows === 0) {
                return res.status(404).json({
                    message: "No comment found or you do not have permission to delete this comment" // respond with message if no comment is deleted or user lacks permission
                });
            }

            res.json({
                success: true,
                message: "Comment deleted successfully" // return success message if comment is deleted successfully
            });
        });
    });

    // route handler for updating profile image
    app.post('/update-profile-image', redirectLogin, upload.single('profileImage'), (req, res) => {
        const userId = req.session.userDbId;

        if (!req.file) {
            return res.status(400).send('No file uploaded.'); // respond with message if no file is uploaded
        }

        // get profile image path
        const profileImagePath = '/uploads/' + req.file.filename;

        // query to update profile image path in database
        const updateQuery = "UPDATE userDetails SET profileImage = ? WHERE id = ?";

        // execute the update query
        db.query(updateQuery, [profileImagePath, userId], (err, result) => {
            if (err) {
                console.error('Error updating user profile image:', err); // log the error if there's an issue updating user profile image
                return res.status(500).send('Internal Server Error');
            }
            res.redirect('/myAccount'); // redirect to user's account page after successful update
        });
    });

    // route handler for fetching posts by tag
    app.get('/posts/tag/:tag', function(req, res) {
        const tag = req.params.tag; // get tag from request parameters
        // query to fetch posts by tag
        db.query('SELECT * FROM posts WHERE tag = ? AND isDeleted = 0 ORDER BY created_at DESC', [tag], (err, posts) => {
            if (err) {
                console.error('Error fetching posts by tag:', err); // log the error if there's an issue fetching posts by tag
                return res.status(500).send('Error fetching posts');
            }

            if (posts.length === 0) {
                // render posts page with empty list and no posts found message if no posts found for the tag
                res.render('posts.ejs', {
                    posts: [],
                    noPostsFound: true,
                    tag: tag,
                    forumName: forumData.forumName,
                    userLoggedIn: req.session.userId ? true : false,
                    username: req.session.userId
                });
            } else {
                // render posts page with posts filtered by tag if posts found for the tag
                res.render('posts.ejs', {
                    posts: posts,
                    noPostsFound: false,
                    tag: tag,
                    forumName: forumData.forumName,
                    userLoggedIn: req.session.userId ? true : false,
                    username: req.session.userId
                });
            }
        });
    });
}
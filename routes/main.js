// import necessary modules
const {
    check,
    validationResult
} = require('express-validator');

const multer = require('multer');
const path = require('path');

// configure storage for multer
const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        cb(null, 'uploads/')
    },
    filename: function(req, file, cb) {
        // generate unique filename
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
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
            res.redirect('/login')
        } else {
            next();
        }
    }

    const bcrypt = require('bcrypt');

    // route handler for the home page
    app.get('/', function(req, res) {
        const userLoggedIn = req.session.userId ? true : false;
        const username = userLoggedIn ? req.session.userId : '';
        res.render('index.ejs', {
            forumName: forumData.forumName,
            userLoggedIn: userLoggedIn,
            username: username
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
        const username = userLoggedIn ? req.session.userId : "";
        const role = userLoggedIn ? req.session.role : "";

        res.render("createPost.ejs", {
            forumName: forumData.forumName,
            userLoggedIn: userLoggedIn,
            username: username,
            role: role,
        });
    });

    // route handler for submitting a new post
    app.post("/createPost", upload.single("thumbnail"), function(req, res) {
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

        const {
            title,
            tag,
            description
        } = req.body;
        const thumbnail = req.file ? '/uploads/' + req.file.filename : '';
        const insertPostQuery = "INSERT INTO posts (title, content, thumbnail, username, user_id, tag, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())";
        const insertPostValues = [title, description, thumbnail, req.session.userId, req.session.userDbId, tag];

        db.query(insertPostQuery, insertPostValues, (err, results) => {
            if (err) {
                console.error('Error inserting post into database:', err);
                return res.status(500).render('createPost.ejs', {
                    forumName: forumData.forumName,
                    userLoggedIn: true,
                    username: req.session.userId,
                    role: req.session.role,
                    errors: ['Failed to create post due to database error.']
                });
            }

            const activityQuery = "INSERT INTO recent_activity (user_id, action_type, reference_id, timestamp) VALUES (?, ?, ?, NOW())";
            const activityValues = [req.session.userDbId, 'Create post', results.insertId];

            db.query(activityQuery, activityValues, (activityErr) => {
                if (activityErr) {
                    console.error('Error logging activity:', activityErr);
                }
                res.redirect('/posts');
            });
        });
    });

    // route handler for fetching and rendering posts
    app.get('/posts', function(req, res) {
        db.query('SELECT * FROM posts WHERE isDeleted = 0 ORDER BY created_at DESC', (err, posts) => {
            if (err) {
                console.error('Error fetching posts:', err);
                return res.status(500).send('Error fetching posts');
            }
            res.render('posts.ejs', {
                posts: posts,
                forumName: forumData.forumName,
                userLoggedIn: req.session.userId ? true : false,
                username: req.session.userId
            });
        });
    });

    // route handler for submitting a new post via form submission
    app.post('/posts', redirectLogin, upload.single('thumbnail'), [
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

        const {
            title,
            tag,
            description
        } = req.body;
        const thumbnail = req.file ? req.file.path : '';

        const insertPostQuery = "INSERT INTO posts (title, content, thumbnail, username, user_id, tag, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())";
        const insertPostValues = [title, description, thumbnail, req.session.userId, req.session.userDbId, tag];

        db.query(insertPostQuery, insertPostValues, (err, results) => {
            if (err) {
                console.error('Error inserting post into database:', err);
                return res.status(500).render('createPost.ejs', {
                    forumName: forumData.forumName,
                    userLoggedIn: true,
                    username: req.session.userId,
                    role: req.session.role,
                    errors: ['Failed to create post due to database error.']
                });
            }
            res.redirect('/posts');
        });
    });

    // route handler for viewing a specific post and its comments
    app.get("/view-post/:postId", async function(req, res) {
        try {
            const postId = req.params.postId;
            const order = req.query.order || "DESC";

            if (!postId) {
                return res.status(400).json({
                    message: `Missing required field "postId"`
                });
            }

            db.query(
                "SELECT * FROM posts WHERE isDeleted = FALSE AND id = ?",
                [postId],
                (err, result) => {
                    if (err) {
                        console.error("Error fetching post:", err);
                        return res.status(500).send("Internal Server Error");
                    }

                    if (result.length === 0) {
                        return res.status(404).json({
                            message: "Post not found"
                        });
                    }

                    const post = result[0];

                    const validOrder = ["ASC", "DESC"].includes(order.toUpperCase()) ? order.toUpperCase() : "DESC";
                    const orderClause = `ORDER BY created_at ${validOrder}`;
                    const query = `
                SELECT user_comments.*, userDetails.username, userDetails.profileImage
                FROM user_comments
                JOIN userDetails ON user_comments.user_id = userDetails.id
                WHERE user_comments.isDeleted = FALSE AND user_comments.post_id = ${db.escape(postId)}
                ${orderClause};
            `;

                    db.query(query, (err, comments) => {
                        if (err) {
                            console.error("Error fetching comments:", err);
                            return res.status(500).send("Internal Server Error");
                        }
                        res.render("postDetails.ejs", {
                            post: post,
                            comments: comments,
                            forumName: forumData.forumName,
                            userLoggedIn: req.session.userId ? true : false,
                            username: req.session.username,
                            session: req.session,
                            currentRoute: "/view-post/" + postId,
                            postId: postId,
                            role: req.session.role,
                            tag: post.tag
                        });

                    });
                }
            );
        } catch (error) {
            return res.status(500).json({
                message: error.message
            });
        }
    });

    // route handler for editing a post
    app.get("/edit-post/:postId", redirectLogin, async function(req, res) {
        const userLoggedIn = req.session.userId ? true : false;
        const username = req.session.username || "";
        const role = req.session.role || "";

        const postId = req.params.postId;
        if (!postId) {
            return res.status(400).json({
                message: `Missing required field "postId"`
            });
        }

        db.query("SELECT * FROM posts WHERE id = ?", [postId], (err, postResult) => {
            if (err) {
                console.error("Error fetching post:", err);
                return res.status(500).send("Internal Server Error");
            }
            if (postResult.length === 0) {
                return res.status(404).json({
                    message: "Post not found"
                });
            }
            const post = postResult[0];

            const commentsQuery = `
                SELECT user_comments.*, userDetails.username, userDetails.profileImage
                FROM user_comments
                JOIN userDetails ON user_comments.user_id = userDetails.id
                WHERE user_comments.isDeleted = FALSE AND user_comments.post_id = ?;
            `;
            db.query(commentsQuery, [postId], (err, comments) => {
                if (err) {
                    console.error("Error fetching comments:", err);
                    return res.status(500).send("Internal Server Error");
                }

                res.render("editPost.ejs", {
                    forumName: forumData.forumName,
                    userLoggedIn: userLoggedIn,
                    username: username,
                    role: role,
                    currentRoute: "edit-post",
                    postData: post,
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
            const userId = req.session.userDbId;

            db.query("SELECT * FROM posts WHERE isDeleted = FALSE AND id = ?", [postId], (err, result) => {
                if (err) {
                    console.error("Error fetching post:", err);
                    return res.status(500).send("Internal Server Error");
                }

                if (result.length === 0) {
                    return res.status(404).json({
                        message: "Post not found"
                    });
                }

                const post = result[0];
                if (post.user_id !== userId) {
                    return res.status(403).json({
                        message: "You are not authorized to update this post",
                    });
                }

                const updateData = {
                    edited: 1
                };
                if (req.body.title) updateData.title = req.sanitize(req.body.title);
                if (req.body.tag) updateData.tag = req.body.tag;
                if (req.body.content) updateData.content = req.sanitize(req.body.content);
                if (req.file) {
                    updateData.thumbnail = `/uploads/${req.file.filename}`;
                }
                updateData.updated_at = new Date();

                db.query("UPDATE posts SET ? WHERE id = ?", [updateData, postId], (err, updateResult) => {
                    if (err) {
                        console.error("Error updating post:", err);
                        return res.status(500).send("Internal Server Error");
                    }

                    const activityQuery = "INSERT INTO recent_activity (user_id, action_type, reference_id, timestamp) VALUES (?, 'Update post', ?, NOW())";
                    const activityValues = [userId, postId];

                    db.query(activityQuery, activityValues, (activityErr) => {
                        if (activityErr) {
                            console.error('Error logging update activity:', activityErr);
                        }
                        res.redirect(`/view-post/${postId}`);
                    });
                });
            });
        } catch (error) {
            console.error("Exception handling update:", error);
            return res.status(500).json({
                message: error.message
            });
        }
    });

    // route handler for deleting a post
    app.get("/delete-post/:postId", function(req, res) {
        try {
            const postId = req.params.postId;
            const userId = req.session.userDbId;

            db.query(
                "SELECT user_id, title FROM posts WHERE isDeleted = FALSE AND id = ?",
                [postId],
                (err, result) => {
                    if (err) {
                        console.error("Error checking post ownership:", err);
                        return res.status(500).send("Internal Server Error");
                    }

                    if (result.length === 0) {
                        return res.status(404).json({
                            message: "Post not found"
                        });
                    }

                    const post = result[0];
                    const postUserId = post.user_id;
                    if (postUserId !== userId) {
                        return res.status(403).json({
                            message: "You are not authorized to delete this post"
                        });
                    }

                    db.query(
                        "UPDATE posts SET isDeleted = TRUE WHERE id = ?",
                        [postId],
                        (err, updateResult) => {
                            if (err) {
                                console.error("Error deleting post:", err);
                                return res.status(500).send("Internal Server Error");
                            }

                            const activityQuery = "INSERT INTO recent_activity (user_id, action_type, reference_id, isPublic, timestamp) VALUES (?, 'Delete post', ?, TRUE, NOW())";
                            db.query(activityQuery, [userId, postId], (err, result) => {
                                if (err) {
                                    console.error("Error recording delete post activity:", err);
                                    return res.status(500).send("Internal Server Error");
                                }
                                res.redirect('/');
                            });
                        }
                    );
                }
            );
        } catch (error) {
            return res.status(500).json({
                message: error.message
            });
        }
    });

    // route handler for adding a comment to a post
    app.post("/add-comment", async (req, res) => {
        try {
            const user_id = req.session.userDbId;
            const {
                postId,
                comment
            } = req.body;

            if (!postId || !comment) {
                return res.status(400).json({
                    message: "Add required fields"
                });
            }

            const insertCommentQuery = "INSERT INTO user_comments (user_id, post_id, comment) VALUES (?, ?, ?)";
            db.query(insertCommentQuery, [user_id, postId, comment], (err, result) => {
                if (err) {
                    console.error("Error adding comment to database:", err);
                    return res.status(500).send("Internal Server Error");
                }

                const commentId = result.insertId;
                const insertActivityQuery = `INSERT INTO recent_activity (user_id, reference_id, action_type, isPublic, timestamp) VALUES (?, ?, 'Comment on post', true, NOW())`;

                db.query(insertActivityQuery, [user_id, commentId], (err, result) => {
                    if (err) {
                        console.error("Error while adding activity log to database:", err);
                        return res.status(500).send("Internal Server Error");
                    }
                    return res.redirect(`/view-post/${postId}`);
                });
            });
        } catch (error) {
            return res.status(500).json({
                message: error.message
            });
        }
    });

    // Route handler for fetching comments of a post
    app.get("/post-comments/:id", function(req, res) {
        try {
            let postId = req.params.id;
            if (!postId) {
                return res
                    .status(400)
                    .json({
                        message: `Missing required field "postId"`
                    });
            }

            let order = req.query.order && ["ASC", "DESC"].includes(req.query.order.toUpperCase()) ? req.query.order.toUpperCase() : "ASC";
            let query = `SELECT uc.id, uc.user_id, uc.post_id, uc.comment, uc.created_at, uc.updated_at
                     FROM user_comments uc
                     WHERE uc.post_id = ${postId} AND uc.isDeleted = FALSE
                     ORDER BY uc.created_at ${order}`;

            db.query(query, (err, result) => {
                if (err) {
                    console.error("Error fetching posts:", err);
                    return res.status(500).send("Internal Server Error");
                }

                // Since we are not grouping votes, we can directly return the comments
                return res.status(200).json({
                    comments: result
                });
            });
        } catch (error) {
            return res.status(500).json({
                message: error.message
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
        const username = req.sanitize(req.body.username.toLowerCase());
        const password = req.body.password;

        let sqlQuery = "SELECT id, username, hashedPassword FROM userDetails WHERE username = ?";
        db.query(sqlQuery, [username], (err, result) => {
            if (err) {
                console.error(err);
                return res.status(500).send("Error accessing the database. Please try again later.");
            }

            if (result.length > 0) {
                const userDbId = result[0].id;
                const storedUsername = result[0].username;
                const hashedPassword = result[0].hashedPassword;

                bcrypt.compare(password, hashedPassword, function(err, isMatch) {
                    if (err) {
                        console.error(err);
                        return res.status(500).send("Error. Please try again later.");
                    } else if (isMatch) {
                        let updateLoginTimeSql = "UPDATE userDetails SET lastlogin = NOW() WHERE id = ?";
                        db.query(updateLoginTimeSql, [userDbId], (updateErr, updateResult) => {
                            if (updateErr) {
                                console.error(updateErr);
                                return res.status(500).send("Error updating login time. Please try again later.");
                            }

                            req.session.userId = storedUsername;
                            req.session.userDbId = userDbId;

                            res.redirect('/');
                        });
                    } else {
                        res.render('login.ejs', {
                            forumName: forumData.forumName,
                            errorMessage: 'Incorrect username or password'
                        });
                    }
                });
            } else {
                res.render('login.ejs', {
                    forumName: forumData.forumName,
                    errorMessage: 'User not found. Please try again.'
                });
            }
        });
    });

    // route handler for user logout
    app.get('/logout', (req, res) => {
        req.session.destroy(err => {
            if (err) {
                console.error(err);
            }
            res.redirect('/');
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
        check('email').isEmail().withMessage('Please enter a valid email address'),
    ], function(req, res) {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            const errorMessages = errors.array().map(error => error.msg);
            return res.render('register.ejs', {
                forumName: forumData.forumName,
                errorMessage: errorMessages.join('<br>'),
                successMessage: ''
            });
        } else {
            const saltRounds = 10;
            const plainPassword = req.body.password;

            bcrypt.hash(plainPassword, saltRounds, function(err, hashedPassword) {
                if (err) {
                    return res.render('register.ejs', {
                        forumName: forumData.forumName,
                        errorMessage: 'An error occurred during password encryption.',
                        successMessage: ''
                    });
                }

                const firstName = req.sanitize(req.body.first);
                const lastName = req.sanitize(req.body.last);
                const email = req.sanitize(req.body.email);
                const username = req.sanitize(req.body.username.toLowerCase());

                let checkExistingQuery = "SELECT * FROM userDetails WHERE email = ? OR LOWER(username) = ?";
                let checkExistingValues = [req.body.email, username];

                db.query(checkExistingQuery, checkExistingValues, (err, results) => {
                    if (err) {
                        return res.render('register.ejs', {
                            forumName: forumData.forumName,
                            errorMessage: 'Database error while checking existing user details.',
                            successMessage: ''
                        });
                    }

                    if (results.length > 0) {
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
                        let insertQuery = "INSERT INTO userDetails (username, first, last, email, hashedPassword, joindate, lastlogin) VALUES (?, ?, ?, ?, ?, NOW(), NULL)";
                        let newUser = [username, req.body.first, req.body.last, req.body.email, hashedPassword];

                        db.query(insertQuery, newUser, (err, result) => {
                            if (err) {
                                return res.render('register.ejs', {
                                    forumName: forumData.forumName,
                                    errorMessage: 'Database error while registering new user',
                                    successMessage: ''
                                });
                            } else {
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

        db.query('SELECT id, username, email, joindate, lastlogin, profileImage FROM userDetails WHERE id = ?', [userId], (err, userDetailsResult) => {
            if (err) {
                console.error('Error fetching user details:', err);
                return res.status(500).send('Internal Server Error');
            }

            if (userDetailsResult.length > 0) {
                const userDetails = userDetailsResult[0];
                // default image
                userDetails.profileImage = userDetails.profileImage || '/assets/primogem.png';

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

                db.query(activityQuery, [userId], (err, activityResult) => {
                    if (err) {
                        console.error('Error fetching recent activity:', err);
                        return res.status(500).send('Internal Server Error');
                    }

                    res.render('myAccount.ejs', {
                        forumName: forumData.forumName,
                        userDetails: userDetails,
                        userLoggedIn: true,
                        username: req.session.userId,
                        userActivity: activityResult,
                        userId: userId
                    });
                });
            } else {
                res.redirect('/login');
            }
        });
    });

    // route handler for deleting user account
    app.post('/delete-account', redirectLogin, function(req, res) {
        const userId = req.session.userDbId;

        const deletePostsQuery = 'UPDATE posts SET isDeleted = TRUE WHERE user_id = ?';
        db.query(deletePostsQuery, [userId], (err, postResult) => {
            if (err) {
                console.error('Error marking posts as deleted:', err);
                return res.status(500).send('Internal Server Error');
            }

            db.query('DELETE FROM userDetails WHERE id = ?', [userId], (err, userResult) => {
                if (err) {
                    console.error('Error deleting user account from the database:', err);
                    return res.status(500).send('Internal Server Error');
                }

                req.session.destroy(err => {
                    if (err) {
                        console.error(err);
                    }
                    res.redirect('/');
                });
            });
        });
    });

    // route handler for searching posts
    app.get('/search-posts', function(req, res) {
        const searchTerm = req.query.term;
        if (!searchTerm) {
            res.render('posts.ejs', {
                posts: [],
                noPostsFound: true,
                forumName: forumData.forumName,
                userLoggedIn: req.session.userId ? true : false,
                username: req.session.userId
            });
        } else {
            const searchQuery = "SELECT * FROM posts WHERE (title LIKE ? OR content LIKE ?) AND isDeleted = FALSE ORDER BY created_at DESC";
            db.query(searchQuery, [`%${searchTerm}%`, `%${searchTerm}%`], (err, posts) => {
                if (err) {
                    console.error('Error fetching search results:', err);
                    return res.status(500).send('Error fetching search results');
                }
                if (posts.length === 0) {
                    res.render('posts.ejs', {
                        posts: [],
                        noPostsFound: true,
                        forumName: forumData.forumName,
                        userLoggedIn: req.session.userId ? true : false,
                        username: req.session.userId
                    });
                } else {
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
        const deleteQuery = `
        UPDATE user_comments
        SET isDeleted = TRUE
        WHERE id = ? AND user_id = ?
    `;
        db.query(deleteQuery, [commentId, userId], (err, result) => {
            if (err) {
                console.error("Error deleting comment:", err);
                return res.status(500).send("Internal Server Error");
            }
            if (result.affectedRows === 0) {
                return res.status(404).json({
                    message: "No comment found or you do not have permission to delete this comment"
                });
            }
            res.json({
                success: true,
                message: "Comment deleted successfully"
            });
        });
    });

    // route handler for updating profile image
    app.post('/update-profile-image', redirectLogin, upload.single('profileImage'), (req, res) => {
        const userId = req.session.userDbId;

        if (!req.file) {
            return res.status(400).send('No file uploaded.');
        }

        const profileImagePath = '/uploads/' + req.file.filename;

        const updateQuery = "UPDATE userDetails SET profileImage = ? WHERE id = ?";
        db.query(updateQuery, [profileImagePath, userId], (err, result) => {
            if (err) {
                console.error('Error updating user profile image:', err);
                return res.status(500).send('Internal Server Error');
            }
            res.redirect('/myAccount');
        });
    });

    // route handler for fetching posts by tag
    app.get('/posts/tag/:tag', function(req, res) {
        const tag = req.params.tag;
        db.query('SELECT * FROM posts WHERE tag = ? AND isDeleted = 0 ORDER BY created_at DESC', [tag], (err, posts) => {
            if (err) {
                console.error('Error fetching posts by tag:', err);
                return res.status(500).send('Error fetching posts');
            }
            if (posts.length === 0) {
                res.render('posts.ejs', {
                    posts: [],
                    noPostsFound: true,
                    tag: tag,
                    forumName: forumData.forumName,
                    userLoggedIn: req.session.userId ? true : false,
                    username: req.session.userId
                });
            } else {
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
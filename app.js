if (process.env.NODE_ENV !== "production") {
    require('dotenv').config();
}

//express
const express = require('express');
const app = express()
const path = require('path');

const ejsMate = require("ejs-mate")
const mongoose = require('mongoose');
const methodOverride = require('method-override')

const session = require('express-session');
const flash = require('connect-flash');

const Blog = require('./models/posts.js');
const Admin = require('./models/admins.js');

const passport = require('passport')
const LocalStrategy = require('passport-local');

const mongoSanitize = require('express-mongo-sanitize');

//image uploadui:
const multer = require('multer');
const { storage, cloudinary } = require('./cloudinaryFolder');
const upload = multer({ storage });

const MongoDBStore = require('connect-mongo');

const helmet = require('helmet')

app.use(express.static(path.join(__dirname, 'public')))
app.engine('ejs', ejsMate);
app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, 'views')) // so you can render('index')
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }))
app.use(methodOverride('_method'));
app.use(mongoSanitize());

const db_url = process.env.DB_URL || 'mongodb://localhost:27017/blog';

//session!!! -------------------------------------------
const store = new MongoDBStore({
    mongoUrl: db_url,
    touchAfter: 24 * 60 * 60 //laikas kada atfreshina in millisekundemis
})

store.on("error", function(e) {
    console.log("Session store error")
})
const secret = process.env.SECRET || 'paslaptis';

app.use(flash());
app.use(session({
    store,
    secret,
    name: 'blogSesija',
    resave: false,
    saveUninitialized: true, //REIKIA PRIDETI STORE!!!!
    cookie: {
        secure: true,
        httpOnly: true,
        expires: Date.now() + 1000 * 60 * 60 * 24 * 7, // viena savaite galioja
        maxAge: 1000 * 60 * 60 * 24 * 7
    }
}))

app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(Admin.authenticate()));
passport.serializeUser(Admin.serializeUser());
passport.deserializeUser(Admin.deserializeUser());
app.use(
    helmet({
        contentSecurityPolicy: false,
    })
);


//MONGO DB_------------------------------------------------------------------------------------------------------------

//mongodb://localhost:27017/blog
mongoose.connect(db_url, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useCreateIndex: true,
    useFindAndModify: false
});

const db = mongoose.connection;
db.on("error", console.error.bind(console, "connection error:"));
db.once("open", () => {
    console.log("Database connected")
});

// -------------------- DATE ---------------------------------
var objToday = new Date(),

    domEnder = function() {
        var a = objToday;
        if (/1/.test(parseInt((a + "").charAt(0)))) return "th";
        a = parseInt((a + "").charAt(1));
        return 1 == a ? "st" : 2 == a ? "nd" : 3 == a ? "rd" : "th"
    }(),
    dayOfMonth = today + (objToday.getDate() < 10) ? '0' + objToday.getDate() + domEnder : objToday.getDate() + domEnder,
    months = new Array('January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'),
    curMonth = months[objToday.getMonth()],
    curYear = objToday.getFullYear(),
    curHour = objToday.getHours(),
    curMinute = objToday.getMinutes() < 10 ? "0" + objToday.getMinutes() : objToday.getMinutes();

var today = curHour + ":" + curMinute + " " + dayOfMonth + " of " + curMonth + ", " + curYear;

console.log(today)

const isLoggedIn = (req, res, next) => {
    if (!req.isAuthenticated()) {
        req.flash('error', 'You should be logged in as administrator!')
        return res.redirect('/')
    }
    next();
}
const isTester = (req, res, next) => {
    if (req.user.tester == true) {
        req.flash('error', 'You are not allowed to do that with this account!')
        return res.redirect('/')
    }
    next();
}

app.use((req, res, next) => {
    res.locals.currentUser = req.user;
    res.locals.success = req.flash('success');
    res.locals.error = req.flash('error');
    next();
})

app.get('/', async(req, res) => {
    const blogPosts = await Blog.find({})
    const admins = await Admin.find({})
    res.render("index", { blogPosts, admins })
})

app.get('/register', function(req, res) {
    res.render("action/register")
})

app.post('/register', upload.single('avataras'), async(req, res, next) => {
    const { email, username, text, content, password } = req.body;
    try {
        if (text.length > 240) {
            req.flash('error', 'The text about you cannot be longer than 240 symbols!');
            return res.redirect("/account");
        }
        if (req.file) {
            const linkas = req.file.path.replace('/upload', '/upload/ar_1:1,c_fill,g_auto,q_100,r_max,w_1000');
            parametrai = { email: email, username: username, aboutMe: text, avatarImage: { url: req.file.path, filename: req.file.filename } };

        } else {
            parametrai = { email: email, username: username, aboutMe: text };
        }
        const user = new Admin(parametrai);
        const registeredUser = await Admin.register(user, password);
        req.login(registeredUser, err => { // loginam nauja useri in!
            if (err) return next(err);
            req.flash('success', 'The admin was created!');
            res.redirect("/");
        })
    } catch (e) {
        req.flash('error', e.message)
        res.redirect("/register");
    }
})

app.get('/login', function(req, res) {
    res.render("action/login")
})

app.post('/login', passport.authenticate('local', { failureFlash: true, failureRedirect: '/login' }), function(req, res) {
    req.flash('success', 'Welcome back!')
    res.redirect('/')
})

app.get('/logout', function(req, res) {
    req.logout();
    req.flash('success', 'You logged out successfully!')
    res.redirect('/')
})

app.get('/create', isLoggedIn, function(req, res) {
    res.render("action/create")
})

app.post('/create', isLoggedIn, isTester, async(req, res) => {
    const { vardas, title, afterTitle, content } = req.body;
    const blog = new Blog({ author: req.user.username, title: title, subheading: afterTitle, body: content, date: today })
    await blog.save()
    req.flash('success', 'The post was created!')
    res.redirect("/")
})

app.get('/account', isLoggedIn, (req, res) => {
    const admin = req.user;
    res.render("action/account", { admin })
})

app.put('/account', isLoggedIn, isTester, upload.single('avataras'), async(req, res) => {
    const obj = JSON.parse(JSON.stringify(req.body));
    const { username, email, text } = obj;
    try {
        if (text.length > 240) {
            req.flash('error', 'The text about you cannot be longer than 240 symbols!');
            return res.redirect("/account");
        }
        if (req.user.username !== username) {
            if (req.file) {
                cloudinary.uploader.destroy(req.user.avatarImage.filename);
                const linkas = req.file.path.replace('/upload', '/upload/ar_1:1,c_fill,g_auto,q_100,r_max,w_1000');
                parametrai = { email: email, username: username, aboutMe: text, avatarImage: { url: linkas, filename: req.file.filename } };
            } else {
                parametrai = { email: email, username: username, aboutMe: text };
            }
            await Admin.findByIdAndUpdate(req.user.id, parametrai);
            req.flash('success', 'Your account was updated! You must re-login.');
            return res.redirect("/");
        } else {
            if (req.file) {
                cloudinary.uploader.destroy(req.user.avatarImage.filename);
                const linkas = req.file.path.replace('/upload', '/upload/ar_1:1,c_fill,g_auto,o_100,r_max,w_234');
                parametrai = { email: email, username: username, aboutMe: text, avatarImage: { url: linkas, filename: req.file.filename } };
            } else {
                parametrai = { email: email, username: username, aboutMe: text };
            }
            await Admin.findByIdAndUpdate(req.user.id, parametrai);
            req.flash('success', 'Your account was updated!');
            return res.redirect("/account");
        }
    } catch (e) {
        req.flash('error', e.message)
        res.redirect("/account");
    }
})

app.get('/edit/:id', isLoggedIn, async(req, res) => {
    const { id } = req.params;
    const blog = await Blog.findById(id);
    if (!blog) {
        req.flash('error', 'Such a post is not existing!');
        return res.redirect("/");
    }
    res.render("action/edit", { blog })
})

app.put('/edit/:id', isLoggedIn, isTester, async(req, res) => {
    const { id } = req.params;
    const { title, afterTitle, content } = req.body;
    const blog = await Blog.findByIdAndUpdate(id, { title: title, subheading: afterTitle, body: content });
    await blog.save()
    req.flash('success', 'The post was updated!')
    res.redirect("/")
})

app.delete('/edit/:id', isLoggedIn, async(req, res) => {
    const { id } = req.params;
    await Blog.findByIdAndDelete(id);
    req.flash('success', 'The post was deleted!')
    res.redirect("/")
})

app.all('*', (req, res) => {
    res.render("action/error")
})

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Example app listening at http://localhost:${port}`)
})
// Load dependencies
const express = require('express');
const path = require('path');
const favicon = require('serve-favicon');
const logger = require('morgan');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const passport = require('passport');
const jwt = require('jwt-simple');

// Load configurations
const config = require('./config/database');

// Load routes
//const index = require('./routes/index');
const threads = require('./routes/threads');
const boards = require('./routes/boards');
const users = require('./routes/users');
const admins = require('./routes/admins');
const settings = require('./routes/settings');

const app = express();

// View engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

// Middleware

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use(express.static(path.join(__dirname, 'public')));

// Use the passport package
app.use(passport.initialize());

// Database setup
mongoose.Promise = require('bluebird'); // Setup promise library
mongoose.connect(config.database, (err, res) => {
  if(err){
    console.log(`> ERROR CONNCETING TO DATABASE: ${err} \n`);
  }
  else{
    console.log('> CONNECTED TO DATABASE \n');
  }
});

/* DEV ONLY*/
app.use(function(req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, authorization');
  // intercept OPTIONS method
  if ('OPTIONS' == req.method) {
    res.sendStatus(200);
  }
  else {
    next();
  }
});

//app.use('/', index);
app.use('/user', users);
app.use('/board', boards);
app.use('/thread', threads);
app.use('/admin', admins);
app.use('/settings', settings);

// catch 404 and forward to error handler
app.use((req, res, next) => {
  const err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handler
app.use((err, req, res, next) => {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;

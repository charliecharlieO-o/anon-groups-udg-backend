const express = require('express')
const shortid = require('shortid')
const passport = require('passport')
const router = express.Router()
const asyncMid = require('./asyncmid') // Async

// DB & Models
const mongoose = require('mongoose')
const Board = require('../models/board')
const User = require('../models/user')
const Thread = require('../models/thread')
const Reply = require('../models/reply')

const settings = require('../config/settings') //System settings
const utils = require('../config/utils') //System utils

// Include passport module as passport strategy
require('../config/passport')(passport)

//=================================================================================
//									--	THREADS --
//=================================================================================

const thread_list_default = '_id title board poster text media reply_count reply_excerpts created_at'

/* GET X Hot Threads overall */
router.get('/hot-top', passport.authenticate('jwt', {'session': false}), asyncMid(async (req, res, next) => {
  const threads = await Thread.find(
    { 'alive': true }
  ).select(
    thread_list_default
  ).sort(
    { 'thread_decay': -1 }
  ).limit(
    settings.creme_of_the_top_max
  )
  if (!threads) {
    res.status(404).send('Resource not found')
  } else {
    res.json({ 'success': true, 'doc': threads })
  }
}))

/* GET X New Threads overall */
router.get('/new-overall', passport.authenticate('jwt', {'session': false}), asyncMid(async (req, res, next) => {
  const threads = await Thread.find(
    { 'alive': true }
  ).select(
    thread_list_default
  ).sort(
    { 'created_at': -1 }
  ).limit(
    settings.creme_of_the_top_max
  )
  if (!threads) {
    res.status(404).send('Resource not found')
  } else {
    res.json({ 'success': true, 'doc': threads })
  }
}))

/* GET thread based on shortid */
router.get('/:thread_id', passport.authenticate('jwt', {'session': false}), asyncMid(async (req, res, next) => {
  const thread = await Thread.findOne({ '_id': req.params.thread_id, 'alive': true })
  if (!thread) {
    res.status(404).send('Resource not found')
  } else {
    res.json({ 'success': true, 'doc': thread })
  }
}))

/* GET dead thread */
router.get('/dead/:thread_id', passport.authenticate('jwt', {'session': false}), asyncMid(async (req, res, next) => {
  if(req.user.data.is_super){
    const thread = await Thread.findOne({ '_id': req.params.thread_id, 'alive': false })
    if (!thread) {
      res.status(404).send('Resource not found')
    } else {
      res.json({ 'success': true, 'doc': thread })
    }
  } else {
    res.status(401).send('Unauthorized')
  }
}))

/* POST new thread to board (User protected) */
router.post('/:board_slug/post', passport.authenticate('jwt', {'session': false}), utils.uploadMediaFile.single('mfile'),
asyncMid(async (req, res, next) => {
  // Check if user can post, Check last time user posted a thread
  if(utils.hasRequiredPriviledges(req.user.data.priviledges, ['can_post'])){
    const board = await Board.findOne({ 'slug': req.params.board_slug, 'active': true }, '_id')
    if (!board) {
      res.status(404).send('Board doesnt exist')
    } else {
      // Prepare poster file
      let poster = null
      if(req.user.data.alias.handle != null) {
        poster = {
          'name': req.user.data.alias.handle,
          'thumbnail': null,
          'id': req.user.data.alias.anonId,
          'anon': true
        }
      } else {
        poster = {
          'name': req.user.data.username,
          'thumbnail': (req.user.data.profile_pic.thumbnail == null)? null: req.user.data.profile_pic.thumbnail,
          'id': req.user.data._id,
          'anon': false
        }
      }
      // Prepare thread file
      let newThread = new Thread({
        'board': board._id,
        'poster': poster,
        'title': req.body.title,
        'text': req.body.text,
        'media': null,
        'reply_excerpts': []
      })
      // We should validate data here
      // Create thumbnail and add file to thread if Uploaded
      const file = await utils.uploadMediaToS3(req.file)
      if(file){
        newThread.media = {
          'name': file.originalname,
          'location': `${file.tourl}/${file.filename}`,
          'mimetype': file.mimetype,
          'size': file.size,
          'thumbnail': (file == null)? null : `${file.tourl}/${file.thumbname}`
        }
      }
      const thread = await Thread.create(newThread)
      if (!thread) {
        res.status(500).send('Error posting thread')
      } else {
        res.json({ 'success': true, 'doc': thread })
      }
    }
  } else {
    res.status(401).send('Unauthorized')
  }
}))

/* GET thread's with specific related board ordered by relevance limit X */
router.get('/list/hot/:board_slug', passport.authenticate('jwt', {'session': false}), (req, res) => {
  Board.findOne({ 'slug': req.params.board_slug, 'active': true }, '_id', (err, board) => {
    if(err || !board){
      res.json({ 'success': false, 'error': 105 })
    } else {
      Thread.find(
        { 'board': board._id, 'alive': true }
      ).select(
        thread_list_default
      ).sort(
        { 'thread_decay': -1 }
      ).limit(
        settings.max_thread_search_resutls
      ).exec((err, threads) => {
        if(err || !threads)
        res.json({ 'success': false })
        else
        res.json({ 'success': true, 'doc': threads })
      })
    }
  })
})

/* GET thread's with specific related board ordered by date limit X */
router.get('/list/new/:board_slug', passport.authenticate('jwt', {'session': false}), (req, res) => {
  Board.findOne({ 'slug': req.params.board_slug, 'active': true }, '_id', (err, board) => {
    if(err || !board){
      res.json({ 'success': false, 'error': 105 })
    } else {
      Thread.find(
        { 'board': board._id, 'alive': true }
      ).select(
        thread_list_default
      ).sort(
        { 'created_at': -1 }
      ).limit(
        settings.max_thread_search_resutls
      ).exec((err, threads) => {
        if(err || !threads)
        res.json({ 'success': false })
        else
        res.json({ 'success': true, 'doc': threads })
      })
    }
  })
})

/* GET last N removed threads overall */
router.get('/list/removed/', passport.authenticate('jwt', {'session': false}), asyncMid(async (req, res, next) => {
  if(req.user.data.is_super){
    const threads = await Thread.find(
      { 'alive': false }
    ).select(
      thread_list_default
    ).sort(
      { 'created_at': -1 }
    ).limit(
      settings.max_thread_search_resutls
    )
    if (!threads) {
      res.status(404).send('Resource not found')
    } else {
      res.json({ 'success': true, 'doc': threads })
    }
  } else {
    res.status(401).send('Unauthorized')
  }
}))

/* GET last N removed threads from a board */
router.get('/list/removed/:board_slug', passport.authenticate('jwt', {'session': false}), asyncMid(async (req, res, next) => {
  if(req.user.data.is_super){
    const board = await Board.findOne({ 'slug': req.params.board_slug, 'active': true }, '_id')
    if (!board) {
      res.status(404).send('Board not found')
    } else {
      const thread = await Thread.find(
        { 'board': board._id, 'alive': false }
      ).select(
        thread_list_default
      ).sort(
        { 'created_at': -1 }
      ).limit(
        settings.max_thread_search_resutls
      )
      if (!threads) {
        res.status(404).send('Resource not found')
      } else {
        res.json({ 'success': true, 'doc': threads })
      }
    }
  } else {
    res.status(401).send('Unauthorized')
  }
}))

/* PUT update thread status to alive or dead */ //(GENERATES NOTIFICATION)
router.put('/kill/:thread_id', passport.authenticate('jwt', {'session': false}), asyncMid(async (req, res, next) => {
  // Check if user can kill thread
  if(req.user.data.is_super || utils.hasRequiredPriviledges(req.user.data.priviledges, ['delete_thread'])){
    const thread = await Thread.findOneAndUpdate({ '_id': req.params.thread_id, 'alive': true },
    {
      '$set': {
        'alive': false
      }
    }, { 'new': true })
    if (!thread) {
      res.status(500).send('Error updating thread')
    } else {
      // Send notification to OP
      utils.createAndSendNotification(thread.poster.id, thread.poster.anon, req.user.data, 'Your content was removed',
      `Your reply was removed due to ${req.body.reason}`, null)
      res.json({ 'success': true })
    }
  } else {
    res.status(401).send('Unauthorized')
  }
}))

/* POST search for a thread based on title and board */
router.post('/search', passport.authenticate('jwt', {'session': false}), asyncMid(async (req, res, next) => {
  const threads = await Thread.find(
    { '$text': { '$search': req.body.query }, 'board': req.body.board_id },
    { 'score': { '$meta': 'textScore'}}
  ).select(
    thread_list_default
  ).sort(
    { 'score': { '$meta': 'textScore' }}
  ).limit(
    settings.max_thread_search_resutls
  )
  if (!threads){
    res.status(404).send('Resource not found')
  } else {
    res.json({ 'success': true, 'doc': threads })
  }
}))

//=================================================================================
//									--	REPLIES --
//=================================================================================

/* GET replies to a thread based on thread's id with subReply field */
router.get('/:thread_id/replies', passport.authenticate('jwt', {'session': false}), asyncMid(async (req, res, next) => {
  const replies = await Reply.find({ 'thread': req.params.thread_id, 'removed': false })
  if (!replies) {
    res.status(404).send('Resource not found')
  } else {
    res.json({ 'success': true, 'doc': replies })
  }
}))

/* POST get replies after timestam */
router.post('/:thread_id/replies/since', passport.authenticate('jwt', {'session': false}), asyncMid(async (req, res, next) => {
  const date = new Date(req.body.date)
  const replies = await Reply.find({
    'thread': req.params.thread_id,
    'removed': false,
    'created_at': { '$gt': req.body.date }
  })
  if (!replies) {
    res.staus(404).send('Resource not found')
  } else {
    res.json({ 'success': true, 'doc': replies })
  }
}))

/* GET replies to a thread based on thread's shortid without subReply field */
router.get('/:thread_id/replies/nosub', passport.authenticate('jwt', {'session': false}), asyncMid(async (req, res, next) => {
  const replies = await Reply.find({ 'thread': req.params.thread_id, 'removed': false }, { 'replies': 0 })
  if (!replies) {
    res.staus(404).send('Resource not found')
  } else {
    res.json({ 'success': true, 'doc': replies })
  }
}))

/* GET replies to a thread with limited subReplies on sight */
router.get('/:thread_id/replies/limit-sub', passport.authenticate('jwt', {'session': false}), asyncMid(async (req, res, next) => {
  const replies = await Reply.find({ 'thread': req.params.thread_id, 'removed': false }, { 'replies': { '$slice': [0,2] }})
  if (!replies) {
    res.staus(404).send('Resource not found')
  } else {
    res.json({ 'success': true, 'doc': replies })
  }
}))

/* GET reply without subreplies based on id */
router.get('/replies/:reply_id/nosub', passport.authenticate('jwt', {'session': false}), asyncMid(async (req, res, next) => {
  const reply = await Reply.findOne({ '_id': req.params.reply_id, 'removed': false }, { replies: 0 })
  if (!reply) {
    res.staus(404).send('Resource not found')
  } else {
    res.json({ 'success': true, 'doc': reply })
  }
}))

/* GET reply with subreplies based on id */
router.get('/replies/:reply_id', passport.authenticate('jwt', {'session': false}), asyncMid(async (req, res, next) => {
  const reply = await Reply.findOne({ '_id': req.params.reply_id, 'removed': false })
  if (!reply) {
    res.staus(404).send('Resource not found')
  } else {
    res.json({ 'success': true, 'doc': reply })
  }
}))

/* GET reply's last updated timestamp */
router.get('/replies/:reply_id/get-last-update', passport.authenticate('jwt', {'session': false}), asyncMid(async (req, res, next) => {
  const reply = await Reply.findOne({ '_id': req.params.reply_id, 'removed': false }, 'updated_at')
  if (!reply) {
    res.status(404).send('Resource not found')
  } else {
    res.json({ 'success': true, 'doc': reply.updated_at })
  }
}))

/* POST a new comment to a thread based on shortid */ //(GENERATES NOTIFICATION)
router.post('/:thread_id/reply', passport.authenticate('jwt', {'session': false}), utils.uploadMediaFile.single('mfile'),
  asyncMid(async (req, res, next) => {
  if(utils.hasRequiredPriviledges(req.user.data.priviledges, ['can_reply'])){
    const thread = await Thread.findOne({ '_id': req.params.thread_id, 'alive': true, 'reply_count': { '$lt':settings.max_thread_replies }})
    if (!thread) {
      res.status(404).send('Thread not found')
    } else {
      // Build poster file
      let poster = null
      if (req.user.data.alias.handle != null) {
        poster = {
          'poster_name': req.user.data.alias.handle,
          'poster_thumbnail': null,
          'poster_id': req.user.data.alias.anonId,
          'anon': true
        }
      } else {
        poster = {
          'poster_name': req.user.data.username,
          'poster_thumbnail': (req.user.data.profile_pic.thumbnail == null)? null: req.user.data.profile_pic.thumbnail,
          'poster_id': req.user.data._id,
          'anon': false
        }
      }
      // Build reply
      let newReply = new Reply({
        'thread': thread._id,
        'poster': poster,
        'text': req.body.text,
        'media': null,
        'replies': []
      })
      // Create thumbnail and add file to reply if Uploaded
      const file = await utils.uploadMediaToS3(req.file)
      // Add media to reply
      if (file) {
        newReply.media = {
          'name': file.originalname,
          'location': `${file.tourl}/${file.filename}`,
          'mimetype': file.mimetype,
          'size': file.size,
          'thumbnail': (file == null)? null : `${file.tourl}/${file.thumbname}`
        }
      }
      // Save Reply
      const reply = await Reply.create(newReply)
      if (!reply) {
        res.json({'success': false})
      } else {
        // Return a successfull response
        res.json({ 'success': true, 'doc': reply })
        // Notificate OP about reply if not OP
        const rp = (req.user.data.alias.handle != null)? req.user.data.alias.handle : req.user.data.username
        utils.createAndSendNotification(thread.poster.id, thread.poster.anon, req.user.data, 'New Thread Reply',
        `${rp} replied to your thread`, { 'type': 'threadReply', 'threadId': thread._id, 'replyId': reply._id })
        // Bump Thread
        thread.bumpThread()
      }
    }
  } else {
    res.status(401).send('Unauthorized')
  }
}))

/* POST a Reply to a Comment */ //(GENERATES NOTIFICATION)
router.post('/:thread_id/replies/:reply_id/reply', passport.authenticate('jwt', {'session': false}),
  utils.uploadMediaFile.single('mfile'), asyncMid(async (req, res, next) => {
  if (utils.hasRequiredPriviledges(req.user.data.priviledges, ['can_reply'])) {
    const thread = await Thread.findById(req.params.thread_id, 'alive reply_count')
    if (!thread || !thread.alive || thread.reply_count >= settings.max_thread_replies){
      res.status(404).send('Thread Not Found')
    } else {
      const reply = await Reply.findOne({ '_id': req.params.reply_id, 'reply_count': { '$lt': settings.max_reply_subreplies }})
      if (!reply){
        res.status(404).send('Reply not found')
      } else {
        // Prepare poster SubDoc
        let poster = null
        if(req.user.data.alias.handle != null) {
          poster = {
            'poster_name': req.user.data.alias.handle,
            'poster_thumbnail': null,
            'poster_id': req.user.data.alias.anonId,
            'anon': true
          }
        } else {
          poster = {
            'poster_name': req.user.data.username,
            'poster_thumbnail': req.user.data.profile_pic.thumbnail,
            'poster_id': req.user.data._id,
            'anon': false
          }
        }
        // Prepare SubDocument
        let subReply = {
          '_id': mongoose.Types.ObjectId(),
          'poster': poster,
          'to': {
            'poster_name': reply.poster.poster_name,
            'poster_id': reply.poster.poster_id,
            'poster_thumbnail': reply.poster.poster_thumbnail,
            'anon': reply.poster.anon
          },
          'text': req.body.text,
          'media': null
        }
        const file = await utils.uploadMediaToS3(req.file)
        // Add media to reply
        if (file) {
          subReply.media = {
            'name': file.originalname,
            'location': `${file.tourl}/${file.filename}`,
            'mimetype': file.mimetype,
            'size': file.size,
            'thumbnail': (file == null)? null : `${file.tourl}/${file.thumbname}`
          }
        }
        // Push to subreply array
        await reply.update({ '$push': { 'replies': subReply }, '$inc': { 'reply_count': 1 }}, { 'runValidators': true })
        // Respond request
        res.json({ 'success': true, 'doc': subReply })
        // Notificate OP (if 'to' isn't OP)
        const rp = (req.user.data.alias.handle != null)? req.user.data.alias.handle : req.user.data.username
        if (reply.poster.poster_id !== subReply.to.poster_id) {
          utils.createAndSendNotification(reply.poster.poster_id, reply.poster.anon, req.user.data, 'Reply Under',
          `${rp} replied under your comment.`, { 'type': 'replyunder', 'threadId': thread._id, 'replyId': reply._id })
        }
        // Send notification to 'TO'
        utils.createAndSendNotification(subReply.to.poster_id, subReply.to.anon, req.user.data, 'New Reply',
        `${rp} replied to you.`, { 'type': 'reply', 'threadId': thread._id, 'replyId': reply._id })
      }
    }
  } else {
    res.status(401).send('Unauthorized')
  }
}))

/* POST a Reply to a Reply */
router.post('/:thread_id/replies/:reply_id/:sub_id/reply', passport.authenticate('jwt', {'session': false}),
  utils.uploadMediaFile.single('mfile'), asyncMid(async (req, res, next) => {
  if (utils.hasRequiredPriviledges(req.user.data.priviledges, ['can_reply'])) { // Check priviledges
    const thread = await Thread.findById(req.params.thread_id, 'alive reply_count') // FInd current thread
    if (!thread || !thread.alive || thread.reply_count >= settings.max_thread_replies) {
      res.status(404).send('Thread Not Found')
    } else {
      const reply = await Reply.findOne({ '_id': req.params.reply_id, 'replies._id':req.params.sub_id,
      'reply_count': { '$lt': settings.max_reply_subreplies }})
      if (!reply) {
        res.status(404).send('Reeply not found')
      }  else {
        const subreply = reply.replies.id(req.params.sub_id)
        // Prepare poster SubDoc
        let poster = null
        if(req.user.data.alias.handle != null) {
          poster = {
            'poster_name': req.user.data.alias.handle,
            'poster_thumbnail': null,
            'poster_id': req.user.data.alias.anonId,
            'anon': true
          }
        } else {
          poster = {
            'poster_name': req.user.data.username,
            'poster_thumbnail': req.user.data.profile_pic.thumbnail,
            'poster_id': req.user.data._id,
            'anon': false
          }
        }
        // Prepare SubDocument
        let newSubReply = {
          '_id': mongoose.Types.ObjectId(),
          'poster': poster,
          'to': {
            'poster_name': subreply.poster.poster_name,
            'poster_id': subreply.poster.poster_id,
            'poster_thumbnail': subreply.poster.poster_thumbnail,
            'anon': reply.poster.anon
          },
          'media': null,
          'text': req.body.text
        }
        const file = await utils.uploadMediaToS3(req.file)
        // Add media to reply
        newSubReply.media = (file)?
        {
          'name': file.originalname,
          'location': `${file.tourl}/${file.filename}`,
          'mimetype': file.mimetype,
          'size': file.size,
          'thumbnail': (file == null)? null : `${file.tourl}/${file.thumbname}`
        }: null
        // Push to subreply array
        await reply.update({ '$push': { 'replies': newSubReply }, '$inc': { 'reply_count': 1 }}, { 'runValidators': true })
        // Respond to reuest
        res.json({ 'success': true, 'doc': newSubReply })
        // Notificate OP (if 'to' isn't OP)
        const rp = (req.user.data.alias.handle != null)? req.user.data.alias.handle : req.user.data.username
        if (reply.poster.poster_id !== newSubReply.to.poster_id) {
          utils.createAndSendNotification(reply.poster.poster_id, reply.poster.anon, req.user.data, 'Reply Under',
          `${rp} replied under your comment.`, { 'type': 'replyunder', 'threadId': thread._id, 'replyId': reply._id })
        }
        // Send notification to 'TO'
        utils.createAndSendNotification(newSubReply.to.poster_id, newSubReply.to.anon, req.user.data, 'New Reply',
        `${rp} replied to you.`, { 'type': 'subreply', 'threadId': thread._id, 'replyId': reply._id })
      }
    }
  } else {
    res.status(401).send('Unauthorized')
  }
}))

/* PUT update reply visibility */ //(GENERATES NOTIFICATION)
router.put('/replies/kill/:reply_id', passport.authenticate('jwt', {'session': false}), asyncMid(async (req, res, next) => {
  // Check if current user has permission to kill replies
  if(req.user.data.is_super || utils.hasRequiredPriviledges(req.user.data.priviledges, ['kill_replies'])){
    const reply = await Reply.findOneAndUpdate({ '_id': req.params.reply_id, 'removed': false },
    {
      '$set': {
        'media': null,
        'text': 'THIS POST HAS BEEN CATEGORIZED AS ILLEGAL',
        'removed': true
      }
    }, { 'new': true })
    if (!reply){
      res.status(500).send('Error updating')
    } else {
      // Send notification to OP
      utils.createAndSendNotification(reply.poster.poster_id, reply.poster.anon, req.user.data, 'Your content was removed',
      `Your reply was removed due to ${req.body.reason}`, null)
      // Send successfull response
      res.json({ 'success': true })
    }
  } else {
    res.status(401).send('Unauthorized')
  }
}))

/* PUT update subreply visibility */ //(GENERATES NOTIFICATION)
router.put('/replies/kill/:reply_id/:sreply_id', passport.authenticate('jwt', {'session': false}), asyncMid(async (req, res, next) => {
  // Check if current user has permission to kill subreplies
  if(req.user.data.is_super || utils.hasRequiredPriviledges(req.user.data.priviledges, ['kill_replies'])){
    const subreply = await Reply.findOneAndUpdate({ '_id': req.params.reply_id, 'replies._id': req.params.sreply_id, 'removed': false },
    {
      '$set':{
        'replies.$.media': null,
        'replies.$.text': 'THIS POST HAS BEEN CATEGORIZED AS ILLEGAL',
        'replies.$.removed': true
      }
    }, { 'new': true })
    if (!subreply) {
      res.status(500).send('Error updating')
    } else {
      // Notify OP
      const subreply = subreply.replies.id(req.params.sreply_id)
      utils.createAndSendNotification(subreply.poster.poster_id, subreply.poster.anon, req.user.data, 'Your content was removed',
      `Your reply was removed due to ${req.body.reason}`, null)
      // Send successfull response
      res.json({ 'success': true })
    }
  } else {
    res.status(401).send('Unauthorized')
  }
}))

module.exports = router

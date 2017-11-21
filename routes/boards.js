const express = require('express')
const shortid = require('shortid')
const passport = require('passport')
const router = express.Router()

// Async
const asyncMid = require('./asyncmid')

//MODELS
const Board = require('../models/board')
const User = require('../models/user')

const settings = require('../config/settings') // Site configurations
const utils = require('../config/utils') //System utils

// Include passport module as passport strategy
require('../config/passport')(passport)

const board_list_default = '_id slug name short_name last_activity image'

/* POST create new board */
router.post('/', passport.authenticate('jwt', {'session': false}), utils.uploadMediaFile.single('mfile'), asyncMid(async (req, res, next) => {
	if(utils.hasRequiredPriviledges(req.user.data.priviledges, ['create_board'])){
		let newBoard = new Board({
			'slug': shortid.generate(),
			'name': req.body.name,
			'image': null,
			'short_name': req.body.short_name,
			'description': req.body.description,
			'created_by': {
				'name': req.user.data.username,
				'id': req.user.data._id
			}
		})
		// Check if file is image type file
		if(req.file && settings.image_mime_type.includes(req.file.mimetype)){
			const file = await utils.uploadMediaToS3(req.file)
			if (file) {
				newBoard.image = {
					'name': file.originalname,
					'location': `${file.tourl}/${file.filename}`,
					'mimetype': file.mimetype,
					'size': file.size,
					'thumbnail': `${file.tourl}/${file.thumbname}`
				}
				const board = await Board.create(newBoard)
				if(board){
					res.json({ 'success': true, 'doc': board })
				} else {
					res.status(500).send('Error creating board')
				}
			} else {
				res.status(500).send('Error processing file')
			}
		}
		else{
			res.json({'success': false})
		}
	}
	else{
		res.status(401).send('Unauthorized')
	}
}))

/* GET specific board by slug */
router.get('/:board_slug', passport.authenticate('jwt', {'session': false}), asyncMid(async (req, res, next) => {
	// Simple get of a board
	const board = await Board.findOne({ 'slug': req.params.board_slug, 'active': true })
	if (board) {
		res.json({ 'success': true, 'doc': board })
	} else {
		res.status(404).send('Board doesnt exist')
	}
}))

/* GET the short_name's of all boards */
router.get('/list/short', passport.authenticate('jwt', {session:false}), asyncMid(async (req, res, next) => {
	const boards = await Board.find({ 'active': true }, 'short_name name slug image', {'sort':{'short_name':1}})
	res.json({ 'success': true, 'doc': boards })
}))

/* PUT change board image */
router.put('/:board_slug/image', passport.authenticate('jwt', {'session': false}), utils.uploadMediaFile.single('mfile'),
	asyncMid(async (req, res, next) => {
	if(utils.hasRequiredPriviledges(req.user.data.priviledges, ['edit_board'])){
		// Check if file is image type file
		if(req.file && settings.image_mime_type.includes(req.file.mimetype)){
			const file = await utils.uploadMediaToS3(req.file)
			if (file) {
				const image = {
					'name': file.originalname,
					'location': `${file.tourl}/${file.filename}`,
					'mimetype': file.mimetype,
					'size': file.size,
					'thumbnail': `${file.tourl}/${file.thumbname}`
				}
				const board = await Board.findOneAndUpdate({ 'slug': req.params.board_slug },
				{
					'$set': {
						'image':image
					}
				}, { 'new': true })
				if (board) {
					res.json({ 'success': true, 'doc': board })
				} else {
					res.status(404).send('Couldnt find board')
				}
			} else {
				res.status(500).send('Error uploading file')
			}
		} else {
			res.status(404).send('Inappropriate file format')
		}
		else{
			res.json({'success': false})
		}
	} else {
		res.status(401).send('Unauthorized')
	}
}))

/* PUT edit specific board */
router.put('/:board_slug', passport.authenticate('jwt', {'session': false}), asyncMid(async (req, res, next) => {
	// Check user is allowed to update board
	if(utils.hasRequiredPriviledges(req.user.data.priviledges, ['edit_board'])){
		// Preprocess and clean data
		const json_data = utils.parseJSON(req.body.object)
		// Check if it was a valid JSON
		if (json_data) {
			const board = await Board.findOneAndUpdate({ 'slug': req.params.board_slug },
			{
				'$set':{
					'name': json_data.name,
					'short_name': json_data.short_name,
					'description': json_data.description,
					'active': json_data.active
				}
			}, { 'new': true })
			if(board){
				res.json({ 'success': true })
			} else {
				res.status(404).send('Couldnt find board')
			}
		} else {
			res.status(500).send('Bad JSON')
		}
	} else {
		res.status(401).send('Unauthorized')
	}
}))

/* DELETE board */
router.delete('/:board_slug', passport.authenticate('jwt', {'session': false}), asyncMid(async (req, res, next) => {
	// Check if user is allowed to delete board
	if(utils.hasRequiredPriviledges(req.user.data.priviledges, ['delete_board'])){
		await Board.deleteOne({ 'slug': req.params.board_slug })
		res.json({ 'success': true })
	} else {
		res.status(401).send('Unauthorized')
	}
}))

/* GET newest boards */
router.get('/list/new', passport.authenticate('jwt', {'session': false}), asyncMid(async (req, res, next) => {
	const boards = await Board.find({ 'active': true }, board_list_default,
	{
		'limit': settings.max_board_search_count,
		'sort': {
			'created_at': -1
		}
	})
	res.json({ 'success': true, 'doc': boards })
}))

/* POST search for a board */
router.post('/search', passport.authenticate('jwt', {'session': false}), asyncMid(async (req, res, next) => {
	const boards = await Board.find(
    { '$text': { '$search': req.body.query }},
    { 'score': { '$meta': 'textScore'}}
  ).sort(
    { 'score': { '$meta': 'textScore' }}
  ).limit(
    settings.max_board_results
  )
	res.json({ 'success': true, 'doc': boards })
}))

module.exports = router

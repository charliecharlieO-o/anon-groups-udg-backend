const express = require("express");
const shortid = require("shortid");
const passport = require("passport");
const router = express.Router();

//MODELS
const Board = require("../models/board");
const User = require("../models/user");

const settings = require("../config/settings"); // Site configurations
const utils = require("../config/utils"); //System utils

// Include passport module as passport strategy
require("../config/passport")(passport);

const board_list_default = "_id slug name short_name last_activity image";

/* POST create new board */
router.post("/", passport.authenticate("jwt", {"session": false}), utils.uploadMediaFile.single("mfile"), (req, res) => {
	if(utils.hasRequiredPriviledges(req.user.data.priviledges, ["create_board"])){
		let newBoard = new Board({
			"slug": shortid.generate(),
			"name": req.body.name,
			"image": null,
			"short_name": req.body.short_name,
			"description": req.body.description,
			"created_by": {
				"name": req.user.data.username,
				"id": req.user.data._id
			}
		});
		// Check if file is image type file
		if(req.file && settings.image_mime_type.includes(req.file.mimetype)){
			utils.thumbnailGenerator(req.file).then((file) => {
				newBoard.image = {
					"name": file.originalname,
					"location": file.path,
					"mimetype": file.mimetype,
					"size": file.size,
					"thumbnail": file.thumbnail
				};
				Board.create(newBoard, (err, board) => {
					if(err){
						// Check for validation errors
						res.json({ "success": false });
						utils.deleteFile(req.file.path);
						utils.deleteFile(newBoard.thumbnail);
					}
					else{
						res.json({ "success": true, "doc": board });
					}
				});
			}).catch((err) => {
				res.json({"success": false});
				if(req.file)
					utils.deleteFile(req.file.path); // Delete file, this repeats A LOT
			});
		}
		else{
			res.json({"success": false});
			if(req.file)
				utils.deleteFile(req.file.path); // A LOT
		}
	}
	else{
		res.status(401).send("Unauthorized");
		if(req.file)
			utils.deleteFile(req.file.path); // A LOT!
	}
});

/* GET specific board by slug */
router.get("/:board_slug", passport.authenticate("jwt", {"session": false}), (req, res) => {
	// Simple get of a board
	Board.findOne({ "slug": req.params.board_slug, "active": true }, (err, board) => {
		if(err){
			res.json({ "success": false });
		}
		else if(!board){
			res.status(404).send();
		}
		else{
			res.json({ "success": true, "doc": board });
		}
	});
});

/* GET the short_name's of all boards */
router.get("/list/short", passport.authenticate("jwt", {session:false}), (req, res) => {
	Board.find({ "active": true }, "short_name name slug image", {"sort":{"short_name":1}}, (err, boards) => {
		if(err){
			res.json({ "success": false });
		}
		else{
			res.json({ "success": true, "doc": boards });
		}
	});
});

/* PUT change board image */
router.put("/:board_slug/image", passport.authenticate("jwt", {"session": false}), utils.uploadMediaFile.single("mfile"), (req, res) => {
	if(utils.hasRequiredPriviledges(req.user.data.priviledges, ["edit_board"])){
		// Check if file is image type file
		if(req.file && settings.image_mime_type.includes(req.file.mimetype)){
			utils.thumbnailGenerator(req.file).then((file) => {
				const image = {
					"name": file.originalname,
					"location": file.path,
					"mimetype": file.mimetype,
					"size": file.size,
					"thumbnail": file.thumbnail
				};
				Board.findOneAndUpdate({ "slug": req.params.board_slug },
				{
					"$set": {
						"image":image
					}
				}, { "new": true }, (err, board) => {
					if(err || !board){
						res.json({ "success": false });
						// PLEASE STOP THE MADNESS! (callback hell)
						utils.deleteFile(req.file.path);
						utils.deleteFile(image.thumbnail);
					}
					else{
						res.json({ "success": true });
					}
				});
			}).catch((err) => {
				res.json({"success": false});
				if(req.file)
					utils.deleteFile(req.file.path); // Delete file, this repeats A LOT
			});
		}
		else{
			res.json({"success": false});
			if(req.file)
				utils.deleteFile(req.file.path); // A LOT
		}
	}
	else{
		res.status(401).send("Unauthorized");
		if(req.file)
			utils.deleteFile(req.file.path); // A LOT!
	}
});

/* PUT edit specific board */
router.put("/:board_slug", passport.authenticate("jwt", {"session": false}), (req, res) => {
	// Check user is allowed to update board
	if(utils.hasRequiredPriviledges(req.user.data.priviledges, ["edit_board"])){
		// Preprocess and clean data
		const json_data = JSON.parse(req.body.object);
		Board.findOneAndUpdate({ "slug": req.params.board_slug },
		{
			"$set":{
				"name": json_data.name,
				"short_name": json_data.short_name,
				"description": json_data.description,
				"active": json_data.active
			}
		}, { "new": true }, (err, board) => {
			if(err || !board){
				res.json({ "success": false });
			}
			else{
				res.json({ "success": true });
			}
		});
	}
	else{
		res.status(401).send("Unauthorized");
	}
});

/* DELETE board */
router.delete("/:board_slug", passport.authenticate("jwt", {"session": false}), (req, res) => {
	// Check if user is allowed to delete board
	if(utils.hasRequiredPriviledges(req.user.data.priviledges, ["delete_board"])){
		Board.deleteOne({ "slug": req.params.board_slug }, (err) => {
			if(err){
				res.json({ "success": false });
			}
			else{
				res.json({ "success": true });
			}
		});
	}
	else{
		res.status(401).send("Unauthorized");
	}
});

/* GET newest boards */
router.get("/list/new", passport.authenticate("jwt", {"session": false}), (req, res) => {
	Board.find({ "active": true }, board_list_default,
	{
		"limit": settings.max_board_search_count,
		"sort": {
			"created_at": -1
		}
	}, (err, boards) => {
		if(err){
			res.json({ "success": false });
		}
		else{
			res.json({ "success": true, "doc": boards });
		}
	});
});

module.exports = router;

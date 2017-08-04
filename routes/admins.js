const express = require("express");
const passport = require("passport");
const router = express.Router();

// Include passport module as passport strategy
require("../config/passport")(passport);

const Admin = require("../models/admin");
const User = require("../models/user");
const Board = require("../models/board");
const Issue = require("../models/issue");

const utils = require("../config/utils"); //System utils

const default_issue_list = "_id by_user category solved";

//----------------- ADMIN UTILITY FUNCTIONS -----------------//
// Function to check if user is admin
const isAdmin = (user_data, callback) => {
  Admin.findOne({ "user.id": user_data._id }, "board divisions", (err, admin) => {
    if(err || !admin){
      callback(false);
    }
    else{
      callback(true, admin);
    }
  });
};

//=================================================================================
//									--	ADMIN MANAGEMENT --
//=================================================================================
// To access, user account must contain the admin_admins priviledge

/* POST appoint a new admin, only super users can appoint new admins  */ //(GENERATES NOTIFICATION)
router.post("/appoint", passport.authenticate("jwt", {"session": false}), (req, res) => {
  if(req.user.data.is_super){
    User.findById(req.body.user_id, "_id username banned", (err, user) => {
      if(err || !user){
        res.json({ "success": false });
      }
      else{
        // General Admin Creation
        let newAdmin = new Admin({
          "user": {
            "id": user._id,
            "name": user.username
          },
          "appointed_by": {
            "id": req.user.data._id,
            "name": req.user.data.username,
          }
        });
        Admin.create(newAdmin, (err, admin) =>{
          if(err || !admin){
            res.json({ "success": false });
          }
          else{
            // Notificate user about promotion
            utils.createAndSendNotification(user._id, "You have been promoted",
              "You now have admin status.", `/admin/uid/${user._id}`);
            // Send successfull response
            res.json({ "success": true, "doc": admin });
          }
        });
      }
    });
  }
  else{
    res.status(401).send("Unauthorized");
  }
});

/* POST search for an admin by name */
router.post("/search", passport.authenticate("jwt", {"session": false}), (req, res) => {
  if(req.user.data.is_super || utils.hasRequiredPriviledges(req.user.data.priviledges, ["admin_admins"])){
    Admin.find(
      { "$text": { "$search": req.body.name }},
      { "score": { "$meta": "textScore"}}
    ).sort(
      { "score": { "$meta": "textScore"}}
    ).exec((err, admins) => {
      if(err || !admins){
        res.json({ "success": false });
      }
      else{
        res.json({ "success": true, "doc": admins });
      }
    });
  }
  else{
    res.status(401).send("Unauthorized");
  }
});

/* GET admins appointed by specific user */
router.get("/list/appointed-by/:user_id", passport.authenticate("jwt", {"session": false}), (req, res) => {
  if(req.user.data.is_super || utils.hasRequiredPriviledges(req.user.data.priviledges, ["admin_admins"])){
    User.findById(req.params.user_id, "_id username", (err, user) => {
      if(err || !user){
        res.json({ "success": false, "error": 111 });
      }
      else{
        Admin.find({ "appointed_by.id": user._id }, (err, admins) => {
          if(err || !admins){
            res.json({ "success": false });
          }
          else{
            res.json({ "success": true, "doc": admins });
          }
        });
      }
    });
  }
  else{
    res.status(401).send("Unauthorized");
  }
});

/* GET admins by number of issues solved */
router.get("/list/by-performance", passport.authenticate("jwt", {"session": false}), (req, res) => {
  if(req.user.data.is_super || utils.hasRequiredPriviledges(req.user.data.priviledges, ["admin_admins"])){
    Admin.find({}).sort({"issues-solved": -1}).exec((err, admins) => {
      if(err || !admins){
        res.json({ "success": false });
      }
      else{
        res.json({ "success": true, "doc": admins });
      }
    });
  }
  else{
    res.status(401).send("Unauthorized");
  }
});

/* GET admins ordered by recent last resolution */
router.get("/list/by-resolution", passport.authenticate("jwt", {"session": false}), (req, res) => {
  if(req.user.data.is_super ||  utils.hasRequiredPriviledges(req.user.data.priviledges, ["admin_admins"])){
    Admin.find({}, { "sort":{ "last_resolution":-1 }}, (err, admins) => {
      if(err || !admins){
        res.json({ "success": false });
      }
      else{
        res.json({ "success": true, "doc": admins });
      }
    });
  }
  else{
    res.status(401).send("Unauthorized");
  }
});

/* GET admins ordered by number of resolutions */
router.get("/list/issues-solved", passport.authenticate("jwt", {"session": false}), (req, res) => {
  if(req.user.data.is_super ||  utils.hasRequiredPriviledges(req.user.data.priviledges, ["admin_admins"])){
    Admin.find({}, { "sort":{ "issues_solved":1 }}, (err, admins) => {
      if(err || !admins){
        res.json({ "success": false });
      }
      else{
        res.json({ "success": true, "doc": admins });
      }
    });
  }
  else{
    res.status(401).send("Unauthorized");
  }
});

/* GET admins of a board */
router.get("/list/board/:board_slug", passport.authenticate("jwt", {"session": false}), (req, res) => {
  if(req.user.data.is_super ||  utils.hasRequiredPriviledges(req.user.data.priviledges, ["admin_admins"])){
    Admin.find({ "board.slug": req.params.board_slug }, (err, admins) => {
      if(err || !admins){
        res.json({ "success": false });
      }
      else{
        res.json({ "success": true, "doc": admins })
      }
    });
  }
  else{
    res.status(401).send("Unauthorized");
  }
});

/* POST search for admins that contain specific priviledges */
/*router.post("/search/by-priviledges", passport.authenticate("jwt", {"session": false}), (req, res) => {
  isSysAdmin(req.user.data.priviledges, (has_access) => {
    if(has_access){
      const priviledges = JSON.parse(req.body.priviledge_list);
      Admin.find({ "priviledges": { "$in": priviledges }}, (err, admins) => {
        if(err || !admins){
          res.json({ "success": false });
        }
        else{
          res.json({ "success": true, "doc": admins });
        }
      });
    }
    else{
      res.status(401).send("Unauthorized");
    }
  });
});*/

/* GET admin info based on user id */
router.get("/uid/:user_id", passport.authenticate("jwt", {"session": false}), (req, res) => {
  if(req.user.data.is_super || utils.hasRequiredPriviledges(req.user.data.priviledges, ["admin_admins"])){
    Admin.findOne({ "user.id": req.params.user_id }, (err, admin) => {
      if(err || !admin){
        res.json({ "success": false });
      }
      else{
        res.json({ "success": true, "doc": admin });
      }
    });
  }
  else{
    res.status(401).send("Unauthorized");
  }
});

/* GET admin info based on admin id */
router.get("/id/:admin_id", passport.authenticate("jwt", {"session": false}), (req, res) => {
  if(req.user.data.is_super || utils.hasRequiredPriviledges(req.user.data.priviledges, ["admin_admins"])){
    Admin.findById(req.params.admin_id, (err, admin) => {
      if(err || !admin){
        res.json({ "success": false });
      }
      else{
        res.json({ "success": true, "doc": admin });
      }
    });
  }
  else{
    res.status(401).send("Unauthorized");
  }
});

/* GET list of admins belonging to a division */
router.get("/list/division/:admin_division", passport.authenticate("jwt", {"session": false}), (req, res) => {
  if(req.user.data.is_super || utils.hasRequiredPriviledges(req.user.data.priviledges, ["admin_admins"])){
    Admin.find({ "divisions": {"$all": req.params.admin_division}}).sort({ "user.name":1 }).exec((err, admins) => {
      if(err || !admins){
        console.log(err);
        res.json({ "success": false });
      }
      else{
        res.json({ "success": true, "doc": admins });
      }
    });
  }
  else{
    res.status(401).send("Unauthorized");
  }
});

/* GET list of all admins ordered by name */
router.get("/list-all", passport.authenticate("jwt", {"session": false}), (req, res) => {
  if(req.user.data.is_super || utils.hasRequiredPriviledges(req.user.data.priviledges, ["admin_admins"])){
    Admin.find({}).sort({ "user_name":1 }).exec((err, admins) => {
      if(err || !admins){
        res.json({ "success": false });
      }
      else{
        res.json({ "success": true, "doc": admins });
      }
    });
  }
  else{
    res.status(401).send("Unauthorized");
  }
});

/* PUT update an admin data (Board) */ //(GENERATES NOTIFICATION)
router.put("/reassign/board/", passport.authenticate("jwt", {"session": false}), (req, res) => {
  if(req.user.data.is_super){
    // Get assigned board
    Board.findById(req.body.board_id, "_id slug short_name", (err, board) => {
      if(err){
        res.json({ "success": false, "error":134 });
      }
      else{
        Admin.findOneAndUpdate({ "_id": req.body.admin_id },
        {
          "$set":{
            "board": (!board)? null : {
              "id": board._id,
              "slug": board.slug,
              "short_name": board.short_name
            }
          }
        }, {"new": true}, (err, admin) => {
          if(err || !admin){
            res.json({ "success": false });
          }
          else{
            // Notificate user about reassignment
            utils.createAndSendNotification(admin.user.id, "You have been reassigned",
              "You have been reassigned to a different board.", `/admin/id/${admin._id}`);
            // Return a successfull response
            res.json({ "success": true, "doc": admin });
          }
        });
      }
    });
  }
  else{
    res.status(401).send("Unauthorized");
  }
});

/* PUT update an admin data (Division) */ //(GENERATES NOTIFICATION)
router.put("/reassign/divisions", passport.authenticate("jwt", {"session": false}), (req, res) => {
  if(req.user.data.is_super){
    utils.parseJSON(req.body.divisions, (err, json) => {
      if(err){
        res.json({ "success": false });
      }
      else{
        Admin.findOneAndUpdate({ "_id": req.body.admin_id },
        {
          "$set":{
            "divisions": json
          }
        }, {"new": true}, (err, admin) => {
          if(err || !admin){
            res.json({ "success": false });
          }
          else{
            // Notificate user about reassignment
            utils.createAndSendNotification(admin.user.id, "You have been reassigned",
              "Your assigned divisions have changed", `/admin/id/${admin._id}`);
            // Return successfull response
            res.json({ "success": true, "doc": admin });
          }
        });
      }
    });
  }
  else{
    res.status(401).send("Unauthorized");
  }
});

/* DELETE an admin */ //(GENERATES NOTIFICATION)
router.delete("/remove", passport.authenticate("jwt", {"session": false}), (req, res) => {
  if(req.user.data.is_super){
    Admin.findByIdAndRemove(req.body.admin_id, (err, admin) => {
      if(err || !admin){
        res.json({ "success": false });
      }
      else {
        // Notificate user about dismissal
        utils.createAndSendNotification(admin.user.id, "You have been dismissed",
          "You no longer have admin status", null);
        // Return successfull response
        res.json({ "success": true });
      }
    });
  }
  else{
    res.status(401).send("Unauthorized");
  }
});

//=================================================================================
//									--	ISSUE MANAGEMENT --
//=================================================================================
// To read, update and delete issues, user account must be an admin of said board o area

/* POST create a new issue (Must be a logged in user) */
router.post("/post-issue", passport.authenticate("jwt", {"session": false}), (req, res) => {
  const newIssue = new Issue({
    "by_user": {
      "name": req.user.data.username,
      "id": req.user.data._id
    },
    "file": {
      "name": "example.jpg",
      "location": "/some/location/example.jpg",
      "size": "4 MB"
    },
    "category": req.body.category,
    "problem": req.body.issue_text,
    "board": req.body.board_id,
    "reported_object_url": req.body.object_url
  });
  Issue.create(newIssue, (err, issue) => {
    if(err || !issue){
      console.log(err);
      res.json({ "success": false });
    }
    else{
      res.json({ "success": true, "doc": issue });
    }
  });
});

/* GET an issue info based on id */
router.get("/issue/:issue_id", passport.authenticate("jwt", {"session": false}), (req, res) => {
  isAdmin(req.user.data, (has_access, admin) => {
    if(has_access){
      Issue.findById(req.params.issue_id, (err, issue) => {
        if(err || !issue){
          res.json({ "success": false });
        }
        else{
          res.json({ "success": true, "doc": issue });
        }
      });
    }
    else{
      res.status(401).send("Unauthorized");
    }
  });
});

/* GET corresponding issues depending of admin (by board and division) */
router.get("/issues", passport.authenticate("jwt", {"session": false}), (req, res) => {
  isAdmin(req.user.data, (has_access, admin) => {
    if(has_access){
      const query = (!admin.board)?
        { "category": {"$in": admin.divisions }} :
        { "board": admin.board.id, "category": {"$in": admin.divisions }};
      Issue.find(query, default_issue_list, (err, issues) => {
        if(err || !issues){
          res.json({ "success": false });
        }
        else{
          res.json({ "success": true, "doc": issues });
        }
      });
    }
    else{
      res.status(401).send("Unauthorized");
    }
  });
});

/* GET issues by division */
router.get("/issues/division/:division", passport.authenticate("jwt", {"session": false}), (req, res) => {
  isAdmin(req.user.data, (has_access, admin) => {
    if(has_access && admin.divisions.includes(req.params.division)){
      const query = (!admin.board)?
        { "board": admin.board, "category": req.params.division }:
        { "category": req.params.division };
      Issue.find(query, default_issue_list, (err, issues) => {
        if(err || !issues){
          res.json({ "success": false });
        }
        else{
          res.json({ "success": true, "doc": issues });
        }
      });
    }
    else{
      res.status(401).send("Unauthorized");
    }
  });
});

/* GET issues by board */
router.get("/issues/board/:board_id", passport.authenticate("jwt", {"session": false}), (req, res) => {
  isAdmin(req.user.data, (has_access, admin) => {
    if(has_access && (req.params.board_id == admin.board.id || !admin.board.id)){
      Issue.find({ "board": req.params.board_id }, default_issue_list, (err, issues) => {
        if(err || !issues){
          res.json({ "success": false });
        }
        else{
          res.json({ "success": true, "doc": issues });
        }
      });
    }
    else{
      res.status(401).send("Unauthorized");
    }
  });
});

/* GET issues by board and division */
router.get("/issues/board/:board_id/division/:division", passport.authenticate("jwt", {"session": false}), (req, res) => {
  isAdmin(req.user.data, (has_access, admin) => {
    if(has_access && !admin.board && admin.divisions.includes(req.params.division)){
      Issue.find({ "board": req.params.board_id, "category": req.params.division }, default_issue_list, (err, issues) => {
        if(err || !issues){
          res.json({ "success": false });
        }
        else{
          res.json({ "success": true, "doc": issues });
        }
      });
    }
    else{
      res.status(401).send("Unauthorized");
    }
  });
});

/* PUT Resolve an issue */
router.put("/solve-issue/:issue_id", passport.authenticate("jwt", {"session": false}), (req, res) => {
  isAdmin(req.user.data, (has_access, admin) => {
    if(has_access){
      const query = (!admin.board)?
        { "_id": req.params.issue_id, "category": {"$in": admin.divisions }}:
        { "_id": req.params.issue_id, "board": admin.board.id, "category": {"$in": admin.divisions }};
      Issue.findOneAndUpdate(query,
      {
        "$set":{
          "solved_by": {
            "name": req.user.data.username,
            "id": req.user.data._id
          },
          "solved": true,
          "details": req.body.details
        }
      }, { "new": true }, (err, issue) => {
        if(err || !issue){
          res.json({ "success": false });
        }
        else{
          admin.update({ "last_resolution": (new Date()).now, "$inc": { "issues_solved": 1 }});
          res.json({ "success": true, "doc": issue });
        }
      });
    }
    else{
      res.status(401).send("Unauthorized");
    }
  });
});

module.exports = router;

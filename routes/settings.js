const express = require("express");
const passport = require("passport");
const router = express.Router();

const settings = require("../config/settings"); //System settings
const utils = require("../config/utils"); //System utils

// Include passport module as passport strategy
require("../config/passport")(passport);

/* GET's the priviledge list for an admin */
router.get("/priviledge/list", passport.authenticate("jwt", {"session": false}), (req, res) => {
  if(utils.hasRequiredPriviledges(req.user.data.priviledges, ["promote_user", "admin_admins"])){
    res.json({ "success": true, "doc": settings.priviledges });
  }
  else{
    res.status(401).send("Unauthorized");
  }
});

/* GET's the issue category list */
router.get("/issue/categories", passport.authenticate("jwt", {"session": false}), (req, res) => {
  res.json({ "success": true, "doc": settings.issue_categories });
});

/* GET's general thread settings */
router.get("/thread/settings", passport.authenticate("jwt", {"session": false}), (req, res) => {
  res.json({ "success": true,
    "doc": {
      "maxThreadReplies": settings.max_thread_replies,
      "maxReplySubreplies": settings.max_reply_subreplies }
  });
});

module.exports = router;

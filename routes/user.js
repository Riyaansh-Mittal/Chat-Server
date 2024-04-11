const router = require("express").Router();

const authController = require("../controllers/auth");
const userController = require("../controllers/user");

router.patch("/update-me", authController.protect, userController.updateMe);

// http://localhost:3000/v1//user/update-me
module.exports = router;
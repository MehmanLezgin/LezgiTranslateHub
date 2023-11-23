const Router = require('express');
const router = new Router();

const userController = require('../controllers/userController');

router.post('/reg-token/create', userController.createRegToken);

module.exports = router
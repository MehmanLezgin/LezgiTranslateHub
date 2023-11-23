const Router = require('express');
const router = new Router();

const taskController = require('../controllers/taskController');
const authMiddleware = require('../middlewares/authMiddleware');

router.get('/', authMiddleware, taskController.getTask);
router.post('/', authMiddleware, taskController.submitTask);


module.exports = router
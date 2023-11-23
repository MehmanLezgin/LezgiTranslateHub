const Router = require('express');
const router = new Router();

const userController = require('../controllers/userController');
const authMiddleware = require('../middlewares/authMiddleware');
const adminMiddleware = require('../middlewares/adminMiddleware');
const adminRouter = require('../routers/adminRouter')

router.post('/signup', userController.signup);
router.post('/signin', userController.signin);
router.use('/admin', authMiddleware, adminMiddleware, adminRouter);

module.exports = router
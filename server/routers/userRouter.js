const Router = require('express');
const router = new Router();

const userController = require('../controllers/userController');
const authMiddleware = require('../middlewares/authMiddleware');
const adminMiddleware = require('../middlewares/adminMiddleware');
const usernameParamMiddleware = require('../middlewares/usernameParamMiddleware');
const adminRouter = require('../routers/adminRouter')

router.post('/signup', userController.signup);
router.post('/signin', userController.signin);
router.get('/:username',    authMiddleware, usernameParamMiddleware, userController.getProfile);
router.get('/',             authMiddleware, usernameParamMiddleware, userController.getProfile);
router.get('/:username/translations', authMiddleware, usernameParamMiddleware, userController.getUserTranslations);
router.use('/admin', authMiddleware, adminMiddleware, adminRouter);

module.exports = router
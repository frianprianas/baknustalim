const express = require('express');
const router = express.Router();
const tanyaController = require('../controllers/tanyaController');
const { requireAuth } = require('../middlewares/auth');

router.get('/', requireAuth, tanyaController.showQuestions);
router.post('/', requireAuth, tanyaController.createQuestion);
router.post('/:id/jawab', requireAuth, tanyaController.answerQuestion);
router.post('/:id/delete', requireAuth, tanyaController.deleteQuestion);

module.exports = router;

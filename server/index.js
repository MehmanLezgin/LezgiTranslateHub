const express = require('express');
const cors = require('cors');

require('dotenv').config();

const taskRouters = require('./routers/taskRouter')
const userRouters = require('./routers/userRouter')

const PORT = process.env.PORT || 3000;

const app = express();


app.use(cors());

app.use(express.json());
app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && 'body' in err) {
        return res.status(400).json({ msg: 'Invalid JSON' });
    }
    next(err);
});
app.use('/api/task', taskRouters)
app.use('/api/user', userRouters)

app.use('/api/test', (req, res) => {
    res.status(200).json({ msg: 'Hello World!' });
})

app.use((req, res) => {
    res.status(404).json({ msg: 'Not Found' });
})

app.listen(PORT, () => {
    console.log(`Server started on port ${PORT}.`);
})
const app = require('./app');
require('dotenv').config();
//require('./database/seed');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`🚀 Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});

//module.exports = app;
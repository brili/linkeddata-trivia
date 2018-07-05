'use strict';

const express = require('express'),
    app = express(),
    generator = require('./generator'),
    PORT = 8898;

app.use(express.static('public'));

app.get('/api/random', (req, res) => {
    generator.generateRandom().then((data) => {
        res.json(data);
    });
});

app.get('/api/theme', (req, res) => {
    var inputTheme = req.query.theme;
    generator.generateTheme(inputTheme).then((data) => {
        res.json(data);
    });
});



app.listen(PORT, function() {
    console.log(`Example app listening on port ${PORT}!`);
});
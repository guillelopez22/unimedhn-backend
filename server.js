const express = require('express');
const path = require('path');
const bodyParser = require("body-parser");
const session = require('express-session');
const http = require('http');
const helmet = require('helmet');
const cors = require('cors');

require('dotenv').config();
const app = express();

app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.options('*', cors());
app.use(helmet());
app.use('/sistema',express.static(path.join(__dirname, 'sistema')));

const ControllerApi = require('./server/controller');
app.use('/api', ControllerApi);
app.use(function (err, req, res, next) {
	console.error(err.stack);
  	res.status(500).send({title:"Error interno del servidor", message:"Revise su conexión de internet o inténtelo más tarde"});
})

app.get('/sistema', (req, res) => {
  res.sendFile(path.join(__dirname, 'sistema/index.html'));
});

const port = process.env.PORT || '8000';
app.set('port', port);
app.set('host', '127.0.0.1');
const server = http.createServer(app);
server.listen(port, () => console.log(`Running on 127.0.0.1:${port}`));
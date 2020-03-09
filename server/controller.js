const express = require('express');
const router = express.Router();
var mysql = require('mysql');
const fs = require("fs");
var jwt = require('jsonwebtoken');
var bcrypt = require('bcryptjs');
const nodemailer = require("nodemailer");
const crypto = require('crypto');
const algorithm = 'aes-256-cbc';
const key = crypto.randomBytes(32);
const iv = crypto.randomBytes(16);
const verify_token = require("./verify_token");

let transporter = nodemailer.createTransport({
    host: "smtp.office365.com",
    port: 587,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
    }
});

var con = mysql.createPool({
    connectionLimit: 100,
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_SCHEMA,
    insecureAuth: true,
    multipleStatements: true
});

//########################################################################
//AUTH ###################################################################
router.get('/login', (req, res, next) => {
    var select_username_query = "" +
        " SELECT id" +
        " FROM users" +
        " WHERE" +
        " username = ?";
    var select_username_values = [
        req.query.username
    ];
    con.query(select_username_query, select_username_values, function (select_username_err, select_username_result, select_username_fields) {
        if (select_username_err) {
            next(select_username_err);
        } else {
            if (select_username_result.length > 0) {
                var validate_user_password_query = "" +
                    " SELECT id, username, role, user_email, first_login" +
                    " FROM users" +
                    " WHERE" +
                    " username = ?" +
                    " AND password = SHA(?)" +
                    " AND active = 1";
                var validate_user_password_values = [
                    req.query.username,
                    req.query.password
                ];
                con.query(validate_user_password_query, validate_user_password_values, function (validate_user_password_err, validate_user_password_result, validate_user_password_fields) {
                    if (validate_user_password_err) {
                        next(validate_user_password_err);
                    } else {
                        if (validate_user_password_result.length > 0) {
                            if (validate_user_password_result[0].first_login == 1) {
                                res.status(200).json({
                                    auth: true,
                                    first_login: true,
                                    id: encrypt(validate_user_password_result[0].id + ""),
                                    name: validate_user_password_result[0].username
                                });
                            } else {
                                var token = jwt.sign({
                                    id: validate_user_password_result[0].id,
                                    role: validate_user_password_result[0].role
                                },
                                    process.env.TOKEN_SECRET_KEY,
                                    {
                                        expiresIn: 86400
                                    });
                                res.status(200).json({
                                    auth: true,
                                    first_login: false,
                                    token: token,
                                    name: validate_user_password_result[0].username
                                });
                            }
                        } else {
                            res.status(400).json({
                                auth: false,
                                title: "Error de Autenticación",
                                message: 'Combinación de usuario y contraseña incorrectos'
                            });
                        }
                    }
                });
            } else {
                res.status(400).json({
                    auth: false,
                    title: "Error de Autenticación",
                    message: 'El usuario con el cual está intentando acceder no existe'
                });
            }
        }
    });
});

router.get('/login', (req, res, next) => {
    var select_username_query = "" +
        " SELECT id" +
        " FROM users" +
        " WHERE" +
        " username = ?";
    var select_username_values = [
        req.query.username
    ];
    con.query(select_username_query, select_username_values, function (select_username_err, select_username_result, select_username_fields) {
        if (select_username_err) {
            next(select_username_err);
        } else {
            if (select_username_result.length > 0) {
                var validate_user_password_query = "" +
                    " SELECT id, role, username, first_login" +
                    " FROM users" +
                    " WHERE" +
                    " username = ?" +
                    " AND password = SHA(?)" +
                    " AND active = 1";
                var validate_user_password_values = [
                    req.query.username,
                    req.query.password
                ];
                con.query(validate_user_password_query, validate_user_password_values, function (validate_user_password_err, validate_user_password_result, validate_user_password_fields) {
                    if (validate_user_password_err) {
                        next(validate_user_password_err);
                    } else {
                        if (validate_user_password_result.length > 0) {
                            if (validate_user_password_result[0].first_login == 1) {
                                res.status(200).json({
                                    auth: true,
                                    first_login: true,
                                    id: encrypt(validate_user_password_result[0].id + ""),
                                    name: validate_user_password_result[0].username
                                });
                            } else {
                                res.status(200).json({
                                    auth: true,
                                    first_login: false,
                                    id: encrypt(validate_user_password_result[0].id + ""),
                                    name: validate_user_password_result[0].username
                                });
                            }
                        } else {
                            res.status(400).json({
                                auth: false,
                                title: "Error de Autenticación",
                                message: 'Combinación de usuario y contraseña incorrectos'
                            });
                        }
                    }
                });
            } else {
                res.status(400).json({
                    auth: false,
                    title: "Error de Autenticación",
                    message: 'El usuario con el cual está intentando acceder no existe'
                });
            }
        }
    });
});

router.post('/request_recovery_code', (req, res, next) => {
    var select_user_email_query = "" +
        " SELECT id, username FROM" +
        " users" +
        " WHERE" +
        " user_email = ?";
    var select_user_email_values = [
        req.body.user_email
    ];
    con.query(select_user_email_query, select_user_email_values, function (select_user_email_err, select_user_email_result, select_user_email_fields) {
        if (select_user_email_err) {
            next(select_user_email_err);
        } else {
            if (select_user_email_result.length > 0) {
                var code = generate_recovery_code(5);
                try {
                    transporter.sendMail({
                        from: '"UNIMED"',
                        to: req.body.user_email,
                        subject: "Código de Recuperación",
                        html: "Estimado/a " + select_user_email_result[0].username + ":<br><br>El código para recuperar su usuario o contraseña es el siguiente: <b>" + code + "</b><br>Ingrese el código proporcionado en el formulario de recuperación de credenciales."
                    });
                } catch (mailer_error) {
                    console.log(mailer_error);
                }
                var assign_code_query = "" +
                    " UPDATE users" +
                    " SET" +
                    " restore_code = ?" +
                    " WHERE" +
                    " id = ?";
                var assign_code_values = [
                    code,
                    select_user_email_result[0].id
                ];
                con.query(assign_code_query, assign_code_values, function (assign_code_err, assign_code_result, assign_code_fields) {
                    if (assign_code_err) {
                        next(assign_code_err);
                    } else {
                        res.status(200).json({
                            id: encrypt(select_user_email_result[0].id + ""),
                            title: "Código de Recuperación Generado",
                            message: 'El código de recuperación se generó y envió a su correo de forma satisfactoria'
                        });
                    }
                });
            } else {
                res.status(400).json({
                    title: "Error",
                    message: 'El correo electrónico proporcionado no se encuentra asociado a un usuario dentro del sistema'
                });
            }
        }
    });
});

router.get('/validate_recovery_code', (req, res, next) => {
    var validate_user_code_query = "" +
        " SELECT id, username FROM" +
        " users" +
        " WHERE" +
        " id = ?" +
        " AND user_email = ?" +
        " AND restore_code = ?";
    var validate_user_code_values = [
        decrypt(req.query.id),
        req.query.user_email,
        req.query.restore_code
    ];
    con.query(validate_user_code_query, validate_user_code_values, function (validate_user_code_err, validate_user_code_result, validate_user_code_fields) {
        if (validate_user_code_err) {
            next(validate_user_code_err);
        } else {
            if (validate_user_code_result.length > 0) {
                res.status(200).json({
                    id: encrypt(validate_user_code_result[0].id + ""),
                    title: "Código de Recuperación Válido",
                    message: 'El código de recuperación se validó correctamente'
                });
            } else {
                res.status(400).json({
                    title: "Error",
                    message: 'El código de recuperación no es válido'
                });
            }
        }
    });
});

router.post('/request_password_change', (req, res, next) => {
    var select_user_query = "" +
        " SELECT username,password  FROM" +
        " users" +
        " WHERE" +
        " id = ?" +
        " AND user_email = ?" +
        " AND restore_code = ?";
    var select_user_values = [
        decrypt(req.body.id),
        req.body.user_email,
        req.body.restore_code
    ];
    con.query(select_user_query, select_user_values, function (select_user_err, select_user_result, select_user_fields) {
        if (select_user_err) {
            next(select_user_err);
        } else {
            if (select_user_result.length > 0) {
                if (select_user_result[0].password != req.body.password) {
                    if (req.body.password.match(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{6,25}$/)) {
                        var update_password_query = "" +
                            " UPDATE" +
                            " users" +
                            " SET" +
                            " password = SHA(?)," +
                            " restore_code = ''" +
                            " WHERE" +
                            " id = ?" +
                            " AND user_email = ?" +
                            " AND restore_code = ?";
                        var update_password_values = [
                            req.body.password,
                            decrypt(req.body.id),
                            req.body.user_email,
                            req.body.restore_code
                        ];
                        con.query(update_password_query, update_password_values, function (update_password_err, update_password_result, update_password_fields) {
                            if (update_password_err) {
                                next(update_password_err);
                            } else {
                                res.status(200).json({
                                    valid: true,
                                    title: "Contraseña Cambiada Exitosamente",
                                    message: 'La contraseña se ha cambiado de forma satisfactoria'
                                });
                            }
                        });
                    } else {
                        res.status(400).json({
                            valid: false,
                            title: "Error",
                            message: 'La contraseña no posee los requisitos establecidos por el sistema'
                        });
                    }
                } else {
                    res.status(400).json({
                        valid: false,
                        title: "Error",
                        message: 'La contraseña proporcionada es la misma que posee el usuario actualmente'
                    });
                }
            } else {
                res.status(400).json({
                    valid: false,
                    title: "Error",
                    message: 'La contraseña no puede ser cambiada, favor contacte a un administrador de sistema'
                });
            }
        }
    });
});

router.post('/request_password_change_first_login', (req, res, next) => {
    var select_user_query = "" +
        " SELECT username, password FROM" +
        " users" +
        " WHERE" +
        " id = ?" +
        " AND first_login = 1";
    var select_user_values = [
        decrypt(req.body.id)
    ];
    con.query(select_user_query, select_user_values, function (select_user_err, select_user_result, select_user_fields) {
        if (select_user_err) {
            next(select_user_err);
        } else {
            if (select_user_result.length > 0) {
                if (select_user_result[0].password != req.body.password) {
                    if (req.body.password.match(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{6,25}$/)) {
                        var update_password_query = "" +
                            " UPDATE" +
                            " users" +
                            " SET" +
                            " password = SHA(?)," +
                            " restore_code = -1," +
                            " first_login = 0" +
                            " WHERE" +
                            " id = ?";
                        var update_password_values = [
                            req.body.password,
                            decrypt(req.body.id)
                        ];
                        con.query(update_password_query, update_password_values, function (update_password_err, update_password_result, update_password_fields) {
                            if (update_password_err) {
                                next(update_password_err);
                            } else {
                                res.status(200).json({
                                    valid: true,
                                    title: "Contraseña Cambiada Exitosamente",
                                    message: 'La contraseña se ha cambiado de forma satisfactoria'
                                });
                            }
                        });
                    } else {
                        res.status(400).json({
                            valid: false,
                            title: "Error",
                            message: 'La contraseña no posee los requisitos establecidos por el sistema'
                        });
                    }
                } else {
                    res.status(400).json({
                        valid: false,
                        title: "Error",
                        message: 'La contraseña proporcionada es la misma que posee el usuario actualmente'
                    });
                }
            } else {
                res.status(400).json({
                    valid: false,
                    title: "Error",
                    message: 'La contraseña no puede ser cambiada, favor contacte a un administrador de sistema'
                });
            }
        }
    });
});

//AUTH ###################################################################
//########################################################################

//########################################################################
//INSTITUCIONES ##########################################################

router.get('/get_instituciones', verify_token, (req, res, next) => {
    var count_values = [];
    var count_query = "" +
        " SELECT COUNT(id) as total FROM" +
        " instituciones" +
        " WHERE" +
        " nombre != ''";
    if (req.query.nombre) {
        count_query = count_query + " AND nombre LIKE " + con.escape('%' + req.query.nombre + '%');
    }
    if (req.query.departamento) {
        count_query = count_query + " AND departamento = ?";
        count_values.push(req.query.departamento);
    }
    if (req.query.ciudad) {
        count_query = count_query + " AND ciudad = ?";
        count_values.push(req.query.ciudad);
    }
    if (req.query.calendario) {
        count_query = count_query + " AND calendario = ?";
        count_values.push(req.query.calendario);
    }
    if (req.query.tipo) {
        count_query = count_query + " AND tipo = ?";
        count_values.push(req.query.tipo);
    }
    con.query(count_query, count_values, function (count_err, count_results, count_fields) {
        if (count_err) {
            next(count_err);
        } else {
            var query = ""
            var values = [];
            if (req.query.sort_order) {
                var asc = '';
                if (req.query.sort_ascendent == 'true') {
                    var asc = ' ORDER BY ' + req.query.sort_order + ' ASC';
                } else {
                    var asc = ' ORDER BY ' + req.query.sort_order + ' DESC';
                }
                query = "" +
                    " SELECT * FROM" +
                    " instituciones" +
                    " WHERE" +
                    " nombre != ''";
                if (req.query.nombre) {
                    query = query + " AND nombre LIKE " + con.escape('%' + req.query.nombre + '%');
                }
                if (req.query.departamento) {
                    query = query + " AND departamento = ?";
                    values.push(req.query.departamento);
                }
                if (req.query.ciudad) {
                    query = query + " AND ciudad = ?";
                    values.push(req.query.ciudad);
                }
                if (req.query.calendario) {
                    query = query + " AND calendario = ?";
                    values.push(req.query.calendario);
                }
                if (req.query.tipo) {
                    query = query + " AND tipo = ?";
                    values.push(req.query.tipo);
                }
                query = query + asc + " LIMIT ?, ?";
                values.push(parseInt(req.query.current_offset));
                values.push(parseInt(req.query.view_length));
            } else {
                query = "" +
                    " SELECT * FROM" +
                    " instituciones" +
                    " WHERE" +
                    " nombre != ''";
                if (req.query.nombre) {
                    query = query + " AND nombre LIKE " + con.escape('%' + req.query.nombre + '%');
                }
                if (req.query.departamento) {
                    query = query + " AND departamento = ?";
                    values.push(req.query.departamento);
                }
                if (req.query.ciudad) {
                    query = query + " AND ciudad = ?";
                    values.push(req.query.ciudad);
                }
                if (req.query.calendario) {
                    query = query + " AND calendario = ?";
                    values.push(req.query.calendario);
                }
                if (req.query.tipo) {
                    query = query + " AND tipo = ?";
                    values.push(req.query.tipo);
                }
                query = query + " LIMIT ?, ?";
                values.push(parseInt(req.query.current_offset));
                values.push(parseInt(req.query.view_length));
            }
            con.query(query, values, function (err, results, fields) {
                if (err) {
                    next(err);
                } else {
                    res.status(200).json({ list: results, count: count_results[0].total });
                }
            });
        }
    });
});

router.post('/insert_institucion', verify_token, (req, res, next) => {
    var query = "" +
        " INSERT INTO instituciones" +
        " (" +
        " nombre," +
        " correo," +
        " telefono," +
        " departamento," +
        " ciudad," +
        " direccion," +
        " inicio_clases," +
        " calendario," +
        " tipo," +
        " contactos" +
        " tipo_pago" +
        " )" +
        " VALUES" +
        " (" +
        " ?," +
        " ?," +
        " ?," +
        " ?," +
        " ?," +
        " ?," +
        " ?," +
        " ?," +
        " ?," +
        " ?" +
        " )";
    var values = [
        req.body.nombre,
        req.body.correo,
        req.body.telefono,
        req.body.departamento,
        req.body.ciudad,
        req.body.direccion,
        req.body.inicio_clases,
        req.body.calendario,
        req.body.tipo,
        req.body.contactos
    ];
    con.query(query, values, function (err, results, fields) {
        if (err) {
            next(err);
        } else {
            res.status(200).json({
                title: "Institución Creada Exitosamente",
                message: 'La institución se ha creado de forma satisfactoria'
            });
        }
    });
});

router.put('/update_institucion', verify_token, (req, res, next) => {
    console.log(req.body)
    var query = "" +
        " UPDATE instituciones" +
        " SET nombre = ?," +
        " correo = ?," +
        " telefono = ?," +
        " departamento = ?," +
        " ciudad = ?," +
        " direccion = ?," +
        " inicio_clases = ?," +
        " calendario = ?," +
        " tipo = ?," +
        " contactos = ?" +
        " WHERE id = ?";
    var values = [
        req.body.nombre,
        req.body.correo,
        req.body.telefono,
        req.body.departamento,
        req.body.ciudad,
        req.body.direccion,
        req.body.inicio_clases,
        req.body.calendario,
        req.body.tipo,
        req.body.contactos,
        req.body.id
    ];
    con.query(query, values, function (err, results, fields) {
        if (err) {
            console.log(err)
            next(err);
        } else {
            res.status(200).json({
                title: "Institución Editada Exitosamente",
                message: 'La institución se ha editado de forma satisfactoria'
            });
        }
    });
});

router.delete('/delete_institucion', verify_token, (req, res, next) => {
    var query = "" +
        " DELETE FROM" +
        " instituciones" +
        " WHERE id = ?";
    var values = [
        req.query.id
    ];
    con.query(query, values, function (err, results, fields) {
        if (err) {
            next(err);
        } else {
            res.status(200).json({
                title: "Institución Eliminada Exitosamente",
                message: 'La institución se ha eliminado de forma satisfactoria'
            });
        }
    });
});

//DOCTORS ##########################################################
//########################################################################
router.get('/email_exists', verify_token, (req, res, next) => {
    let query_string = "";
    query_string = query_string + " SELECT EXISTS (SELECT * FROM doctors WHERE email = '" + request.query.email + "') AS response";
    con.query(query_string, function (err, result, fields) {
        if (err) {
            next(err)
        } else {
            return res.status(200).json({
                title: 'Correo Encontrado',
                message: 'El correo solicitado existe.'
            })
        }
    });
})

router.post('/insert_doctor', verify_token, (req, res, next) => {
    var query_string = "";
    query_string = query_string + " INSERT INTO users (username,password,creation_date,profile_id,active)";
    query_string = query_string + " VALUES (\"" + request.payload.username + "\",SHA1(\"" + request.payload.username + "\"),NOW(),2,1);";
    query_string = query_string + " SELECT LAST_INSERT_ID() AS response;";

    con.query(query_string, function (err, result, fields) {
        if (err) {
            console.log(err);
            return res.status(500).json({
                title: 'Error',
                message: err.message
            })
        } else {
            var foto = "";
            if (request.payload.foto != 'null') {
                foto = request.payload.foto;
            }
            var records = [
                [
                    result[0].insertId,
                    request.payload.institution_id,
                    request.payload.first_name,
                    request.payload.last_name,
                    request.payload.phone,
                    request.payload.extension,
                    request.payload.email,
                    request.payload.address,
                    request.payload.id_card,
                    request.payload.id_college,
                    request.payload.id_rtn,
                    request.payload.academic_information,
                    request.payload.background_information,
                    request.payload.position,
                    request.payload.working_hours,
                    foto
                ],
            ];
            var query_string2 = "";
            query_string2 = query_string2 + " INSERT INTO doctors";
            query_string2 = query_string2 + " (user_id,";
            query_string2 = query_string2 + " institution_id,";
            query_string2 = query_string2 + " first_name,";
            query_string2 = query_string2 + " last_name,";
            query_string2 = query_string2 + " phone,";
            query_string2 = query_string2 + " extension,";
            query_string2 = query_string2 + " email,";
            query_string2 = query_string2 + " address,";
            query_string2 = query_string2 + " id_card,";
            query_string2 = query_string2 + " id_college,";
            query_string2 = query_string2 + " id_rtn,";
            query_string2 = query_string2 + " academic_information,";
            query_string2 = query_string2 + " background_information,";
            query_string2 = query_string2 + " position,";
            query_string2 = query_string2 + " working_hours,";
            query_string2 = query_string2 + " foto)";
            query_string2 = query_string2 + " VALUES ?";

            con.query(query_string2, [records], function (err2, result2, fields2) {
                if (err2) {
                    console.log(err2);
                    return res.status(500).json({
                        title: 'Error',
                        message: err2.message
                    })
                } else {
                    return res.status(200).json({
                        title: 'Médico ingresado exitosamente',
                        message: 'El médico fue creado de manera satisfactoria'
                    })
                }
            });
        }
    });
})

router.put('/update_doctor', verify_token, (req, res, next) => {
    let foto = "";
    if (request.payload.foto != 'null') {
        foto = request.payload.foto;
    }
    let query_string = "";
    query_string = query_string + " UPDATE doctors";
    query_string = query_string + " SET institution_id=" + request.payload.institution_id + ",";
    query_string = query_string + " first_name='" + request.payload.first_name + "',";
    query_string = query_string + " last_name='" + request.payload.last_name + "',";
    query_string = query_string + " phone='" + request.payload.phone + "',";
    query_string = query_string + " extension='" + request.payload.extension + "',";
    query_string = query_string + " email='" + request.payload.email + "',";
    query_string = query_string + " address='" + request.payload.address + "',";
    query_string = query_string + " id_card='" + request.payload.id_card + "',";
    query_string = query_string + " id_college='" + request.payload.id_college + "',";
    query_string = query_string + " id_rtn='" + request.payload.id_rtn + "',";
    query_string = query_string + " academic_information='" + request.payload.academic_information + "',";
    query_string = query_string + " background_information='" + request.payload.background_information + "',";
    query_string = query_string + " position='" + request.payload.position + "',";
    query_string = query_string + " working_hours='" + request.payload.working_hours + "',";
    query_string = query_string + " foto='" + foto + "'";
    query_string = query_string + " WHERE doctor_id=" + request.payload.doctor_id + ";";
    con.query(query_string, function (err, result, fields) {
        if (err) {
            console.log(err);
            reply(-1);
        } else {
            reply(1);
        }
    });
})



// exports.update_doctor = {
// 	payload: {
//        maxBytes: Number.MAX_SAFE_INTEGER
//     },
//     handler: function(request, reply) {
//     	var foto = "";
//     	if(request.payload.foto!='null'){
//     		foto = request.payload.foto;
//     	}
//     	var query_string = "";
//     	query_string=query_string + " UPDATE doctors";
//     	query_string=query_string + " SET institution_id="+request.payload.institution_id+",";
// 		query_string=query_string + " first_name='"+request.payload.first_name+"',";
// 		query_string=query_string + " last_name='"+request.payload.last_name+"',";
// 		query_string=query_string + " phone='"+request.payload.phone+"',";
// 		query_string=query_string + " extension='"+request.payload.extension+"',";
// 		query_string=query_string + " email='"+request.payload.email+"',";
// 		query_string=query_string + " address='"+request.payload.address+"',";
// 		query_string=query_string + " id_card='"+request.payload.id_card+"',";
// 		query_string=query_string + " id_college='"+request.payload.id_college+"',";
// 		query_string=query_string + " id_rtn='"+request.payload.id_rtn+"',";
// 		query_string=query_string + " academic_information='"+request.payload.academic_information+"',";
// 		query_string=query_string + " background_information='"+request.payload.background_information+"',";
// 		query_string=query_string + " position='"+request.payload.position+"',";
// 		query_string=query_string + " working_hours='"+request.payload.working_hours+"',";
// 		query_string=query_string + " foto='"+foto+"'";
// 		query_string=query_string + " WHERE doctor_id="+request.payload.doctor_id+";";
//     	con.query(query_string, function (err, result, fields) {
// 		    if(err){
// 		    	console.log(err);
// 		    	reply(-1);
// 		    }else{
// 		    	reply(1);
// 		    } 
// 		});
//     }
// };

// exports.delete_doctor = {
//     handler: function(request, reply) {
//     	var query_string = "";
//     	query_string=query_string + " DELETE FROM doctors";
// 		query_string=query_string + " WHERE doctor_id = " + request.query.doctor_id;
//     	con.query(query_string, function (err, result, fields) {
// 		    if(err){
// 		    	console.log(err);
// 		    	reply(-1);
// 		    }else{
// 		    	reply(1);
// 		    } 
// 		});
//     }
// };

// exports.get_doctor = {
//     handler: function(request, reply) {
//     	var query_string = "";
//     	query_string=query_string + " SELECT doctors.*, users.username, institutions.name as institution_name FROM doctors";
// 		query_string=query_string + " INNER JOIN institutions ON doctors.institution_id = institutions.institution_id";
// 		query_string=query_string + " INNER JOIN users ON doctors.user_id = users.user_id";
// 		query_string=query_string + " WHERE doctor_id = " + request.query.doctor_id;
//     	con.query(query_string, function (err, result, fields) {
// 		    if(err){
// 		    	console.log(err);
// 		    	reply(-1);
// 		    }else{
// 		    	reply(result);
// 		    } 
// 		});
//     }
// };

// exports.get_doctors_list = {
//     handler: function(request, reply) {
//     	var query_string = "";
//     	query_string=query_string + " SELECT doctors.*, users.username, institutions.name as institution_name FROM doctors";
// 		query_string=query_string + " INNER JOIN institutions ON doctors.institution_id = institutions.institution_id";
// 		query_string=query_string + " INNER JOIN users ON doctors.user_id = users.user_id";
//     	con.query(query_string, function (err, result, fields) {
// 		    if(err){
// 		    	console.log(err);
// 		    	reply(-1);
// 		    }else{
// 		    	reply(result);
// 		    } 
// 		});
//     }
// };

// exports.get_doctors_institution_list = {
//     handler: function(request, reply) {
//     	var query_string = "";
//     	query_string=query_string + " SELECT doctors.*, users.username FROM doctors";
// 		query_string=query_string + " INNER JOIN users ON doctors.user_id = users.user_id";
// 		query_string=query_string + " WHERE doctors.institution_id = " + request.query.institution_id;
//     	con.query(query_string, function (err, result, fields) {
// 		    if(err){
// 		    	console.log(err);
// 		    	reply(-1);
// 		    }else{
// 		    	reply(result);
// 		    } 
// 		});
//     }
// };

//########################################################################
//GROUPS #################################################################

/*router.get('/get_groups', verify_token, (req, res, next) => {
    var query = "" +
    " SELECT id, grp_nombre FROM" +
    " smsreseller_grupos" +
    " WHERE" +
    " id NOT IN (SELECT smsreseller_grupos_id FROM smsreseller_listacrm)" +
    " AND smsreseller_grupos.tipo = 0" +
    " AND smsadmin_resellers_id = ?";
    var values = [
        req.smsadmin_resellers_id
    ];
    con.query(query, values, function(err, results, fields) {
        if(err) {
            next(err);
        }else{
            res.status(200).json(results);
        }
    });
});

router.post('/insert_group', verify_token, (req, res, next) => {
    var query = "" +
    " INSERT INTO smsreseller_grupos" +
    " (" +
    " grp_nombre," +
    " smsadmin_resellers_id" + 
    " )" +
    " VALUES" +
    " (" +
    " ?," +
    " ?" +
    " )";
    var values = [
        req.body.grp_nombre,
        req.smsadmin_resellers_id
    ];
    con.query(query, values, function(err, results, fields) {
        if(err){
            next(err);
        }else{
            res.status(200).json({
                title:"Grupo Creado Exitosamente", 
                message:'El grupo se ha creado de forma satisfactoria'
            });
        }
    });
});

router.put('/update_group', verify_token, (req, res, next) => {
    var query = "" +
    " UPDATE smsreseller_grupos" +
    " SET grp_nombre = ?" +
    " WHERE id = ?";
    var values = [
        req.body.grp_nombre,
        req.body.id
    ];
    con.query(query, values, function(err, results, fields) {
        if(err){
            next(err);
        }else{
            res.status(200).json({
                title:"Grupo Editado Exitosamente", 
                message:'El grupo se ha editado de forma satisfactoria'
            });
        }
    });
});

router.delete('/delete_group', verify_token, (req, res, next) => {
    var query = "" +
    " DELETE FROM" +
    " smsreseller_grupos" +
    " WHERE id = ? AND smsadmin_resellers_id = ?";
    var values = [
        req.query.id,
        req.smsadmin_resellers_id
    ];
    con.query(query, values, function(err, results, fields) {
        if(err) {
            next(err);
        }else{
            res.status(200).json({
                title:"Grupo Eliminado Exitosamente", 
                message:'El grupo se ha eliminado de forma satisfactoria'
            });
        }
    });
});*/

//GROUPS #################################################################
//########################################################################

//########################################################################
//CATALOGS ###############################################################

//CATALOGS ###############################################################
//########################################################################

//########################################################################
//UTILS ##################################################################

function generate_recovery_code(size) {
    var result = '';
    var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    for (var i = 0; i < size; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}

function encrypt(text) {
    var cipher = crypto.createCipher(algorithm, Buffer.from(key), iv)
    var crypted = cipher.update(text, 'utf8', 'hex')
    crypted += cipher.final('hex');
    return crypted;
}

function decrypt(text) {
    var decipher = crypto.createDecipher(algorithm, Buffer.from(key), iv)
    var dec = decipher.update(text, 'hex', 'utf8')
    dec += decipher.final('utf8');
    return dec;
}

//UTILS ##################################################################
//########################################################################

module.exports = router;
var express = require('express');
var app = express();
var bodyParser = require("body-parser");
var fs = require('fs');
var path = require('path');
var dateFormat = require('dateformat');
var now = new Date();
var PythonShell = require('python-shell');

app.use(express.static(__dirname + '/public'));
app.use(bodyParser.json());

process.on('uncaughtException', function(err) {
    console.error((err && err.stack) ? dateFormat(now) + '   ' + err.stack : dateFormat(now) + '   ' + err);
});

var globalName = '';
var globalType = '';

var HOST = process.argv[2] || '127.0.0.1';
console.log('Will start on host: %s', HOST);

var PORT = process.argv[3] || 3032;
console.log('Will start on port: %s', PORT);

cleanFolder = function(dirPath, removeSelf) {
    if (removeSelf === undefined)
        removeSelf = true;
    try { var files = fs.readdirSync(dirPath); }
    catch(e) { return; }
    if (files.length > 0)
        for (var i = 0; i < files.length; i++) {
            var filePath = dirPath + '/' + files[i];
            if (fs.statSync(filePath).isFile())
                fs.unlinkSync(filePath);
            else
                cleanFolder(filePath);
        }
    if (removeSelf)
        fs.rmdirSync(dirPath);
};

if (!fs.existsSync(__dirname + '/parts')){
    fs.mkdirSync(__dirname + '/parts');
}

if (!fs.existsSync(__dirname + '/output')){
    fs.mkdirSync(__dirname + '/output');
}

if (!fs.existsSync(__dirname + '/log')){
    fs.mkdirSync(__dirname + '/log');
}

if (!fs.existsSync(__dirname + '/csr')){
    fs.mkdirSync(__dirname + '/csr');
}

if (!fs.existsSync(__dirname + '/login')){
    fs.mkdirSync(__dirname + '/login');
}

cleanFolder(__dirname + '/output', false);
cleanFolder(__dirname + '/parts', false);
cleanFolder(__dirname + '/csr', false);

var OS = process.platform;

console.log(dateFormat(now) + '   ' + 'OS is ' + OS);

//if(OS.indexOf('linux') >= 0){
//
//    console.log(dateFormat(now) + '   ' + 'OS is linux!');
//
//    var exec = require('child_process').exec;
//
//    var installPythonCmd = '';
//
//    var pythonDependencies = 'apt-get -y install python-httplib2 python-pyasn1 python3-pyasn1-modules';
//
//    exec(pythonDependencies, function (error, stdout, stderr) {
//        if(error) console.error(error);
//        else{
//            console.log(dateFormat(now) + '   ' + 'Python dependencies are installed.')
//        }
//    });
//}
//
//else{
//
//}



app.post('/generateCsr', function(req, res){

        var domain = req.body.domain;
        globalName = domain;
        globalType = 'startssl';

        console.log(dateFormat(now) + '   ' + 'Starting to process ' + "'" + domain + "'" + ' request.');

        var domainKeyPath = __dirname + path.normalize(path.join('/csr', domain + '.key'));

        var createKeyCmd = 'openssl genrsa -out ' + domainKeyPath + ' 2048';

        var exec = require('child_process').exec;
        exec(createKeyCmd, function (error, stdout, stderr) {

            if (error) {
                console.log(dateFormat(now) + error);
                return res.status(400).send(error);
            }

            console.log(dateFormat(now) + '   ' + domain + '.key' + ' created in ' + domainKeyPath);

            var reqOptions = {
                C: 'UA',
                ST: 'KY',
                L: 'KYIV',
                O: 'RadacodeInc.',
                OU: 'DEV',
                CN: domain,
                email: 'pembuilder@radacode.net'
            };

            //can be problems with ' or ", depends on OS

            var options = '\"/C=' + reqOptions.C + '/ST=' + reqOptions.ST + '/L=' + reqOptions.L + '/O=' + reqOptions.O + '/OU=' + reqOptions.OU + '/CN=' + reqOptions.CN + '/email=' + reqOptions.email + '\"';

            var domainCsrPath = __dirname + path.normalize(path.join('/csr', domain + '.csr'));

            var createCsrCmd = 'openssl req -new -sha256 -key ' + domainKeyPath + ' -out ' + domainCsrPath + ' -subj ' + options;

            exec(createCsrCmd, function (error, stdout, stderr) {

                if (error) {
                    console.log(dateFormat(now) + error);
                    return res.status(400).send(error);
                }

                console.log(dateFormat(now) + '   ' + domain + '.csr' + ' created in ' + domainCsrPath);

                //var startsslPyPath = __dirname + path.normalize(path.join('/', 'startssl.py'));

                    if(OS.indexOf('win') >=0){
                        var options = {
                            args: ['csr', domainCsrPath]
                        };
                    }
                    else{
                        var options = {
                            args: ['csr', domainCsrPath],
                            scriptPath: '/etc/pembuilder/'
                        };
                    }

                    PythonShell.run('startssl.py', options, function (err, results) {
                        if (err) {
                            console.log(dateFormat(now) + err);
                            return res.status(400).send(err);
                        }

                        console.log(dateFormat(now) + '   ' + '%j', results);

                        if(OS.indexOf('win') >=0){
                            console.log('WINDOWS');
                            var options = {
                                args: ['certs', domain]
                            };
                        }
                        else{
                            console.log('LINUX');
                            var options = {
                                args: ['certs', domain],
                                scriptPath: '/etc/pembuilder/'
                            };
                        }


                        PythonShell.run('startssl.py', options, function (err, results) {
                            if (err) {
                                console.log(dateFormat(now) + err);
                                return res.status(400).send(err);
                            }

                            console.log(dateFormat(now) + '   ' + '%j', results);

                            var domainCrtPath = __dirname + path.normalize(path.join('/', domain + '.crt'));
                            var domainCrtPathOutput = __dirname + path.normalize(path.join('/output', domain + '.crt'));

                            fs.createReadStream(domainCrtPath).pipe(fs.createWriteStream(domainCrtPathOutput));

                            console.log(dateFormat(now) + '   ' + 'Created ' + domainCrtPathOutput);

                            fs.unlink(domainCrtPath, function () {

                                var crtPath = __dirname + path.normalize(path.join('/output', globalName + '.crt'));
                                var pemPath = __dirname + path.normalize(path.join('/output', globalName + '.pem'));

                                var cmdCrtToPem = 'openssl x509 -in '  + crtPath + ' -out ' + pemPath + ' -outform PEM';

                                var exec = require('child_process').exec;

                                exec(cmdCrtToPem, function (error, stdout, stderr) {

                                    console.log(dateFormat(now) + '   ' + 'Created ' + pemPath);

                                    fs.readFile(pemPath, 'utf8', function(err, data){
                                        res.end(data);
                                        console.log(dateFormat(now) + '   ' + domain + ' sent to frontend.');
                                    });

                                });

                            });

                        });

                    });
            });
        });
});

app.post('/builder', function(req, res){
        var data = req.body;
        var name = data.name;
        globalName = name;
        globalType = 'custom';


        var noIntAndRoot = data.noIntAndRoot;
        var type = data.type;
            if(type == 'custom'){

                if(!noIntAndRoot){
                    var int = data.int;
                    var root = data.root;
                }

                else{
                    var intPath = path.normalize(path.join('/startssl', 'startsslInt.pem'));
                    var rootPath =  path.normalize(path.join('/startssl', 'startsslRoot.pem'));

                    var int = fs.readFileSync(__dirname + intPath, 'utf-8');
                    var root = fs.readFileSync(__dirname + rootPath, 'utf-8');
                }}


        var crt = data.crt;
        var pk = data.pk;
        var pass = data.pass;
        var hasNoPass = data.hasNoPass;


        console.log(dateFormat(now) + '   ' + 'Starting to process ' + "'" + name + "'" +  ' request.');


        var pkPath = path.normalize(path.join('/parts', name + '-pk.pem'));
        fs.writeFile(__dirname + pkPath, pk, function (err) {
            if (err) {
                console.log(dateFormat(now) + err);
                return res.status(400).send(err);
            }

        if(pass != '' && pass != undefined && !hasNoPass) {

            console.log(dateFormat(now) + '   ' + 'Key for ' + "'" + name + "'" + ' has password.');
            var exec = require('child_process').exec;

            var pkNoPassPath = path.normalize(path.join('/parts', name + '-pk-nopass.pem'));

            var cmd = 'openssl rsa -in ' + __dirname + pkPath + ' -out ' + __dirname + pkNoPassPath + ' -passin pass:' + pass;

            exec(cmd, function (error, stdout, stderr) {
                console.log(dateFormat(now) + '   ' + 'Decryping ' + "'" + name + "'" + ' private key.');
                if (error !== null) {
                    console.log(dateFormat(now) + err);
                    return res.status(400).send('Wrong password');
                }

                else {

                    fs.readFile(__dirname + pkNoPassPath, 'utf-8', function (err, data) {

                        if (err) {
                            console.log(dateFormat(now) + err);
                            return res.status(400).send(err);
                        }


                        console.log(dateFormat(now) + '   ' + 'Key for '  + "'" + name + "'" + ' decrypted and placed to /parts as ' + name + '-pk-nopass.pem');

                        var pk_nopass = data;

                        var fullPem = crt + '\n' + int + '\n' + root + '\n' + pk_nopass;


                        console.log(dateFormat(now) + '   ' + 'Merging ' + "'" + name + "'" + ' parts together.');

                        var fullPemPath = path.normalize(path.join('/parts', name + '.pem'));
                        var fullPemOutput = path.normalize(path.join('/output', name + '.pem'));

                        fs.writeFile(__dirname + fullPemPath, fullPem, function (err) {
                            if (err) {
                                console.log(dateFormat(now) + err);
                                return res.status(400).send(err);
                            }
                            fs.writeFile(__dirname + fullPemOutput, fullPem, function (err) {
                                if (err) {
                                    console.log(dateFormat(now) + err);
                                    return res.status(400).send(err);
                                }


                                console.log(dateFormat(now) + '   ' + 'Writing '+ "'" + name + "'" +  ' to output folder.');

                                res.end(fullPem, function (err) {
                                    if (err) {
                                        console.log(dateFormat(now) + err);
                                        return res.status(400).send(err);
                                    }
                                    console.log(dateFormat(now) + '   ' + name + ' sent to frontend.');
                                    cleanFolder(__dirname + '/parts', false);
                                });
                            });
                        });
                    });
                }
            });
        }
        else {

            console.log(dateFormat(now) + '   ' + 'Key for ' + "'" + name + "'" + ' has no password.');

            var fullPem = crt + '\n' + int + '\n' + root + '\n' + pk;


            console.log(dateFormat(now) + '   ' + 'Merging ' + "'" + name + "'" + ' parts together.');

            var fullPemPath = path.normalize(path.join('/parts', name + '.pem'));
            var fullPemOutput = path.normalize(path.join('/output', name + '.pem'));

            fs.writeFile(__dirname + fullPemPath, fullPem, function (err) {
                if (err) {
                    console.log(dateFormat(now) + err);
                    return res.status(400).send(err);
                }
                fs.writeFile(__dirname + fullPemOutput, fullPem, function (err) {
                    if (err) {
                        console.log(dateFormat(now) + err);
                        return res.status(400).send(err);
                    }


                        console.log(dateFormat(now) + '   ' + 'Writing '+ "'" + name + "'" +  ' to output folder.');

                        res.end(fullPem, function (err) {
                        if (err) {
                            console.log(dateFormat(now) + err);
                            return res.status(400).send(err);
                        }
                            console.log(dateFormat(now) + '   ' + name + ' sent to frontend.');
                            cleanFolder(__dirname + '/parts', false);
                        });
                });
            });
         }
        });
});

app.get('/download', function (req, res) {

        cleanFolder(__dirname + '/parts', false);

        var file = path.normalize(path.join('/output', globalName + '.pem'));
        res.download(__dirname + file, function (err) {
            if (err) {
                console.log(dateFormat(now) + err);
                return res.status(400).send(err);
            }
            console.log(dateFormat(now) + '   ' + 'Downloading ' + globalName + '.pem');
        });
});

app.get('/log', function(req, res){
    var file = fs.readFileSync(__dirname + '/log/pem-builder-log.log', 'utf8');
    res.end(file);
});

var server = app.listen(PORT,HOST, function () {
    var host = server.address().address;
    var port = server.address().port;

    var writable = fs.createWriteStream(__dirname + '/log/pem-builder-log.log');
    process.stdout.write = process.stderr.write = writable.write.bind(writable);

    console.log(dateFormat(now) + '   ' + 'PEMbuilder listening at http://%s:%s', host, port);
    console.log(dateFormat(now) + '   ' + 'Current dir ' + __dirname);



});



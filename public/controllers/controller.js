var myApp = angular.module('myApp', ['cgNotify', 'angular-loading-bar']);

myApp.controller('AppCtrl', ['$scope', '$http', 'notify',  function($scope, $http, notify) {
    console.log("controller.js is working");

    //for hiding/showing full pem crt
    $scope.fullpem = true;
    $scope.showHidePem = function() {
        $scope.fullpem = $scope.fullpem === false ? true: false;
    };

    //for pasting from <input type=file> to <textarea>
    function copyTo(from, to){
        var control = document.getElementById(from);
        control.addEventListener("change", function(event){
            var reader = new FileReader();
            reader.onload = function(event){
                var contents = event.target.result;
                document.getElementById(to).value = contents;
                document.getElementById(to).setAttribute("class", "uk-form-success");

                var textareaName = document.getElementById(to).attributes["name"].value;
                if(textareaName == 'crt') { $scope.AppForm.crt.$invalid = false; }
                if(textareaName == 'int') { $scope.AppForm.int.$invalid = false; }
                if(textareaName == 'root') { $scope.AppForm.root.$invalid = false; }
                if(textareaName == 'pk') {
                    $scope.AppForm.pk.$invalid = false;

                    var pkSplitedByEmptyStrings = document.getElementById(to).value.split('\n\n');
                    var firstPart_PK = pkSplitedByEmptyStrings[0];

                    if(document.getElementById(to).value.indexOf('RSA PRIVATE KEY') >= 0 && firstPart_PK.indexOf('ENCRYPTED') == -1){
                        console.log('RSA FOUND');
                        document.getElementById("hasNoPass").checked = true;
                        $scope.$apply(function() {
                            $scope.pem.hasNoPass = true;
                        });
                    }
                }

            };
            reader.onerror = function(event){
                console.error("File could not be read! Code " + event.target.error.code);
            };
            console.log("Filename: " + control.files[0].name);
            reader.readAsText(control.files[0]);
        }, false);
    }

    document.getElementById("intUploader").click(copyTo('intUploader','intHere'));
    document.getElementById("crtUploader").click(copyTo('crtUploader','crtHere'));
    document.getElementById("rootUploader").click(copyTo('rootUploader','rootHere'));
    document.getElementById("pkUploader").click(copyTo('pkUploader','pkHere'));

    if(document.getElementById('pass').value != ''){ $scope.AppForm.pass.$invalid = false;}


    //download button
    $scope.downloadPem = function(){
        window.location.href = '/download';
    };

    $scope.log = function(){

        $http.get('/log').success(function(response){
            console.log(response);
        });

    };

    $scope.generateCsr = function(){

        $http.post('/generateCsr', $scope.ssl)
        .then(function successCallback(response) {
                console.log('Status code ' + response.status);
                $scope.PEM = response.data;
                $scope.buttons = true;

                notify({ message:'Congratulations. Your certificate is ready!',
                         classes:['uk-form-success']} );
        }
            , function errorCallback(response) {
                console.log('Status code ' + response.status);
                notify({ message: 'Pembuilder service is unavailable right now. Please check back later.',
                         classes:['uk-form-danger']} );
        });

        console.log($scope.ssl);
    };


    $scope.sendParts = function() {

        //make sure all fields gonna be send
        $scope.pem.crt = document.getElementById("crtHere").value;
        $scope.pem.int = document.getElementById("intHere").value;
        $scope.pem.root = document.getElementById("rootHere").value;
        $scope.pem.pk = document.getElementById("pkHere").value;

        if(document.getElementById("hasNoPass").checked == true){
            $scope.pem.pass = '';
        }

        if(document.getElementById("start").checked == true){
            $scope.pem.int = '';
            $scope.pem.root = '';
        }

        if (document.getElementById("custom").checked == true) {
            $scope.pem.type = 'custom';
        }
        else {
            $scope.pem.type = 'start';
        }

        //sending to nodeJS backend
        $http.post('/builder', $scope.pem)
            .then(function successCallback(response) {
                console.log('Status code ' + response.status);

                $scope.PEM = response.data;

                //show download/view buttons
                $scope.buttons = true;

                notify({ message:'Congratulations. Your certificate is ready!',
                         classes:['uk-form-success']} );
            }
            , function errorCallback(response) {
                console.log('Status code ' + response.status);

                notify({ message:'Wrong password!',
                         classes:['uk-form-danger']} );

                console.log("Received from backend " + response);
            });


        console.log($scope.pem);
    };

}]);
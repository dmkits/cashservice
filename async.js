
var neighbors=['Vanya', 'Masha', 'Serg'];
var count=5;

function getRandomArbitrary(min, max) {
    return Math.floor(Math.random() * (max - min)) + min;
}

var potatoBoom = function(callback){
    var neghbor = neighbors[getRandomArbitrary(0,2)];

    var timeout=getRandomArbitrary(20,200);
    setTimeout(function(){
        callback(neghbor);
    }, timeout);
};

//var is=[];
//for (var i=0; i<count; i++){                   console.log("for",i);
//    is.push(i);
//    setTimeout(function(){
//        console.log("setTimeout",i);
//    }, 0);
//}console.log("for finished");

for (var i=0; i<count; i++){                   console.log("for ",i);

    //var f=function(i){                          console.log("f ",i);
    //
    //    setTimeout(function(){
    //        console.log("setTimeout ",i);
    //    }, 0);
    //
    //};
    //f(i);

    (function(i){                          console.log("f ",i);

        setTimeout(function(){
            console.log("setTimeout ",i);
        }, 0);

    })(i);
}console.log("for finished");
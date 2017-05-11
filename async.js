
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

function test1(){
    var t1 = 1;                  console.log("t2 47=",t2,"j=",j);
    for(var j =0; j<5; j++) {
        var t2 = j;             console.log("t2 49=",t2);
    }
       console.log("t2 52=",t2,"j=",j);
}
test1();
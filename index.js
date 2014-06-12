var path = require('path'),
    glob = require('glob'),
    fs   = require('fs'),
    events = require("events"),
    bowerResolve = require('bower-resolve');

var DIRECTIVE_REGEX = /^[\/\s#]*?=\s*?(require|include)\s+(\[.*\]|\S*)(.*$)/mg,
    requiredFiles = {},
    defaultTarget = null,
    timer;

module.exports = function (entryPoint) {
    requiredFiles = {};
    defaultTarget = null;
    timer = new Date().getTime();

    return includeFile(entryPoint);

};

module.exports.byTarget = function(entryPoint, userDefault){
    requiredFiles = {};
    defaultTarget = userDefault;
    timer = new Date().getTime();


    var internalEE = new events.EventEmitter();

    var retTargets = {};
    internalEE.on('target', function(targetName, targetContents){
        retTargets[targetName] = (retTargets[targetName] || "") + targetContents;
    });

    includeFile(entryPoint, internalEE, true);

    return retTargets;

};


//Returns a list of the unique required files in order.
//On recursive includes calls, files at the bottom of the stack are included first
//Important: this call does not alter the default behavior, such as when a previously
//included file is required.
module.exports.getRequireList = function(entryPoint){
    requiredFiles = {};
    defaultTarget = null;
    timer = new Date().getTime();

    var internalEE = new events.EventEmitter();
    var requireList = [];

    internalEE.on('requiredFile', function(fileName){
        requireList.push(fileName)
    });

    includeFile(entryPoint, internalEE, true);

    return unique(requireList);

};

function includeFile(filePath, ee, isFirst){


    //this is a temporary solution to catch circular includes.
    //To do it properly, we need create a graph of all files included in each file
    //and then look for circular includes
    if((new Date().getTime()) - timer > 50){
        throw 'You probably have a recursive include! Check your include comments';
        return;
    }

    var fileContents = String(fs.readFileSync(filePath)),
        replacedText = fileContents,
        basePath = path.dirname(filePath),
        directives = [],
        match;

    DIRECTIVE_REGEX.lastIndex = 0;

    while(match = DIRECTIVE_REGEX.exec(fileContents)) {
        match.basePath = basePath;
        directives.push(_parseDirective(match));
    }

    if(directives.length === 0) return fileContents;

    directives.forEach(function(aDirective, i){
        directives[i].files.forEach(function(fileName){

            var fileContents = "";
            if(directives[i].options['noParse']){
                fileContents = String(fs.readFileSync(fileName));
            } else{
                fileContents = includeFile(fileName, ee);
            }

            var isRequire = directives[i].directiveType.indexOf('require') !== -1;

            if(isRequire){
                if(requiredFiles[fileName]) return;
                requiredFiles[fileName] = true;
            }

            if(ee){
                if(defaultTarget && isFirst){
                    var targets = directives[i].options.targets || [defaultTarget];
                    targets.forEach(function(targetName){
                        ee.emit('target', targetName, fileContents + "\n");
                    })
                }
                ee.emit('requiredFile', path.join(process.cwd(), fileName));
            }


            directives[i].includedText += fileContents + "\n";

        })
    });

    var q = directives.length;
    while(q--){
        replacedText = replaceStringByIndices(replacedText, directives[q].start, directives[q].end, directives[q].includedText);
    }
    return replacedText;

}


function _parseDirective(match){

    var matchInfo = {
        original: match[0],
        directiveType: match[1],
        basePath: match.basePath,
        start: match.index,
        end: match.index + match[0].length,
        includedText: "",
        options: {},
        files: []
    };

    matchInfo.options = _parseOptions(match[3]);
    matchInfo.files = _getFiles(match[2], matchInfo);

    return matchInfo;
}

function _parseOptions(optionsString){
    var options = {}
    var tempOptions = optionsString.split(" -").slice(1) || [];
    tempOptions.forEach(function(val){
        var temp = val.split(" ");

        if(temp[0] === 'target'){
            if(!options['targets']) options['targets'] = [];
            options['targets'].push(temp[1]);
        } else{
            options[temp[0]] = temp[1] || true;
        }

        if(!options[temp[0]]){

        } else{
            if(temp[0] === 'target'){
                options['target'].push(temp)
            }
        }

    });
    return options;
}

function _getFiles(fileArg, matchInfo){
    var filesToExclude = [];
    var fileList = [];

    if(fileArg.charAt(0) === '['){
        var tempFileArr = eval(fileArg);
        for(var i = 0; i < tempFileArr.length; i++){
            var exclude = false;
            if(exclude = (tempFileArr[i].charAt(0) === "!")) {
                tempFileArr[i] = tempFileArr[i].slice(1);
            }

            var files = _resolveGlob(tempFileArr[i], matchInfo);

            if(files.length == 0) break;

            if(exclude){
                filesToExclude = union(filesToExclude, files)
            } else{
                fileList = union(fileList, files)
            }
        }

        fileList = difference(fileList, filesToExclude);

    } else{
        fileList = _resolveGlob(fileArg, matchInfo);
    }

    return fileList;
}

function _resolveGlob(thisGlob, directiveInfo){
    var files;
    var resolve = directiveInfo.options.resolve || 'default';

    switch(resolve){
        case 'bower':
            files = bowerResolve.fastReadSync(thisGlob, {basedir: directiveInfo.basePath});
            if(typeof files !== 'object'){
                files = [files]; //this is what usually happens
            }
            break;
        default:
            files = glob.sync(directiveInfo.basePath + "/" + thisGlob, {mark: true});
            break;
    }

    files = files.filter(function(val){ //remove directories in the file list
        return !(/[\\\/]/.test(val.charAt(val.length - 1)))
    });

    files = files.map(function(val){
        return forwardSlashNormalize(val);
    });

    return files;
}

function replaceStringByIndices(string, start, end, replacement){
    return string.substring(0, start) + replacement + string.substring(end);
}

function union(arr1, arr2){
    if(arr1.length == 0) return arr2;

    return arr1.concat(arr2).filter(function(itm,i,a){
        return i==a.lastIndexOf(itm);
    });

}

function unique(arr1){
    return union(arr1, arr1);
}

function difference(arr1, arr2){
    var index;
    for(var i = 0; i < arr2.length; i++){
        while((index = arr1.indexOf(arr2[i])) !== -1){
            arr1.splice(index, 1)
        }
    }
    return arr1;
}

function forwardSlashNormalize(filePath){
    return path.normalize(filePath).replace(/\\/g, '/');
}

function shallowMerge(obj1,obj2){
    var obj3 = {};
    for (var attrname in obj1) { obj3[attrname] = obj1[attrname]; }
    for (var attrname in obj2) { obj3[attrname] = obj2[attrname]; }
    return obj3;
}
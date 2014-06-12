var should	= require("should"),
	include	= require("../index"),
	fs		= require("fs"),
    vm      = require('vm'),
    path    = require('path');


describe("file-include", function() {

  /*describe("directive matching", function() {
    // Load the module indirectly, so that we can access
    // the DIRECTIVE_REGEX
    exports = {};
    include_module =  {
       require: require,
       console: console,
       exports: exports,
       module: {
         exports: exports
       }
    }
    vm.runInNewContext(fs.readFileSync('index.js'), include_module)

    beforeEach(function(done){
      include_module.DIRECTIVE_REGEX.lastIndex = 0
      done()
    })

    it ("should match require", function () {
      matches = include_module.DIRECTIVE_REGEX.exec("= require src/blah.js")
      should.exist(matches)
      matches[0].should.eql('= require src/blah.js')
      matches[1].should.eql('require')
      matches[2].should.eql('src/blah.js')
    })


    it ("should match include", function () {
      matches = include_module.DIRECTIVE_REGEX.exec("= include src/blah.js")
      should.exist(matches)
      matches[0].should.eql('= include src/blah.js')
      matches[1].should.eql('include')
      matches[2].should.eql('src/blah.js')
    })

  
    it ("should not match 'var x = require(blah)'", function() {
      matches = include_module.DIRECTIVE_REGEX.exec("var x = require('fakemod')")
      should.not.exist(matches)
    })

    it ("should match relative requires", function() {
      matches = include_module.DIRECTIVE_REGEX.exec("= include ../src/blah.js")
      should.exist(matches)
      matches[0].should.eql('= include ../src/blah.js')
      matches[1].should.eql('include')
      matches[2].should.eql('../src/blah.js')
    })

    it ("should work with grunt style array globs", function() {
        matches = include_module.DIRECTIVE_REGEX.exec("= require ['blah', '*']")
        should.exist(matches)
        matches[1].should.eql('require');
        matches[2].should.eql('[\'blah\', \'*\']');
    })

    it ("should work with options", function() {
      matches = include_module.DIRECTIVE_REGEX.exec("= require ['blah', '*'] -resolve bower -target lib.js")
      should.exist(matches)
      matches[1].should.eql('require');
      matches[2].should.eql('[\'blah\', \'*\']');
      matches[3].should.eql(' -resolve bower -target lib.js');
    })

  })*/

 describe("File replacing", function() {

 /*
     include("src/app/app.js"); // = 'some strings'
     include.getRequireList('src/app/app.js'); // = ['firstFile.js', 'secondFile.js']
     include.byTargets('src/app/app.js', 'mainPartition'); // = {mainPartition: 'some strings', secondPartition: 'another string'}
*/
     it("Should work on simple includes, including grunt array style globs", function(done) {
         var newFile = include('test/fixtures/globs/app.js');
         should.exist(newFile);
         newFile = stripAllWhiteSpace(String(newFile));
         var oldFile = stripAllWhiteSpace(String(fs.readFileSync("test/expected/app_globs.js")));
         newFile.should.equal(oldFile);
         done();
     });

     it("Should work on recursive includes", function(done) {

         var newFile = include('test/fixtures/app_recursive.js')
         should.exist(newFile);
         newFile = stripAllWhiteSpace(String(newFile));
         var oldFile = stripAllWhiteSpace(String(fs.readFileSync("test/expected/app_recursive.js")));
         newFile.should.equal(oldFile);
         done();
     });


     it("Should resolve complex options, including bower resolve and noParse", function(done) {

         var newFile = include('test/fixtures/app_with_options.js')
         should.exist(newFile);
         newFile = stripAllWhiteSpace(String(newFile));
         var oldFile = stripAllWhiteSpace(String(fs.readFileSync("test/expected/app_with_options.js")));
         newFile.should.equal(oldFile);
         done();
     })


     it("Should produce a list of files by target", function(done) {

         var targets = include.byTarget('test/fixtures/app_targets.js', 'main');

         should.exist(targets['main']);
         should.exist(targets['lib']);
         should.exist(targets['anotherLib']);

         stripAllWhiteSpace(targets['lib']).should.equal(stripAllWhiteSpace('a content\nis_recursive content\ra content\n\r\n\n'));
         stripAllWhiteSpace(targets['main']).should.equal(stripAllWhiteSpace('a content\n'));
         stripAllWhiteSpace(targets['anotherLib']).should.equal(stripAllWhiteSpace('a content\n'));

         done();
     });


     it("Should produce a list of all required files in the order they were required on the main data channel", function(done) {

         var fileList = include.getRequireList('test/fixtures/app.js');

         var expectedFiles = ['sample.js', 'header.txt', 'a.js', 'b.js', 'c.js', 'd.js', 'f.js', 'nested_txt.txt', 'nested_txt2.txt', 'e.js'];
         fileList.length.should.equal(10);
         fileList.forEach(function(file, i){
            path.basename(file).should.equal(expectedFiles[i]);
         });

         done();
     });

     it('Should time out recursive or cyclical includes', function(done){

         (function(){
             include('test/fixtures/error/a.js')
         }).should.throw();

         done();



     });

  })
});

function stripAllWhiteSpace(string){
    return string.replace(/\s/g, '')
}

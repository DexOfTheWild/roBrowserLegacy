module.exports = function(grunt) {
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    watch: {
      livereload: {
        options: {
          livereload: true
        },
        files: ['dist/Web/styles/**/*'],
      },
    }
  });

  grunt.loadNpmTasks('grunt-contrib-watch');

  // Default task(s)
  grunt.registerTask('default', ['watch']);
};

const gulp = require("gulp");
const browserify = require("browserify");
const source = require("vinyl-source-stream");
const watchify = require("watchify");
const tsify = require("tsify");
const fancy_log = require("fancy-log");

const watchedBrowserify = (
    browserify({
        basedir: ".",
        debug: true,
        entries: ["./src/setup/main.ts"],
        cache: {},
        packageCache: {},
        exclude: []
    }).plugin(tsify, {
        emitDecoratorMetadata: true,
        experimentalDecorators: true
    })
);

function bundle() {
    return watchedBrowserify
        .bundle()
        .on("error", fancy_log)
        .pipe(source("bundle.js"))
        .pipe(gulp.dest("./dist"));
}

gulp.task("default", gulp.series(bundle));
watchedBrowserify.on("update", bundle);
watchedBrowserify.on("log", fancy_log);
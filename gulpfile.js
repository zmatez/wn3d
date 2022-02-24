const gulp = require("gulp");
const browserify = require("browserify");
const source = require("vinyl-source-stream");
const watchify = require("watchify");
const tsify = require("tsify");
const fancy_log = require("fancy-log");

const mainify = (
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

function bundleMain() {
    return mainify
        .bundle()
        .on("error", fancy_log)
        .pipe(source("bundle.js"))
        .pipe(gulp.dest("./dist"));
}

// worker
const workerify = (
    browserify({
        basedir: ".",
        debug: true,
        entries: ["./src/workers/ChunkWorker.ts"],
        cache: {},
        packageCache: {},
        exclude: []
    }).plugin(tsify, {
        emitDecoratorMetadata: true,
        experimentalDecorators: true
    })
);

function bundleWorker() {
    return workerify
        .bundle()
        .on("error", fancy_log)
        .pipe(source("bundle_worker.js"))
        .pipe(gulp.dest("./dist"));
}

// tasks

gulp.task("default", gulp.series(bundleMain,bundleWorker));
mainify.on("update", () => {
    bundleMain()
    bundleWorker()
});
mainify.on("log", fancy_log);
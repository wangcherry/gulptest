//引入组件
var gulp = require('gulp'),
    //获取参数
    argv = require('yargs').argv,
    //
    exec = require('sync-exec'),
    //提供一些操作系统相关的方法
    os = require('os'),
    //是filesystem的缩写，提供本地文件的读写能力，模块几乎对所有操作提供异步和同步两种操作方式
    fs = require('fs'),
    //处理文件路径
    path = require('path'),
    //
    useref = require('gulp-useref'),
    gulpif = require('gulp-if'),
    clean = require('gulp-clean'),
    //合并压缩文件
    uglify = require('gulp-uglify'),
    ngAnnotate = require('gulp-ng-annotate'),
    minifyCss = require('gulp-minify-css'),
    imagemin = require('gulp-imagemin'),
    pngquant = require('imagemin-pngquant'),
    rev = require('gulp-rev'),
    revReplace = require('gulp-rev-replace'),
    runSequence = require('run-sequence');

// dev server
var livereload = require('gulp-livereload'),
    express = require('express'),
    body = require('body-parser'),
    openurl = require('openurl'),
    tinylr = require('tiny-lr'),
    ftl2html = require('ftl2html'),
    server = tinylr();

// deploy git
var deployGit = require('shark-deploy-git');

var config = require('./shark-deploy-conf.json');
// use deployConfigFile to refer to another config file
if (typeof config.deployConfigFile === 'string') {
    config = require(config.deployConfigFile);
}
var appConfig = config;

var tmp1 = path.join(appConfig.tmpDir, 'step1');
var tmp2 = path.join(appConfig.tmpDir, 'step2');
// webapp
var webappDir = appConfig.webapp;
// template
var templateDir = path.join(webappDir, appConfig.templatePath)
    // mock dir
var mockDir = appConfig.mock;
// build dir
var buildDir = appConfig.build;
var buildWebappDir = path.join(buildDir, appConfig.buildWebapp);
var buildStaticDir = path.join(buildDir, appConfig.buildStatic);
// path
var cssPath = appConfig.cssPath;
var imgPath = appConfig.imgPath;
var jsPath = appConfig.jsPath;
var templatePath = appConfig.templatePath;
var htmlPath = appConfig.htmlPath;
var ajaxPath = appConfig.ajaxPrefix;
var scssPath = appConfig.scssPath;


function execCmd(cmds, processOpts) {
    if (os.platform() === 'win32') {
        // windows
        var opts = ["cmd", "/c"];
    } else {
        // mac linux
        var opts = [];
    }
    opts = opts.concat(cmds);
    console.log('-------------Exec cmd: [' + opts.join(' ') + ']------------------');
    var msg = exec(opts.join(' '), 60000, processOpts);
    console.log(msg.stderr || msg.stdout);
    if (msg.status !== 0) {
        throw new Error('Exec cmd: [' + opts.join(' ') + ']');
    }
}

function debug(log) {
    var debug = argv.debug;
    if(debug) {
        console.log(log);
    }
}

function getMimgUrlPrefix() {
    var prefix = appConfig.mimgURLPrefix[appConfig.target];
    if (typeof prefix === 'string') {
        var mimgUrl = prefix + '/' + path.join(appConfig.product, appConfig.staticVersion);
        return mimgUrl;
    }
    throw new Error('build target [' + appConfig.target + '] undefined in mimgURLPrefix');
}

gulp.task('clean', function() {

    return gulp.src([tmp1, tmp2, buildDir], {
            read: false
        })
        .pipe(clean());
});


gulp.task('compass', function(cb) {
    execCmd(['compass', 'clean']);
    execCmd(['compass', 'compile']);
    cb();
});


/***------------- useref start ---------------***/
var uglifyJs = function(file) {
    if (/\-min.js$/.test(file.path)) {
        return false;
    } else if (/.js$/.test(file.path)) {
        return true;
    }
    return false;
}

gulp.task('useref-ftl', function() {
    return gulp.src(path.join(webappDir, '**/*.ftl'))
        .pipe(useref({
            searchPath: webappDir
        }))
        .pipe(gulpif('*.js', ngAnnotate()))
        .pipe(gulpif(uglifyJs, uglify()))
        .pipe(gulpif('*.css', minifyCss()))
        .pipe(gulp.dest(tmp1));
});

gulp.task('useref-html', function() {
    return gulp.src(path.join(webappDir, '**/*.{html,htm}'))
        .pipe(useref({
            searchPath: webappDir
        }))
        .pipe(gulpif('*.js', ngAnnotate()))
        .pipe(gulpif(uglifyJs, uglify()))
        .pipe(gulpif('*.css', minifyCss()))
        .pipe(gulp.dest(tmp1));
});

gulp.task('useref', ['useref-ftl', 'useref-html']);

/***------------- useref end ---------------***/


/***------------- imagemin start ---------------***/
gulp.task('imagemin', function() {
    return gulp.src(path.join(webappDir, '**/*.{jpg,jpeg,gif,png}'))
        .pipe(imagemin({
            // jpg
            progressive: true,
            // for png
            use: [pngquant({
                quality: 90
            })]
        }))
        .pipe(gulp.dest(tmp1));
});
/***------------- imagemin end ---------------***/


/***------------- revision start ---------------***/
gulp.task("revision-image", function() {
    return gulp.src([path.join(tmp1, "**/*.{jpg,jpeg,gif,png}")])
        .pipe(rev())
        .pipe(gulp.dest(tmp2))
        .pipe(rev.manifest('image-rev-manifest.json'))
        .pipe(gulp.dest(tmp2))
});
/***------------- revision end ---------------***/


/***------------- revision start ---------------***/

gulp.task("revision-css", function() {
    return gulp.src([path.join(tmp1, "**/*.css")])
        .pipe(rev())
        .pipe(gulp.dest(tmp2))
        .pipe(rev.manifest('style-rev-manifest.json'))
        .pipe(gulp.dest(tmp2))
});

gulp.task("revision-js", function() {
    return gulp.src([path.join(tmp1, "**/*.js")])
        .pipe(rev())
        .pipe(gulp.dest(tmp2))
        .pipe(rev.manifest('js-rev-manifest.json'))
        .pipe(gulp.dest(tmp2))
});



/***------------- revision end ---------------***/


/***------------- revreplace-css start ---------------***/

gulp.task("revreplace-css", function() {
    var manifest = gulp.src([
        path.join(tmp2, '/image-rev-manifest.json')
    ]);

    return gulp.src(path.join(tmp1, "**/*.css"))
        .pipe(revReplace({
            manifest: manifest,
            replaceInExtensions: ['.css'],
            prefix: getMimgUrlPrefix()
        }))
        .pipe(gulp.dest(tmp1));
});


gulp.task("revreplace-js", function() {
    var manifest = gulp.src([
        path.join(tmp2, '/image-rev-manifest.json')
    ]);

    return gulp.src(path.join(tmp1, "**/*.js"))
        .pipe(revReplace({
            manifest: manifest,
            replaceInExtensions: ['.js'],
            prefix: getMimgUrlPrefix()
        }))
        .pipe(gulp.dest(tmp1));
});


/***------------- revreplace-css end ---------------***/


/***------------- revreplace start ---------------***/

gulp.task("revreplace-ftl", function() {
    var manifest = gulp.src([
        path.join(tmp2, 'style-rev-manifest.json'),
        path.join(tmp2, '/js-rev-manifest.json'),
        path.join(tmp2, '/image-rev-manifest.json')
    ]);

    return gulp.src(path.join(tmp1, "**/*.ftl"))
        .pipe(revReplace({
            manifest: manifest,
            replaceInExtensions: ['.ftl'],
            prefix: getMimgUrlPrefix()
        }))
        .pipe(gulp.dest(tmp2));
});

gulp.task("revreplace-html", function() {
    var manifest = gulp.src([
        path.join(tmp2, '/style-rev-manifest.json'),
        path.join(tmp2, '/js-rev-manifest.json'),
        path.join(tmp2, '/image-rev-manifest.json')
    ]);

    return gulp.src(path.join(tmp1, "**/*.{html,htm}"))
        .pipe(revReplace({
            manifest: manifest,
            replaceInExtensions: ['.html'],
            prefix: getMimgUrlPrefix()
        }))
        .pipe(gulp.dest(tmp2));
});


/***------------- revreplace end ---------------***/


/***------------- copy to build start ---------------***/
gulp.task('copy-build-js', function() {
    return gulp.src(path.join(tmp2, jsPath, '**')).pipe(gulp.dest(path.join(buildStaticDir, appConfig.staticVersion, jsPath)));
});
gulp.task('copy-build-css', function() {
    return gulp.src(path.join(tmp2, cssPath, '**')).pipe(gulp.dest(path.join(buildStaticDir, appConfig.staticVersion, cssPath)));
});
gulp.task('copy-build-image', function() {
    return gulp.src(path.join(tmp2, imgPath, '**')).pipe(gulp.dest(path.join(buildStaticDir, appConfig.staticVersion, imgPath)));
});

gulp.task('copy-build-html', function() {
    return gulp.src(path.join(tmp2, '**/*.{html,htm}')).pipe(gulp.dest(path.join(buildWebappDir)));
});
gulp.task('copy-build-ftl', function() {
    return gulp.src(path.join(tmp2, templatePath, '**')).pipe(gulp.dest(path.join(buildWebappDir, templatePath)));
});
gulp.task('copy-build-fonts', function() {
    return gulp.src(path.join(webappDir, appConfig.fontPath, '**')).pipe(gulp.dest(path.join(buildWebappDir, appConfig.fontPath)));
});
gulp.task('copy-build-swf', function() {
    if(appConfig.swfPath){
        return gulp.src(path.join(webappDir, appConfig.swfPath, '**')).pipe(gulp.dest(path.join(buildWebappDir, appConfig.swfPath)));
    }
    else{
        return null;
    }
});

// copy webapp 根目录文件
gulp.task('copy-webapp', function() {
    return gulp.src('src/main/webapp/' + '*.{ico,txt}').pipe(gulp.dest(buildWebappDir));
});

gulp.task('copy-build', ['copy-webapp', 'copy-build-ftl', 'copy-build-html', 'copy-build-js', 'copy-build-css', 'copy-build-image', 'copy-build-fonts','copy-build-swf']);

/***------------- copy to build end ---------------***/


/***------------- build-java start ---------------***/

gulp.task('clean-build-java', function() {

    return gulp.src(['src/main/webapp/WEB-INF/classes', 'src/main/webapp/WEB-INF/lib'], {
            read: false
        })
        .pipe(clean());
});

// 后端编译
gulp.task('build-java', ['clean-build-java'], function(cb) {
    if (fs.existsSync('src/main/java') && argv.branch) {
        var target = argv.target;
        var branch = argv.branch;
        if(target !== 'online'){
            target = 'test';
        }
        if (appConfig.dependProjects && appConfig.dependProjects.length > 0) {
            for (var i = 0; i < appConfig.dependProjects.length; i++) {
                var project = appConfig.dependProjects[i];
                if (os.platform() === 'win32') {
                    // windows
                    execCmd(['deploy-' + target + '.sh', branch],{
                        cwd: project
                    });
                } else {
                    // mac linux
                    execCmd(['sh', 'deploy-' + target + '.sh', branch], {
                        cwd: project
                    });
                }
            };
        }
        // compile
        execCmd(['mvn', 'compile']);
        execCmd(['mvn', 'dependency:copy-dependencies', '-DoutputDirectory=src/main/webapp/WEB-INF/lib']);
    }
    cb();
});

gulp.task('copy-build-java', function() {
    return gulp.src('src/main/webapp/WEB-INF/' + '**')
        .pipe(gulpif('{classes/**,lib/**,web.xml}', gulp.dest(path.join(buildWebappDir, 'WEB-INF'))))
});



/***------------- build-java end ---------------***/


/***------------- spm3 start ---------------***/

gulp.task('spm3', function() {
    // 有package.json的，任务是有spm的
    if (fs.existsSync(path.join(webappDir, jsPath, 'package.json'))) {
        var inputDir = path.join(webappDir, jsPath);
        // 输出需要是绝对路径才可以
        var outputDir = path.join(__dirname, tmp1, jsPath);

        execCmd(['spm', 'build', '-I', inputDir, '-O', outputDir]);
    }
});
/***------------- spm3 end ---------------***/


/***------------- build start ---------------***/

gulp.task('build', function(cb) {
    var target = argv.target;
    if (!target) {
        throw new Error('--target should be provided. ex: gulp build --target test');
    }
    if (target !== 'online' && target !== 'test' && target !== 'develop') {
        throw new Error('--target should be online or test or develop');
    }

    appConfig.target = target;

    gulp.on('error', function() {
        console.log('error error error error')
    })

    runSequence(
        // clean folders
        'clean',
        // build the java
        'build-java',
        // compass and copy to tmp1
        'compass',
        // use reference in html and ftl
        'useref',
        // spm
        'spm3',
        // imagemin and copy to tmp1
        'imagemin',
        // revision images
        'revision-image',
        // revreplace images
        ['revreplace-css', 'revreplace-js'],
        // revision css,js
        ['revision-css', 'revision-js'],
        // revreplace html,ftl
        ['revreplace-html', 'revreplace-ftl'],
        // copy to build dir, copy java
        ['copy-build', 'copy-build-java'],
        // callback
        cb
    );

});
/***------------- build end ---------------***/



/***------------- deploy-git start ---------------***/

function getRepo(target, isStatics) {
    var repo = 'http://' + appConfig.deploy.account + ':' + appConfig.deploy.password + '@git.internal/';
    if (target === 'online') {
        repo += 'yanxuan-deploy';
    } else if (target === 'test') {
        repo += 'yanxuan-test';
    }
    repo = repo + '/' + appConfig.product;
    if (isStatics) {
        repo += '-statics';
    }
    repo += '.git';
    return repo;
};

gulp.task('deploy', function(cb) {
    var branch = argv.branch;
    var target = argv.target;
    if (!branch) {
        throw new Error('--branch should be provided. ex: gulp deploy --branch master');
    }
    if (!target) {
        throw new Error('--target should be provided. ex: gulp deploy --target test');
    }
    if (target !== 'online' && target !== 'test') {
        throw new Error('--target should be online or test');
    }

    // webapp deploy
    var repo = getRepo(target, false);
    var options = {
        branch: branch,
        build: buildWebappDir,
        deploy: path.join(appConfig.deploy.webapp, target),
        repo: repo
    };
    // console.log(options);
    deployGit(options);

    // statics deploy
    var repo = getRepo(target, true);
    var staticOptions = {
        branch: branch,
        build: buildStaticDir,
        deploy: path.join(appConfig.deploy.static, target, 'mimg.127.net/hxm', appConfig.product),
        repo: repo
    };
    // console.log(staticOptions);
    deployGit(staticOptions);
});

/***------------- deploy-git end ---------------***/


/***------------- serve start ---------------***/


function findAllPagejs(html) {
    var reg = /src=['"](\/js\/[a-z,A-Z,0-9,\/]+\.page\.js)["']/g;
    var list = [];
    while(true) {
        var matches = reg.exec(html);
        if(matches) {
            list.push(matches[matches.length - 1]);
        } else {
            return list;
        }
    }
}

/**
 * 插入livereload.js到html中
 * 
 * @param  {string} html 需要处理的内容
 * @return {string}      处理后的结果
 */
function injectHtml(html) {
    var index = html.lastIndexOf('</body>');
    if (index !== -1) {
        // 如果有 .page.js,注入一下到html中
        var pageJss = findAllPagejs(html);
        var list = [];
        for (var i = 0; i < pageJss.length; i++) {
            list.push('\n<script type="text/javascript">seajs.use("' + pageJss[i] + '");</script>\n');
        };
        var script1 = list.join('');
        var script2 = '\n<script>document.write(\'<script src="http://\' + (location.host || \'localhost\').split(\':\')[0] + \':' + appConfig.port + '/livereload.js?snipver=1"></\' + \'script>\')</script>\n';

        return html.substr(0, index) + script1 + script2 + html.substr(index);
    } else {
        return html;
    }
}

function headerStatic(staticPath, headers) {
    return function(req, res, next) {
        // console.log(req.path);
        var reqPath = req.path === '/' ? '/index' : req.path;
        var f = path.join(staticPath, reqPath);
        // console.log(f);
        if (fs.existsSync(f)) {
            if (headers) {
                for (var h in headers) {
                    res.set(h, headers[h]);
                }
            }

            // 处理html格式
            if (/\.html$/.test(reqPath)) {
                res.set('Content-Type', 'text/html');
                // 文本文件
                res.send(injectHtml(fs.readFileSync(f, 'UTF-8')));
            } else {
                if (/\.js$/.test(reqPath)) {
                    res.set('Content-Type', 'text/javascript');
                    res.send(fs.readFileSync(f, 'UTF-8'));
                } else if (/\.css$/.test(reqPath)) {
                    res.set('Content-Type', 'text/css');
                    res.send(fs.readFileSync(f, 'UTF-8'));
                } else {
                    res.send(fs.readFileSync(f));
                }
            }
        } else {
            if (reqPath !== '/livereload.js') {
                // console.warn('Not Found: ' + f);
            }
            next();
        }
    }
}

function formatContent(content, matcher) {
    if (content) {
        for (var i = matcher.length; i > 0; i--) {
            content = content.replace("{" + i + "}", matcher[i]);
        }
        return content;
    } else {
        return '';
    }
}

/**
 * 兼容window与mac下的路径问题
 * 
 * @param  {string} rPath 路径
 * @return {string}       处理后的路径
 */
function getPath(rPath) {
    if (os.platform() === 'win32') {
        return (rPath || '').replace(/\\/ig, '/');
    } else {
        return rPath || '.';
    }
}


function ftlExpress(req, res, next, ftl2htmlConfig) {

    var ftlConfig;
    // parse project
    if (ftl2htmlConfig && ftl2htmlConfig.length > 0) {
        for (var i = 0; i < ftl2htmlConfig.length; i++) {
            var config = ftl2htmlConfig[i];
            var pattern = new RegExp(config.url);
            // url not match
            if (pattern.test(req.path)) {
                ftlConfig = {
                    sourceRoot: config.sourceRoot,
                    outputRoot: config.outputRoot,
                    ftl: config.ftl,
                    data: config.data
                };
                break;
            }

        };
    }
    if (!ftlConfig) {
        next();
        return;
    }

    var pattern = new RegExp(config.url);
    var matcher = pattern.exec(req.path);
    if (matcher && matcher.length > 0) {
        ftlConfig.ftl = formatContent(ftlConfig.ftl, matcher);
        ftlConfig.data = formatContent(ftlConfig.data, matcher);
    }
    var sourceRoot = path.join(__dirname, ftlConfig.sourceRoot);
    var outputRoot = path.join(__dirname, ftlConfig.outputRoot);
    var ftlFile = ftlConfig.ftl;
    var tdds = ftlConfig.data.split(',');
    for (var i = 0; i < tdds.length; i++) {
        tdds[i] = path.join(__dirname, tdds[i]);
    };
    var data = tdds.join(',');
    var outputFile = path.join(outputRoot, ftlFile.replace(/\.ftl$/, '.html'));

    debug({
        sourceRoot: sourceRoot,
        outputRoot: outputRoot,
        ftlFile: ftlFile,
        data: data
    });
    // generate html
    ftl2html(sourceRoot, outputRoot, ftlFile, data);

    if (fs.existsSync(outputFile)) {
        res.set('Content-Type', 'text/html');
        res.send(injectHtml(fs.readFileSync(outputFile, 'UTF-8')));
    } else {
        var list = ['Html Not generated.',
            'sourceRoot: ' + sourceRoot,
            'outputRoot: ' + outputRoot,
            'ftlFile: ' + ftlFile,
            'data: ' + data
        ];
        res.set('Content-Type', 'text/html');
        res.send(list.join('<br/>'));
    }
}

/**
 * 执行打包之后的server, build/app, build/mimg
 */
gulp.task('server', function() {
    var app = express();

    // ajax 
    app.use(getPath(path.join(appConfig.contextPath, ajaxPath)), headerStatic(path.join(mockDir, ajaxPath), {
        'Content-Type': 'application/json'
    }));
    // mimg
    app.use(path.join('/hxm', appConfig.product), headerStatic(buildStaticDir, {}));
    // default files
    app.use(appConfig.contextPath, headerStatic(buildWebappDir, {}));
    // for ftl
    app.use(appConfig.contextPath, function(req, res, next) {
        ftlExpress(req, res, next, appConfig['ftl2html-server']);
    });
    // livereload middleware
    app.use(body()).use(tinylr.middleware({
        app: app
    }));
    app.listen(appConfig.port, function(err) {
        if (err) {
            return console.log(err);
        }
        // 设置了默认打开页面
        if (appConfig.openurl) {
            openurl.open(appConfig.openurl);
        }

        console.log('listening on %d', appConfig.port);
    });
});


/**
 * 开发时使用的server
 */
gulp.task('serve', function() {
    var app = express();

    // ajax 
    app.use(getPath(path.join(appConfig.contextPath, ajaxPath)), headerStatic(path.join(mockDir, ajaxPath), {
        'Content-Type': 'application/json'
    }));
    // js
    app.use(jsPath, headerStatic(path.join(webappDir, jsPath), {}));
    // css
    app.use(cssPath, headerStatic(path.join(webappDir, cssPath), {}));
    // images
    app.use(imgPath, headerStatic(path.join(webappDir, imgPath), {}));
    // html
    app.use(appConfig.contextPath, headerStatic(webappDir, {}));

    // for ftl
    app.use(appConfig.contextPath, function(req, res, next) {
        ftlExpress(req, res, next, appConfig['ftl2html']);
    });

    // livereload middleware
    app.use(body()).use(tinylr.middleware({
        app: app
    }));

    app.listen(appConfig.port, function(err) {
        if (err) {
            return console.log(err);
        }
        // 设置了默认打开页面
        if (appConfig.openurl) {
            openurl.open(appConfig.openurl);
        }

        console.log('listening on %d', appConfig.port);
    });


    gulp.watch(path.join(webappDir, scssPath, '**/*.scss'), function(event) {
        execCmd(['compass', 'compile']);
        tinylr.changed('a.css');
    });
    execCmd(['compass', 'compile']);

    function watchFiles(ext) {
        // watch
        gulp.watch(path.join(webappDir, '**/*.' + ext), function(event) {
            tinylr.changed(event.path);
        });
    }
    watchFiles('js');
    watchFiles('html');
    watchFiles('ftl');
});

/***------------- serve end ---------------***/

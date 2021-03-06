#!/usr/bin/env node
//
// Use in CLI:
//
//   Type "riot" for help.
//
// Use in Node:
//
//   var riot = require('riot/compiler')
//   riot.make({ from: 'foo', to: 'bar', compact: true })
//   riot.watch({ from: 'foo.tag', to: 'bar.js' })
//

function help() {
  log([
    '',
    'Builds .tag files to .js',
    '',
    'Options:',
    '',
    '  -h, --help      You\'re reading it',
    '  -w, --watch     Watch for changes',
    '  -c, --compact   Minify </p> <p> to </p><p>',
    '  -t, --type      JavaScript pre-processor. Build-in support for: es6, coffeescript, typescript, none',
    '  --template      HTML pre-processor. Build-in suupport for: jade',
    '  --expr          Run expressions trough parser defined with --type',
    '',
    'Build a single .tag file:',
    '',
    '  riot foo.tag           To a same named file (foo.js)',
    '  riot foo.tag bar.js    To a different named file (bar.js)',
    '  riot foo.tag bar       To a different dir (bar/foo.js)',
    '',
    'Build all .tag files in a directory:',
    '',
    '  riot foo/bar           To a same directory (foo/**/*.js)',
    '  riot foo/bar baz       To a different directory (baz/**/*.js)',
    '  riot foo/bar baz.js    To a single concatenated file (baz.js)',
    '',
    'Examples for options:',
    '',
    '  riot foo bar',
    '  riot --w foo bar',
    '  riot --watch foo bar',
    '  riot --compact foo bar',
    '  riot foo bar --compact',
    '  riot test.tag --type coffeescript --expr',
    ''
  ].join('\n'))
}


var ph = require('path'),
    sh = require('shelljs'),
    chokidar = require('chokidar'),
    compiler = require('./compiler')


function init(opt) {

  // Run only once

  if (init.called) return
  init.called = true

  // If no target dir, default to source dir

  if (!opt.to) opt.to = /\.tag$/.test(opt.from) ? ph.dirname(opt.from) : opt.from

  // Resolve to absolute paths

  opt.from = ph.resolve(opt.from)
  opt.to = ph.resolve(opt.to)

  // Throw if source path doesn't exist

  if (!sh.test('-e', opt.from)) err('Source path does not exist')

  // Determine the input/output types

  opt.flow = (/\.tag$/.test(opt.from) ? 'f' : 'd') + (/\.js$/.test(opt.to) ? 'f' : 'd')

}

function toRelative(path) {
  return path.replace(sh.pwd() + '/', '')
}


// Exported methods

var self = module.exports = {


  make: function(opt) {
    init(opt)

    // Generate a list of input/output files

    function find(from) { return sh.find(from).filter(function(f) { return /\.tag$/.test(f) }) }
    function remap(from, to, base) { return from.map(function(from) {
      return ph.join(to, ph.relative(base, from).replace(/\.tag$/, '.js'))
    }) }

    var from = opt.flow[0] == 'f' ? [opt.from] : find(opt.from),
        base = opt.flow[0] == 'f' ? ph.dirname(opt.from) : opt.from,
          to = opt.flow[1] == 'f' ? [opt.to] : remap(from, opt.to, base)

    // Create any necessary dirs

    var dirs = {}
    to.map(function(f) { dirs[ph.dirname(f)] = 0 })
    sh.mkdir('-p', Object.keys(dirs))

    // Process files

    function parse(from) { return compiler.compile(sh.cat(from), opt.compile_opts) }
    function toFile(from, to) { from.map(parse).join('\n').to(to[0]) }
    function toDir(from, to) { from.map(function(from, i) { parse(from).to(to[i]) }) }
    ;(opt.flow[1] == 'f' ? toFile : toDir)(from, to)

    // Print what's been done

    from.map(function(src, i) {
      log(toRelative(src) + ' -> ' + toRelative(to[i] || to[0]))
    })

  },


  watch: function(opt) {
    init(opt)

    self.make(opt)

    var glob = opt.flow[0] == 'f' ? opt.from : ph.join(opt.from, '**/*.tag')

    chokidar.watch(glob, { ignoreInitial: true })
      .on('ready', function() { log('Watching ' + toRelative(glob)) })
      .on('all', function(e, path) { self.make(opt) })

  }

}


// Logging

function log(msg) {
  if (log.print) console.log('  ' + msg)
}

function err(msg) {
  msg += '\n'
  if (log.print) log(msg) || process.exit(1)
  else throw msg
}


// When used from CLI

function cli() {

  // Get CLI arguments

  var args = require('minimist')(process.argv.slice(2), {
    boolean: ['watch', 'compact', 'help'],
    alias: { w: 'watch', c: 'compact', h: 'help', t: 'type' }
  })

  // Translate args into options hash

  var opts = {
    help: args.help,
    method: args.watch ? 'watch' : 'make',
    compile_opts: {
      compact: args.compact,
      type: args.type,
      expr: args.expr,
      template: args.template
    },
    from: args._.shift(),
    to: args._.shift()
  }

  // Enable text output

  log.print = true

  // Print help or run the builder

  opts.help || !opts.from
    ? help()
    : self[opts.method](opts)

}


if (!module.parent) cli()

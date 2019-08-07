const fs = require('fs-extra')
const path = require('path')
const replaceStream = require('replacestream')

const {
  FileBlob,
  FileFsRef,
  getWriteableDirectory,
} = require('@now/build-utils')
const nowBuilder = require('@now/node')

module.exports = {
  ...nowBuilder,
  build: async ({ files, entrypoint, workPath, ...rest }) => {
    const { isDev = false } = rest.meta

    if (isDev)
      console.log(
        "Creating a temporary directory to merge builder's custom entrypoint"
      )

    // get a writeable directory, a tmp directory for storing our filesystem in
    // if we are in a development environment then this should be a custom tmp dir
    // if it is a deployment then we work in the workPath as is
    // const virtualDir = isDev ? await getWriteableDirectory() : workPath
    const virtualDir = workPath
    console.log('here is the virtualDir we are writing to:', virtualDir)

    // create a new map for files that will point to files in the tmp directory
    const virtualFiles = { ...files }
    // console.log('virtualFiles before changes:', virtualFiles)

    // location of user's entrypoint will default to the workPath
    let entryDir = workPath

    // But if we are in a development env, then we need to symlink the user's entrypoint
    // to the temp writeable dir to avoid polluting the local files
    // if (isDev) {
    //   entryDir = path.join(virtualDir, 'entry')
    //   console.log('Symlinking entrypoint directory to tmp directory')
    //   // symlink the workPath directory (i.e. where the entrypoint is) to the tmp dir
    //   fs.symlinkSync(workPath, entryDir)
    // }

    console.log(`Merging paywall dependencies with package.json`)

    // // create a dummy pkg object in case the project has no package.json
    let pkg = {
      dependencies: {},
      engines: {
        node: '>0.10.0',
      },
    }

    // // if the user's entrypoint has a package.json though we can use that one
    if (files['package.json']) {
      const stream = files['package.json'].toStream()
      const { data } = await FileBlob.fromStream({ stream })
      pkg = JSON.parse(data.toString())
      console.log('pkg:', pkg)
    }

    // // get our required dependencies to merge with the user's package.json
    // const json = JSON.parse(
    //   await fs.readFile(path.join(__dirname, 'server/package.json'), 'utf8')
    // )

    // console.log('required json:', json)

    // // merge dependencies from both builder's pkgJson into user's
    // Object.keys(json.dependencies).forEach(dep => {
    //   pkg.dependencies[dep] = json.dependencies[dep]
    // })

    // console.log('merged dependencies in pkg:', pkg)

    // // make sure the user's engines includes node version 10 or up
    // pkg.engines = { ...pkg.engines, ...json.engines }

    // console.log('pkg after engines update:', pkg)

    // write to a new package.json in the virtual directory if in dev
    // if (isDev)
    //   fs.writeFileSync(
    //     path.join(virtualDir, 'package.json'),
    //     JSON.stringify(pkg, null, 2)
    //   )

    // const pkgStream = new s.Readable({ objectMode: true })
    // pkgStream.push(JSON.stringify(pkg))
    // pkgStream.push(null)
    // // make an explicit reference to new package.json
    // virtualFiles['package.json'] = await FileFsRef.fromStream({
    //   stream: pkgStream,
    //   fsPath: path.join(virtualDir, 'package.json'),
    // })
    // const pkgStream = fs.createReadStream(
    //   path.join(__dirname, 'server/package.json')
    // )

    // virtualFiles['package.json'] = await FileFsRef.fromStream({
    //   stream: pkgStream,
    //   fsPath: path.join(virtualDir, 'package.json'),
    // })

    // console.log(
    //   'package.json exists?',
    //   fs.existsSync(path.join(virtualDir, 'package.json'))
    // )

    // if in dev and working in the tmp virtual directory
    // then we need to update the fsPaths for the new references
    // if (isDev)
    //   // update `fsPath`s in new files object to point to symlinked files in entryDir
    //   for (let file in virtualFiles) {
    //     virtualFiles[file].fsPath = path.join(entryDir, file)
    //   }

    // save reference to new package.json in the tmpFiles map that will be passed to build
    // and we don't care about a package.json in the entryDir since we've combined them
    // virtualFiles['package.json'] = new FileFsRef({
    //   fsPath: path.join(virtualDir, 'package.json'),
    // })

    // console.log('lets see if we have package.json...')
    // const testStream = virtualFiles['package.json'].toStream()
    // const { data } = await FileBlob.fromStream({ stream: testStream })
    // const testpkg = JSON.parse(data.toString())
    // console.log('testpkg?', testpkg)

    // move app.js into tmp dir and update import to point to user's entrypoint
    console.log('Updating builder entrypoint to be the paywall server')

    // get data from our server entrypoint at server/app.js by getting a read stream
    // pipe the stream to a function that will replace the any imports of _entrypoint to
    // the absolute path to the user defined entrypoint
    let stream
    if (isDev) {
      const entrypointImport = path.join(entryDir, entrypoint)
      console.log(
        `Setting the user's entrypoint, ${entrypointImport}, in the paywall server entrypoint as middleware`
      )
      // in dev environment, we need to update the import for the user's entrypoint
      // to point to the symlinked directory
      stream = fs
        .createReadStream(path.join(__dirname, 'server/app.js'))
        // make an explicit reference to user's entrypoint
        .pipe(replaceStream('./_entrypoint', entrypointImport))
    } else {
      // if we are in a deployed environment then we can just get the raw data stream
      // since the deployed virual env will be able to import files based on their key in
      // the `files` map which is what server/app.js defaults to importing
      stream = fs.createReadStream(path.join(__dirname, 'server/app.js'))
    }

    // create a fileFsRef from the stream, w/ fsPath in the lambda's workPath
    // this in effect puts our custom entry point in the directory of the user created entry
    // which allows the builder's entrypoint to import the user's entrypoint
    const updatedEntrypoint = await FileFsRef.fromStream({
      stream,
      fsPath: path.join(virtualDir, 'app.js'),
    })

    console.log('Updating entrypoint references')
    // update reference for the user's entrypoint
    // this should match what the default import is for the protectedRoute is in server/app.js
    virtualFiles['_entrypoint.js'] = files[entrypoint]

    // set entrypoint to new file ref
    // This must be after user's entrypoint has been moved to _entrypoint reference

    // virtualFiles[entrypoint] = updatedEntrypoint

    console.log('virtualDir:', virtualDir)
    console.log('workPath:', workPath)
    console.log('virtualFiles:', virtualFiles)
    console.log('and now back to your regularly scheduled @now/node builder')
    // return a build using the tmp directory, tmp files, and workPath set to virtualDir
    return nowBuilder.build({
      entrypoint,
      files: virtualFiles,
      workPath,
      ...rest,
    })
  },
  version: 2,
}

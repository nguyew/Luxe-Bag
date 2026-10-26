class File { constructor(...a) { this.uri = a.join('/'); this.exists = false; } copy() {} delete() {} }
module.exports = { File, Paths: { document: '/doc', cache: '/cache' }, Directory: class {} };

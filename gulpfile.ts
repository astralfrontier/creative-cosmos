type GulpCallback = (error?: any) => void;

function defaultTask(cb: GulpCallback) {
  console.log("hello world");
  cb();
}

exports.default = defaultTask;

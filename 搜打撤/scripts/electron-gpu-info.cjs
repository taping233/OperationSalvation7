const { app } = require('electron');
const { writeFileSync } = require('node:fs');

if (process.env.SDT_FORCE_HIGH_PERFORMANCE_GPU === '1') {
  app.commandLine.appendSwitch('force_high_performance_gpu');
}

app.whenReady().then(async () => {
  const info = await app.getGPUInfo('complete');
  const output = JSON.stringify({
    featureStatus: app.getGPUFeatureStatus(),
    auxAttributes: info.auxAttributes,
    gpuDevice: info.gpuDevice,
  }, null, 2);
  if (process.env.SDT_GPU_INFO) writeFileSync(process.env.SDT_GPU_INFO, output, 'utf8');
  else console.log(output);
  app.quit();
}).catch(error => {
  console.error(error);
  app.exit(1);
});

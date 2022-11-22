'use strict';

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const TestLogReader = require('../src/__specs__/utils/TestLogReader');

class E2eApp {
  constructor({ appPath, timeout = process.env.CI ? 20000 : 5000 }) {
    this.appPath = appPath;
    this.timeout = timeout;
  }

  get appName() {
    if (!this.appNameCache) {
      const packageJsonPath = path.join(this.appPath, 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      this.appNameCache = packageJson.name;
    }

    return this.appNameCache;
  }

  async run({ clearLogs = true } = {}) {
    if (clearLogs) {
      await this.removeLogDir();
    }

    await this.runApplication();
    const logReader = this.readLog();

    if (clearLogs) {
      await this.removeLogDir();
    }

    return logReader;
  }

  readLog() {
    return TestLogReader.fromApp(this.appName);
  }

  removeLogDir() {
    TestLogReader.removeDefaultLogDir(this.appName);
  }

  async runApplication() {
    return new Promise((resolve, reject) => {
      let isFinished = false;
      const output = [];

      let additionalArgs = '';
      if (process.env.DOCKER) {
        additionalArgs += ' --no-sandbox';
      }

      const app = exec(`npm start -- --test${additionalArgs}`, {
        cwd: this.appPath,
        env: { ...process.env, FORCE_STYLES: true },
      }, done);

      collectOutput(app.stdout);
      collectOutput(app.stderr);

      const timeoutId = setTimeout(() => {
        done(new Error(
          `Terminate ${this.appPath} by timeout (${this.timeout / 1000}s)`,
        ));
        app.kill('SIGKILL');
      }, this.timeout - 100);

      function done(error) {
        if (isFinished) {
          return;
        }

        isFinished = true;
        clearTimeout(timeoutId);

        const outputText = output
          .join('\n')
          .replace(/^Fontconfig.*$/mg, '')
          .replace(/^.*Desktop Identity.*$/mg, '')
          .replace(/^\n/mg, '');

        // eslint-disable-next-line no-console
        console.debug ? console.debug(outputText) : console.log(outputText);

        error ? reject(error) : resolve();
      }

      function collectOutput(pipe) {
        pipe.on('data', (chunk) => { output.push(chunk.toString()) });
      }
    });
  }
}

module.exports = E2eApp;

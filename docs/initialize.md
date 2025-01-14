# Initialize the logger in a renderer process

Previously in v4, the logger instances worked independently in 
main and renderer processes. But currently, there are a lot of restrictions
for code in a renderer processes by default. So now all the logic performed
in the main process. A logger in the renderer processes just collects the data
and sends it to the main process through IPC.

There are a few ways how a renderer logger could be configured.

## 1. Use some bundler and contextIsolation/sandbox enabled

This way also works without bundler when nodeIntegration is enabled.

```js
import log from 'electron-log';

log.initialize();
````

**renderer.ts**
```typescript
import log from 'electron-log';

log.info('Log from the renderer');
````

If for some reason it doesn't work with your bundler, try the following
import in the renderer process:

`import log from 'electron-log/renderer';`

## Use a global instance when no bundler used and nodeIntegration is disabled

**main.js**
```js
import log from 'electron-log';

log.initialize();
````

**renderer.js**
```js
__electronLog.info('Log from the renderer');
````

Please be aware that `__electronLog` global variable only exposes log functions,
no errorHandler, scope and other members.

## Spy on `console.log` calls

It's possible to collect logs written by `console.log` in the renderer process

**main.js**
```js
import log from 'electron-log';

// It makes a renderer logger available trough a global electronLog instance
log.initialize({ spyRendererConsole: true });
````

After that, any console call from a renderer will be processed in the
main process. But in that case it's not possible to log object. For example,
when `console.log('test', { a: 1 })` is called in a renderer, `test [Object]`
is received on the main side.

## Using IPC directly

Starting from electron-log v5, an electron-log IPC call has a constant
signature. So you can call it directly if you don't want to use a renderer-side
logger instance for some reason:

```js
import { ipcRenderer } from 'electron';

ipcRenderer.send('__ELECTRON_LOG__', {
  // LogMessage-like object
  data: ['Log from a renderer'],
  level: 'info',
  // ... some other optional fields like scope, logId and so on
});
```

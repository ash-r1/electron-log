'use strict';

const electronApi = require('./electronApi');

class ErrorHandler {
  includeRenderer = true;
  isActive = false;
  logFn = null;
  onError = null;
  showDialog = true;

  constructor({ logFn = null, onError = null, showDialog = true } = {}) {
    this.createIssue = this.createIssue.bind(this);
    this.handleError = this.handleError.bind(this);
    this.handleRejection = this.handleRejection.bind(this);
    this.setOptions({ logFn, onError, showDialog });
    this.startCatching = this.startCatching.bind(this);
    this.stopCatching = this.stopCatching.bind(this);
  }

  handle(error, {
    logFn = this.logFn,
    onError = this.onError,
    processType = 'browser',
    showDialog = this.showDialog,
    errorName = '',
  } = {}) {
    try {
      if (typeof onError === 'function') {
        const versions = electronApi.getVersions();
        const createIssue = this.createIssue;
        if (onError({ error, versions, createIssue }) === false) {
          return;
        }
      }

      errorName ? logFn(errorName, error) : logFn(error);

      if (showDialog && !errorName.includes('rejection')) {
        electronApi.showErrorBox(
          `A JavaScript error occurred in the ${processType} process`,
          error.stack,
        );
      }
    } catch {
      console.error(error); // eslint-disable-line no-console
    }
  }

  setOptions({ includeRenderer, logFn, onError, showDialog }) {
    if (typeof includeRenderer === 'function') {
      this.includeRenderer = includeRenderer;
    }

    if (typeof logFn === 'function') {
      this.logFn = logFn;
    }

    if (typeof onError === 'function') {
      this.onError = onError;
    }

    if (typeof showDialog === 'boolean') {
      this.showDialog = showDialog;
    }
  }

  startCatching({ onError, showDialog, includeRenderer } = {}) {
    if (this.isActive) {
      return;
    }

    this.isActive = true;
    this.setOptions({ includeRenderer, onError, showDialog });
    process.on('uncaughtException', this.handleError);
    process.on('unhandledRejection', this.handleRejection);

    if (this.includeRenderer) {
      initializeRendererErrorHandler();
    }
  }

  stopCatching() {
    this.isActive = false;
    process.removeListener('uncaughtException', this.handleError);
    process.removeListener('unhandledRejection', this.handleRejection);
  }

  createIssue(pageUrl, queryParams) {
    electronApi.openUrl(
      `${pageUrl}?${new URLSearchParams(queryParams).toString()}`,
    );
  }

  handleError(error) {
    this.handle(error, { errorName: 'Unhandled' });
  }

  handleRejection(reason) {
    const error = reason instanceof Error
      ? reason
      : new Error(JSON.stringify(reason));
    this.handle(error, { errorName: 'Unhandled rejection' });
  }
}

function initializeRendererErrorHandler() {
  electronApi.executeJsInEveryWebContents(`
    if (typeof electronLog === 'object') {
      window.addEventListener('error', (event) => {
        event.preventDefault();
        electronLog.errorHandler.handleError(event.error);
      });
      window.addEventListener('unhandledrejection', (event) => {
        event.preventDefault();
        electronLog.errorHandler.handleRejection(event.reason);
      });
    }
  `);
}

module.exports = ErrorHandler;
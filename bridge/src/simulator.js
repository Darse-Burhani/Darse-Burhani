"use strict";

const { EventEmitter } = require("events");

/**
 * Simulated USB reader. Used when HCNetSDK.dll is not present (or the FFI
 * library cannot be loaded) so the full capture → sync pipeline can still be
 * exercised. Emits the same events as the hardware driver.
 */
class SimulationDriver extends EventEmitter {
  constructor(options = {}) {
    super();
    this.mode = "simulation";
    this.model = options.model || "DS-K1F820-F (simulated)";
    this.ticks = [];
    this.gen = options.generator || (() => require("crypto").randomBytes(370).toString("base64"));
  }

  getInfo() {
    return { mode: this.mode, model: this.model, fingerprintID: 1, quality: 100 };
  }

  startEnrollment() {
    this.schedule([
      { at: 300, fn: () => this.emit("status", "Place your finger on the reader…") },
      { at: 1400, fn: () => this.emit("status", "Finger detected — keep still") },
      { at: 2400, fn: () => this.emit("status", "Compiling template from 3 scans…") },
      {
        at: 3100,
        fn: () =>
          this.emit("template", {
            fingerID: 1,
            templateData: this.gen(),
            quality: 100,
          }),
      },
    ]);
  }

  schedule(steps) {
    steps.forEach(({ at, fn }) => {
      this.ticks.push(setTimeout(fn, at));
    });
  }

  cancel() {
    for (const t of this.ticks) clearTimeout(t);
    this.ticks = [];
    this.emit("cancelled");
  }

  dispose() {
    this.cancel();
  }
}

module.exports = { SimulationDriver };
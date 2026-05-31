(function (global) {
  "use strict";

  const PL = global.PhysicsLab;

  function boot() {
    const canvas = document.getElementById("worldCanvas");
    const effects = new PL.Effects();
    const world = new PL.PhysicsWorld(canvas, effects);
    const reactions = new PL.ReactionEngine();
    const time = new PL.TimeController();
    const weather = new PL.WeatherController(world, effects);
    const save = new PL.SaveManager(world, time, weather);
    const ui = new PL.UIController(world, time, weather, save);

    world.seedMixture();

    let last = performance.now();
    let fpsTimer = last;
    let frames = 0;
    let fps = 60;

    function frame(now) {
      const dt = Math.max(0, Math.min(0.12, (now - last) / 1000));
      last = now;
      frames += 1;
      if (now - fpsTimer >= 500) {
        fps = frames * 1000 / (now - fpsTimer);
        frames = 0;
        fpsTimer = now;
        world.setPerformanceHint(fps);
        ui.updateStats(fps);
      }

      if (time.rewinding) {
        const rewindFrames = Math.max(1, Math.floor(time.speed * 2));
        const applied = time.rewind(world, rewindFrames);
        if (!applied) {
          time.setRewinding(false);
        }
      } else {
        const maxSteps = fps < 32 ? 3 : fps < 48 ? 5 : 8;
        const steps = time.consume(dt, maxSteps);
        for (let i = 0; i < steps; i += 1) {
          world.beginChangeSet();
          weather.update();
          ui.chaosStep();
          world.update(reactions);
          const changes = world.endChangeSet();
          time.push(changes);
        }
      }

      effects.update(dt);
      world.render();
      ui.renderOverlay();
      requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);

    global.PhysicsLabApp = {
      world,
      reactions,
      time,
      weather,
      save,
      ui,
      effects
    };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
}(window));
